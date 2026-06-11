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
from src.database import CRMDatabase

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    try:
        while True:
            # Await input from connection
            raw_data = await websocket.receive_text()

            # Robust message payload extraction
            user_message = ""
            try:
                data = json.loads(raw_data)
                if isinstance(data, dict):
                    user_message = (
                        data.get("message") or data.get("content") or raw_data
                    )
                else:
                    user_message = str(raw_data)
            except json.JSONDecodeError:
                user_message = raw_data

            if not user_message or not user_message.strip():
                continue

            logger.info(f"Processing message for client {client_id}: {user_message}")

            # Stream LangGraph events using .astream_events(..., version="v2")
            config = {"configurable": {"thread_id": client_id}}
            inputs = {"messages": [HumanMessage(content=user_message)]}

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
            except Exception as e:
                logger.error(f"Error during agent event stream for {client_id}: {e}")
                with contextlib.suppress(Exception):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "content": f"Internal agent error: {e!s}",
                        }
                    )

    except WebSocketDisconnect:
        logger.info(f"WebSocket client {client_id} disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
