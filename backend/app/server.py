"""FastAPI SSE server for the Skill Builder harness.

- POST /run streams ADK execution as SSE events shaped to the frontend's TraceStep schema.
- Reads X-Gemini-Key header per-request (Google AI Studio key).
- CORS open for localhost dev.

Concurrency note: this prototype sets GOOGLE_API_KEY at process scope when a request
arrives. For multi-user demos, swap to per-call api_key plumbing on the Gemini client.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from typing import Any, AsyncGenerator

from . import patches  # noqa: F401  — monkey-patches ADK for AI Studio compatibility

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents import BaseAgent
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.genai import types

from .agents import orchestrator, live_orchestrator
from .fixtures import MEMBERS
from .guardrails import redact_pii


def _invalidate_gemini_cache(agent: BaseAgent) -> None:
    """ADK's Gemini.api_client is a @cached_property that locks GOOGLE_API_KEY at
    first use. To support per-request keys we drop the cache on every request so
    the next access re-reads env and builds a fresh Client.
    """
    model = getattr(agent, "model", None)
    if model is not None and hasattr(model, "__dict__"):
        model.__dict__.pop("api_client", None)
        model.__dict__.pop("_live_api_client", None)
    for sub in getattr(agent, "sub_agents", []) or []:
        _invalidate_gemini_cache(sub)

api = FastAPI(title="Skill Builder Harness")

api.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_session_service = InMemorySessionService()
_runner = Runner(
    agent=orchestrator,
    app_name="skill_builder_harness",
    session_service=_session_service,
)


# ---- Event shaping: ADK Event -> TraceStep (matches lib/types.ts) ----

def _event_to_steps(
    event: Any, audit_seen: int, last_author: str | None
) -> tuple[list[dict[str, Any]], int, str | None]:
    """Convert one ADK event into frontend TraceSteps.

    Returns (new_steps, new_audit_seen_count, current_author).
    Emits a sub-agent-invoke step only when the author CHANGES (not on every event).
    """
    steps: list[dict[str, Any]] = []

    author = getattr(event, "author", None)
    if author and author != "orchestrator" and author != last_author:
        steps.append({
            "type": "sub-agent-invoke",
            "label": f"→ {author}",
            "detail": "Sub-agent invoked with bound Skill allowlist + Guardrail Policy",
        })

    # Tool calls
    content = getattr(event, "content", None)
    if content and getattr(content, "parts", None):
        for part in content.parts:
            fc = getattr(part, "function_call", None)
            fr = getattr(part, "function_response", None)
            text = getattr(part, "text", None)
            if fc:
                args_str = ", ".join(
                    f"{k}={redact_pii(str(v))}" for k, v in (fc.args or {}).items()
                )
                steps.append({
                    "type": "tool-call",
                    "label": f"⚙ {fc.name}",
                    "detail": f"{fc.name}({args_str})",
                })
            elif fr:
                response = fr.response or {}
                if response.get("blocked"):
                    steps.append({
                        "type": "guardrail",
                        "label": f"▣ {response.get('guardrail', 'guardrail')} blocked {fr.name}",
                        "detail": response.get("reason", ""),
                        "blocked": True,
                    })
            elif text and text.strip():
                # Detect handback marker the agents are instructed to emit
                if "HANDBACK" in text:
                    steps.append({
                        "type": "handback",
                        "label": "↗ Handback to orchestrator",
                        "detail": text.strip()[:200],
                    })
                elif event.is_final_response():
                    steps.append({
                        "type": "response",
                        "label": "▸ Response to member",
                        "detail": text.strip(),
                    })

    return steps, audit_seen, author or last_author


# ---- /run endpoint ----

async def _stream(
    transcript: str,
    authenticated: bool,
    member_id: str | None,
    api_key: str,
    session_id: str | None = None,
) -> AsyncGenerator[str, None]:
    last_author: str | None = None
    # Concurrency caveat — see module docstring. For per-user multi-tenant, swap to
    # a per-call api_key on the Gemini client.
    os.environ["GOOGLE_API_KEY"] = api_key
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
    # Drop the @cached_property api_client on every Gemini so it picks up the new env.
    _invalidate_gemini_cache(orchestrator)

    user_id = "harness_user"
    new_session = not session_id
    if new_session:
        session_id = f"sess_{uuid.uuid4().hex[:8]}"

    existing = None
    if not new_session:
        existing = await _session_service.get_session(
            app_name="skill_builder_harness",
            user_id=user_id,
            session_id=session_id,
        )

    if existing is None:
        initial_state: dict[str, Any] = {
            "authenticated": authenticated,
            "auth_level": MEMBERS.get(member_id).auth_level if (member_id and member_id in MEMBERS) else ("L2" if authenticated else "none"),
            "member_id": member_id,
            "audit_log": [],
        }
        await _session_service.create_session(
            app_name="skill_builder_harness",
            user_id=user_id,
            session_id=session_id,
            state=initial_state,
        )

    started = time.time()
    guardrails_fired: list[str] = []
    final_response = ""
    audit_seen = 0

    # Open SSE: emit an intent-match step up front
    yield _sse({
        "type": "intent-match",
        "label": "◆ Main Orchestrator received intent",
        "detail": redact_pii(transcript[:200]),
    })

    message = types.Content(role="user", parts=[types.Part.from_text(text=transcript)])

    try:
        async for event in _runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=message,
        ):
            steps, audit_seen, last_author = _event_to_steps(event, audit_seen, last_author)
            for s in steps:
                if s["type"] == "guardrail":
                    guardrails_fired.append(s["label"])
                if s["type"] == "response":
                    final_response = s["detail"]
                yield _sse(s)
                await asyncio.sleep(0)  # cooperative flush
    except Exception as e:  # surface auth / key errors as a guardrail event
        yield _sse({
            "type": "guardrail",
            "label": "▣ Harness error",
            "detail": f"{type(e).__name__}: {str(e)[:200]}",
            "blocked": True,
        })

    duration_ms = int((time.time() - started) * 1000)

    # Final summary frame
    yield _sse({
        "type": "summary",
        "durationMs": duration_ms,
        "guardrailsFired": guardrails_fired,
        "finalResponse": final_response,
        "sessionId": session_id,
    })

    yield "event: done\ndata: {}\n\n"


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@api.post("/run")
async def run_harness(
    request: Request,
    x_gemini_key: str | None = Header(default=None, alias="X-Gemini-Key"),
):
    if not x_gemini_key:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Gemini-Key header. Set your AI Studio API key in the Settings panel.",
        )
    body = await request.json()
    transcript = (body.get("transcript") or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Missing 'transcript' in request body.")
    authenticated = bool(body.get("authenticated", False))
    member_id = body.get("member_id")
    session_id = body.get("session_id")

    return StreamingResponse(
        _stream(transcript, authenticated, member_id, x_gemini_key, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@api.get("/healthz")
async def healthz():
    return {
        "ok": True,
        "agent": "skill_builder_harness",
        "text_model": "gemini-3-flash-preview",
        "live_model": "gemini-3.1-flash-live-preview",
    }


# ============================================================================
# Live API — WebSocket voice channel
# ============================================================================

_live_runner = Runner(
    agent=live_orchestrator,
    app_name="skill_builder_harness",
    session_service=_session_service,
)


@api.websocket("/live")
async def live_voice(ws: WebSocket):
    """Bidirectional voice channel using ADK run_live + gemini-3.1-flash-live-preview.

    Wire protocol:
      Client → Server:
        - Binary frames: PCM16 mono 16kHz audio chunks
        - Text frames: JSON control messages
          {"type":"start", "key":"AIza...", "authenticated":bool, "member_id":"M-1001", "session_id":"..."}
          {"type":"text", "text":"..."}       # text turn (optional)
          {"type":"end"}                       # close
      Server → Client:
        - Binary frames: PCM16 mono 24kHz audio out (Gemini Live default)
        - Text frames: JSON events
          {"type":"transcript","role":"user|model","text":"...","is_final":bool}
          {"type":"tool-call","name":"...","args":{...}}
          {"type":"guardrail","label":"...","detail":"...","blocked":true}
          {"type":"sub-agent","name":"..."}
          {"type":"error","message":"..."}
          {"type":"ready","session_id":"..."}
    """
    await ws.accept()
    queue: LiveRequestQueue | None = None
    forward_task: asyncio.Task | None = None
    user_id = "harness_user"

    try:
        # First message must be {"type":"start", ...}
        first = await ws.receive_text()
        cfg = json.loads(first)
        if cfg.get("type") != "start":
            await ws.send_text(json.dumps({"type": "error", "message": "First frame must be type=start"}))
            await ws.close()
            return

        api_key = cfg.get("key")
        if not api_key:
            await ws.send_text(json.dumps({"type": "error", "message": "Missing AI Studio key"}))
            await ws.close()
            return

        os.environ["GOOGLE_API_KEY"] = api_key
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"
        _invalidate_gemini_cache(live_orchestrator)

        authenticated = bool(cfg.get("authenticated", False))
        member_id = cfg.get("member_id")
        session_id = cfg.get("session_id") or f"live_{uuid.uuid4().hex[:8]}"

        existing = await _session_service.get_session(
            app_name="skill_builder_harness", user_id=user_id, session_id=session_id
        )
        if existing is None:
            initial_state: dict[str, Any] = {
                "authenticated": authenticated,
                "auth_level": (
                    MEMBERS.get(member_id).auth_level
                    if (member_id and member_id in MEMBERS)
                    else ("L2" if authenticated else "none")
                ),
                "member_id": member_id,
                "audit_log": [],
            }
            await _session_service.create_session(
                app_name="skill_builder_harness",
                user_id=user_id,
                session_id=session_id,
                state=initial_state,
            )

        queue = LiveRequestQueue()
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=["AUDIO"],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            # Push-to-talk: client controls turn boundaries via activity_start/end.
            # Disable server-side VAD so the model doesn't try to detect speech ends itself.
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
            ),
        )

        await ws.send_text(json.dumps({"type": "ready", "session_id": session_id}))

        # Forwarder: ADK events → WebSocket
        async def forward_events():
            last_author: str | None = None
            try:
                async for event in _live_runner.run_live(
                    user_id=user_id,
                    session_id=session_id,
                    live_request_queue=queue,
                    run_config=run_config,
                ):
                    author = getattr(event, "author", None)
                    if author and author != "orchestrator" and author != last_author:
                        await ws.send_text(json.dumps({"type": "sub-agent", "name": author}))
                    last_author = author or last_author

                    content = getattr(event, "content", None)
                    if not content:
                        # transcription events live at event.input_transcription / output_transcription
                        input_tx = getattr(event, "input_transcription", None)
                        output_tx = getattr(event, "output_transcription", None)
                        if input_tx and getattr(input_tx, "text", None):
                            await ws.send_text(
                                json.dumps({
                                    "type": "transcript",
                                    "role": "user",
                                    "text": input_tx.text,
                                    "is_final": getattr(input_tx, "finished", False),
                                })
                            )
                        if output_tx and getattr(output_tx, "text", None):
                            await ws.send_text(
                                json.dumps({
                                    "type": "transcript",
                                    "role": "model",
                                    "text": output_tx.text,
                                    "is_final": getattr(output_tx, "finished", False),
                                })
                            )
                        continue

                    for part in content.parts or []:
                        inline = getattr(part, "inline_data", None)
                        if inline and getattr(inline, "data", None):
                            mime = getattr(inline, "mime_type", "") or ""
                            if "audio" in mime:
                                await ws.send_bytes(inline.data)
                                continue

                        fc = getattr(part, "function_call", None)
                        if fc:
                            args_redacted = {
                                k: redact_pii(str(v)) if isinstance(v, str) else v
                                for k, v in (fc.args or {}).items()
                            }
                            await ws.send_text(
                                json.dumps({"type": "tool-call", "name": fc.name, "args": args_redacted})
                            )
                            continue

                        fr = getattr(part, "function_response", None)
                        if fr and isinstance(fr.response, dict) and fr.response.get("blocked"):
                            await ws.send_text(
                                json.dumps({
                                    "type": "guardrail",
                                    "label": f"▣ {fr.response.get('guardrail', 'guardrail')} blocked {fr.name}",
                                    "detail": fr.response.get("reason", ""),
                                    "blocked": True,
                                })
                            )
                            continue

                        text = getattr(part, "text", None)
                        if text and text.strip():
                            await ws.send_text(
                                json.dumps({
                                    "type": "transcript",
                                    "role": "model",
                                    "text": text,
                                    "is_final": True,
                                })
                            )
            except asyncio.CancelledError:
                pass  # normal teardown when the WS receive loop ends
            except Exception as e:
                try:
                    await ws.send_text(
                        json.dumps({"type": "error", "message": f"{type(e).__name__}: {str(e)[:200]}"})
                    )
                except Exception:
                    pass

        forward_task = asyncio.create_task(forward_events())

        # Receive loop: WebSocket → ADK queue
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"] is not None:
                # PCM16 mono 16kHz from the browser
                queue.send_realtime(
                    types.Blob(mime_type="audio/pcm;rate=16000", data=msg["bytes"])
                )
            elif "text" in msg and msg["text"] is not None:
                try:
                    payload = json.loads(msg["text"])
                except Exception:
                    continue
                if payload.get("type") == "text":
                    queue.send_content(
                        types.Content(role="user", parts=[types.Part.from_text(text=payload.get("text", ""))])
                    )
                elif payload.get("type") == "activity_start":
                    queue.send_activity_start()
                elif payload.get("type") == "activity_end":
                    queue.send_activity_end()
                elif payload.get("type") == "end":
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "message": f"{type(e).__name__}: {str(e)}"}))
        except Exception:
            pass
    finally:
        if queue is not None:
            queue.close()
        if forward_task is not None:
            forward_task.cancel()
            try:
                await forward_task
            except (Exception, asyncio.CancelledError):
                pass
        try:
            await ws.close()
        except (Exception, asyncio.CancelledError):
            pass
