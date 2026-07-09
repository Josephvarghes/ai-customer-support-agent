import asyncio
import contextlib
import json
import logging
from datetime import datetime
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import BaseMessage, HumanMessage

from src.agent.graph import app as agent_app
from src.agent.voice import DeepgramVoiceEngine
from src.database import CRMDatabase

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

voice_engine = DeepgramVoiceEngine()


def make_serializable(obj: Any) -> Any:
    """Recursively converts LangChain messages and other non-serializable objects

    into JSON-compatible formats.
    """
    if isinstance(obj, list):
        return [make_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, BaseMessage):
        msg_dict = {
            "type": obj.type,
            "content": obj.content,
        }
        if hasattr(obj, "name") and obj.name:
            msg_dict["name"] = obj.name
        if hasattr(obj, "id") and obj.id:
            msg_dict["id"] = obj.id
        if hasattr(obj, "tool_calls") and obj.tool_calls:
            msg_dict["tool_calls"] = obj.tool_calls
        return msg_dict
    try:
        json.dumps(obj)
        return obj
    except (TypeError, OverflowError):
        return str(obj)


# Load environment variables
load_dotenv()

app = FastAPI(
    title="AI Customer Support Agent API",
    description=(
        "Automated CRM query and refund evaluation engine powered by LangGraph."
    ),
    version="0.1.0",
)

# CORS Middleware to support frontend clients (like React on 5173/3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AI Customer Support Agent API",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    """Simple system check endpoint."""
    return {"status": "healthy"}


@app.get("/api/crm/profiles")
def get_crm_profiles():
    """Serves the mock customer records database state."""
    db = CRMDatabase()
    return db._data


@app.websocket("/ws/chat/{client_id}")
async def websocket_chat_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket handler for streaming session chat and reasoning logs."""
    await websocket.accept()
    logger.info(f"WebSocket client {client_id} connected.")

    # Deepgram STT stream connection context
    dg_connection = None
    connection_ctx = None
    listen_task = None
    transcript_parts = []
    finalize_event = asyncio.Event()

    async def listen_to_dg(conn):
        try:
            async for response in conn:
                if hasattr(response, "channel") and response.channel.alternatives:
                    sentence = response.channel.alternatives[0].transcript
                    if sentence:
                        logger.info(f"Deepgram STT segment: {sentence}")
                        transcript_parts.append(sentence)
                        await websocket.send_json(
                            {
                                "type": "user-transcript-chunk",
                                "content": sentence,
                            }
                        )
                if getattr(response, "from_finalize", False):
                    finalize_event.set()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Deepgram listener task: {e}")

    try:
        while True:
            # Receive any message (text or binary) from the client
            message = await websocket.receive()

            # 1. Handle TEXT frames
            if "text" in message:
                raw_data = message["text"]
                user_message = ""
                try:
                    data = json.loads(raw_data)
                    if isinstance(data, dict):
                        # Check if it's a control message to finish the audio streaming
                        msg_type = data.get("type") or data.get("event")
                        if msg_type == "audio-end":
                            logger.info(
                                "Received audio-end control signal from client."
                            )
                            if dg_connection is not None:
                                # Finalize connection and flush
                                await dg_connection.send_finalize()
                                # Wait for finalize event with a timeout
                                try:
                                    await asyncio.wait_for(
                                        finalize_event.wait(), timeout=1.0
                                    )
                                except TimeoutError:
                                    logger.warning(
                                        "Timeout waiting for Deepgram finalize event."
                                    )

                                # Gracefully tear down the connection
                                await connection_ctx.__aexit__(None, None, None)
                                # Wait for listener task to exit naturally
                                try:
                                    await asyncio.wait_for(listen_task, timeout=0.5)
                                except TimeoutError:
                                    if listen_task:
                                        listen_task.cancel()

                                dg_connection = None
                                connection_ctx = None
                                listen_task = None

                                user_message = " ".join(transcript_parts).strip()
                                logger.info(
                                    f"Assembled microphone transcript: {user_message}"
                                )
                                await websocket.send_json(
                                    {
                                        "type": "user-transcript-final",
                                        "content": user_message,
                                    }
                                )
                            else:
                                logger.warning(
                                    "Received audio-end but no active "
                                    "Deepgram connection was open."
                                )
                                continue
                        else:
                            user_message = (
                                data.get("message") or data.get("content") or raw_data
                            )
                    else:
                        user_message = str(raw_data)
                except json.JSONDecodeError:
                    user_message = raw_data

                if not user_message or not user_message.strip():
                    continue

                logger.info(
                    f"Processing message for client {client_id}: {user_message}"
                )

                # Stream LangGraph events using .astream_events(..., version="v2")
                config = {"configurable": {"thread_id": client_id}}
                inputs = {
                    "messages": [HumanMessage(content=user_message)],
                    "policy_checks": {},
                    "refund_status": None,
                }
                agent_response_text = ""

                try:
                    async for event in agent_app.astream_events(
                        inputs, config, version="v2"
                    ):
                        event_type = event.get("event")
                        event_name = event.get("name")

                        # Handle model token streams
                        if event_type == "on_chat_model_stream":
                            chunk = event.get("data", {}).get("chunk")
                            if chunk and hasattr(chunk, "content"):
                                token = chunk.content
                                if token:
                                    agent_response_text += token
                                    await websocket.send_json(
                                        {"type": "token", "content": token}
                                    )

                        # Handle reasoning logs - tool execution start
                        elif event_type == "on_tool_start":
                            tool_input = event.get("data", {}).get("input")
                            await websocket.send_json(
                                {
                                    "type": "reasoning",
                                    "node": "execute_tools",
                                    "tool": event_name,
                                    "log": {
                                        "status": "started",
                                        "arguments": tool_input,
                                    },
                                }
                            )

                        # Handle reasoning logs - tool execution end
                        elif event_type == "on_tool_end":
                            tool_output = event.get("data", {}).get("output")
                            telemetry_data = {}
                            if isinstance(tool_output, dict):
                                telemetry_data = tool_output.get("telemetry", {})
                            elif isinstance(tool_output, str):
                                telemetry_data = {"output": tool_output}

                            await websocket.send_json(
                                {
                                    "type": "reasoning",
                                    "node": "execute_tools",
                                    "tool": event_name,
                                    "log": {
                                        "status": "completed",
                                        "telemetry": make_serializable(telemetry_data),
                                    },
                                }
                            )

                        # Handle reasoning logs - chain (node) execution start
                        elif event_type == "on_chain_start":
                            metadata = event.get("metadata", {})
                            node_name = metadata.get("langgraph_node")
                            if node_name:
                                await websocket.send_json(
                                    {
                                        "type": "reasoning",
                                        "node": node_name,
                                        "tool": None,
                                        "log": {
                                            "status": "node_started",
                                            "timestamp": datetime.now().isoformat(),
                                        },
                                    }
                                )

                        # Handle reasoning logs - chain (node) execution end
                        elif event_type == "on_chain_end":
                            metadata = event.get("metadata", {})
                            node_name = metadata.get("langgraph_node")
                            if node_name:
                                node_output = event.get("data", {}).get("output", {})
                                await websocket.send_json(
                                    {
                                        "type": "reasoning",
                                        "node": node_name,
                                        "tool": None,
                                        "log": {
                                            "status": "node_completed",
                                            "output": make_serializable(node_output),
                                            "timestamp": datetime.now().isoformat(),
                                        },
                                    }
                                )

                    # Post-processing to capture finalized response and play speech
                    state = await agent_app.aget_state(config)
                    refund_status = state.values.get("refund_status")

                    # If LLM didn't generate response text,
                    # synthesize it based on decision
                    if not agent_response_text.strip() and refund_status:
                        if refund_status == "DENIED":
                            reasoning_logs = state.values.get(
                                "agent_reasoning_logs", []
                            )
                            reason_text = ""
                            for log in reasoning_logs:
                                if log.get("tool") == "validate_refund_against_policy":
                                    outcome = log.get("outcome", "")
                                    # Example: "Evaluation complete.
                                    # Eligible: False. Reason: Order window."
                                    reason_text = (
                                        outcome.replace(
                                            "Evaluation complete. Eligible: False.", ""
                                        )
                                        .replace(
                                            "Evaluation complete. Eligible: True.", ""
                                        )
                                        .strip()
                                    )
                                    if reason_text.startswith("Reason:"):
                                        reason_text = reason_text.replace(
                                            "Reason:", "", 1
                                        ).strip()
                                    break
                            if not reason_text:
                                reason_text = "Order details violate refund rules."
                            agent_response_text = (
                                "I have run a policy audit on your order. "
                                "Unfortunately, your refund request is DENIED. "
                                f"Reason: {reason_text}"
                            )
                        elif refund_status == "APPROVED":
                            agent_response_text = (
                                "Great news! Your refund request is APPROVED. "
                                "The credit will be applied to your payment method."
                            )

                        if agent_response_text.strip():
                            await websocket.send_json(
                                {
                                    "type": "token",
                                    "content": agent_response_text,
                                }
                            )

                    # Convert response text to speech and send as binary back to client
                    if agent_response_text.strip():
                        logger.info(
                            "Synthesizing speech for agent response: %s",
                            agent_response_text,
                        )
                        audio_data = await voice_engine.speak_text(agent_response_text)
                        await websocket.send_bytes(audio_data)

                except Exception as e:
                    logger.error(
                        f"Error during agent event stream for {client_id}: {e}"
                    )
                    with contextlib.suppress(Exception):
                        await websocket.send_json(
                            {
                                "type": "error",
                                "content": f"Internal agent error: {e!s}",
                            }
                        )

            # 2. Handle BINARY frames
            elif "bytes" in message:
                binary_data = message["bytes"]
                if len(binary_data) > 0:
                    if dg_connection is None:
                        logger.info(
                            "Initializing persistent Deepgram STT stream connection."
                        )
                        transcript_parts.clear()
                        finalize_event.clear()

                        connection_ctx = voice_engine.async_client.listen.v1.connect(
                            model="nova-2-general",
                            interim_results=False,
                            language="en-US",
                        )
                        dg_connection = await connection_ctx.__aenter__()
                        listen_task = asyncio.create_task(listen_to_dg(dg_connection))

                    # Pipe audio chunk bytes into the active Deepgram connection
                    await dg_connection.send_media(binary_data)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client {client_id} disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        # Clean up any open connection
        if dg_connection is not None:
            if listen_task:
                listen_task.cancel()
            with contextlib.suppress(Exception):
                await connection_ctx.__aexit__(None, None, None)
