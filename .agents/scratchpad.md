# Agent Scratchpad

## Current Status
- Transitioned repository to a clean monorepo structure with distinct `backend/` and `frontend/` workspaces.
- Initialized Vite + React + TypeScript + Tailwind CSS v3 frontend application inside `frontend/`.
- Implemented real-time twin-panel dashboard (`frontend/src/App.tsx`) with:
  - **Left Panel (Customer Support)**: Custom chat interface distinguishing User/Agent messages, an animated thinking indicator, and an interactive mock microphone component with visual count-down simulation that auto-sends transcripts.
  - **Right Panel (Agent Live Logs)**: Monospaced terminal visualizer displaying streaming reasoning telemetry, styled with semantic color codes (Yellow for Tool executions, Blue for Database CRM lookups, and bold Red for Policy Violations/Denials).
  - **CRM Database View Drawer**: Fetches customer record array from `GET http://localhost:8000/api/crm/profiles` and enables one-click scenario testing.
- Configured persistent thread session tracking by generating a unique `client_id` stored in `sessionStorage`.
- Successfully compiled and verified type-safety of both frontend assets and python backend imports.
- Integrated Deepgram STT (Real-Time Live Transcription) and TTS (Ultra-Low Latency Aura synthesis) into backend.
- Replaced frontend mock voice simulation with real browser microphone media recording stream.

## Architectural Decisions
1. **Monorepo Structure**: Isolated backend dependencies and files inside `backend/` to prevent dependency leakage. Frontend is decoupled inside `frontend/`.
2. **WebSocket Client Session Persistence**: Set up client connection mapping `ws://localhost:8000/ws/chat/{client_id}` where `client_id` is persisted in `sessionStorage` so page reloads do not wipe LangGraph checkpointer state.
3. **Telemetry-based UI Highlight Mapping**:
   - `lookup_customer_profile` & `verify_order_eligibility` → Highlighted in **Blue** as database lookups.
   - `validate_refund_against_policy` and node finalizations containing `DENIED` status → Highlighted in bold **Red** as policy violations.
   - Any generic tool activation or started events → Highlighted in **Yellow**.
4. **Chat Outcome Synthesis**: If the backend routing completes at `finalize_decision` with `"refund_status": "DENIED"` (cutting off subsequent LLM text response generation), the frontend intercepts this state and synthesizes a polite refusal message containing the exact policy reason logged in the telemetry.
5. **Unified Mixed WebSocket Stream**: The WebSocket endpoint `/ws/chat/{client_id}` accepts both JSON strings for standard textual chat and binary frame audio chunks for microphone input. Recording is finalized when the client sends an `{"type": "audio-end"}` text control message, which flushes Deepgram STT, executes LangGraph, runs Deepgram Aura TTS, and streams back synthesized MP3 audio bytes.

## Notes & Discoveries
- Git branch: `feature/deepgram-voice`
- Verification: `npm run build` compiles without errors.
- Backend Verification: `uv run python -c "from src.agent.voice import DeepgramVoiceEngine; DeepgramVoiceEngine()"` initializes successfully.
- Styling: Custom index.css backdrop gradients and Webkit-scrollbar tweaks applied for premium, unified dark aesthetics.
- Deepgram SDK v7.3.1: The SDK uses auto-generated client wrapper classes where connection options (such as model, encoding) are passed directly as keyword parameters in client.listen.v1.connect and client.speak.v1.audio.generate, rather than requiring separate options classes.
