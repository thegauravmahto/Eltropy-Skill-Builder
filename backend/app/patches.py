"""Runtime patches for ADK quirks.

`gemini-3.1-flash-live-preview` on the AI Studio (Gemini API) backend rejects
transparent session resumption — but ADK's live flow auto-enables it on the
second `connect()` call once the server has emitted a session_resumption_update.
This patch strips the transparent flag so reconnects fall back to a fresh
connection instead of raising:

    ValueError: Transparent session resumption is only supported for Vertex AI backend.

State is lost across the reconnect, but for a single-user demo the conversation
keeps flowing.
"""

from __future__ import annotations

import contextlib

from google.adk.models import google_llm

_original_connect = google_llm.Gemini.connect


@contextlib.asynccontextmanager
async def _patched_connect(self, llm_request):
    cfg = getattr(llm_request, "live_connect_config", None)
    if cfg and cfg.session_resumption and cfg.session_resumption.transparent:
        # AI Studio rejects transparent resumption; drop it so the connect
        # succeeds as a fresh session.
        cfg.session_resumption = None
    async with _original_connect(self, llm_request) as conn:
        yield conn


google_llm.Gemini.connect = _patched_connect
