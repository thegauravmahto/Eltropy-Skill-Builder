# ruff: noqa
"""Skill Builder harness — ADK root agent.

Uses Google AI Studio (GOOGLE_API_KEY) — not Vertex. The key is normally read
from the environment for `adk web` / `make playground`; the FastAPI server in
server.py overrides it per-request via the X-Gemini-Key header.
"""

import os

# Force AI Studio mode (the scaffold defaulted to Vertex).
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "False")

from google.adk.apps import App

from .agents import orchestrator

root_agent = orchestrator

app = App(
    root_agent=root_agent,
    name="app",
)
