"""Guardrail callbacks — the 5 families from the Skill Builder UI as ADK hooks.

Families:
- scope:      sub-agent refuses out-of-scope intents (handled by Orchestrator routing + agent instruction)
- tool:       only allowlisted tools may be invoked (before_tool_callback)
- data:       PII redaction at log boundary (helper used by SSE event emitter)
- behavioural: no-balance-pre-auth (before_model_callback on Account Services)
- audit:      every invocation logs the four Safe AI questions (after_tool_callback)
"""

from __future__ import annotations

import re
from typing import Any

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext
from google.genai import types as genai_types

from .fixtures import MEMBERS


# ---- Family: tool (allowlist + financial step-up) ----

FINANCIAL_TOOLS = {"defer_payment", "initiate_payment"}


def make_tool_guardrail(allowed_tools: set[str]):
    """Build a before_tool_callback that:
    1. Blocks any tool not in the sub-agent's allowlist (closed agency).
    2. Blocks any financial-side-effect tool unless session state shows L3 auth.

    ADK signature: callback(tool, args, tool_context).
    """

    def before_tool(
        tool: BaseTool, args: dict, tool_context: ToolContext
    ) -> dict | None:
        tool_name = tool.name
        state = tool_context.state

        # ADK's built-in transfer_to_agent is always allowed (it's how sub-agents handback)
        if tool_name == "transfer_to_agent":
            return None

        # Tool allowlist
        if tool_name not in allowed_tools:
            _audit(state, "guardrail.tool_allowlist_blocked", {"tool": tool_name})
            return {
                "blocked": True,
                "guardrail": "tool_allowlist",
                "reason": (
                    f"Tool '{tool_name}' is not on this sub-agent's allowlist. "
                    "Refusing the call."
                ),
            }

        # Financial step-up
        if tool_name in FINANCIAL_TOOLS:
            auth_level = state.get("auth_level", "none")
            if auth_level != "L3":
                _audit(
                    state,
                    "guardrail.financial_step_up_required",
                    {"tool": tool_name, "current_auth": auth_level},
                )
                return {
                    "blocked": True,
                    "guardrail": "financial_step_up",
                    "reason": (
                        f"Tool '{tool_name}' has a financial side-effect and "
                        f"requires step-up auth (L3). Current level: {auth_level}. "
                        "Ask the member for explicit confirmation and step up to L3 first."
                    ),
                }

        _audit(state, "tool.invoked", {"tool": tool_name, "args": _redact_args(args)})
        return None

    return before_tool


# ---- Family: behavioural (no-balance-pre-auth) ----

def no_balance_pre_auth(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> LlmResponse | None:
    """If member is not authenticated, pre-empt the model and emit a handback."""
    if callback_context.state.get("authenticated") is True:
        return None  # proceed normally

    _audit(callback_context.state, "guardrail.no_balance_pre_auth_fired", {})
    return LlmResponse(
        content=genai_types.Content(
            role="model",
            parts=[
                genai_types.Part(
                    text=(
                        "HANDBACK: I can't access account-specific data before "
                        "verifying your identity. Routing you to Authentication first."
                    )
                )
            ],
        )
    )


# ---- Family: audit ----

def _audit(state: Any, event: str, payload: dict[str, Any]) -> None:
    """Append-only audit log on session state."""
    log = state.get("audit_log") or []
    log.append({"event": event, "payload": payload})
    state["audit_log"] = log


def after_tool_audit(
    tool: BaseTool, args: dict, tool_context: ToolContext, tool_response: dict
) -> dict | None:
    state = tool_context.state
    _audit(
        state,
        "tool.completed",
        {"tool": tool.name, "result_keys": list(tool_response.keys()) if isinstance(tool_response, dict) else []},
    )

    # Update auth state if authentication tool succeeded
    if tool.name == "authenticate_member" and isinstance(tool_response, dict) and tool_response.get("verified"):
        member_id = tool_response.get("member_id")
        if member_id and member_id in MEMBERS:
            state["authenticated"] = True
            state["auth_level"] = MEMBERS[member_id].auth_level
            state["member_id"] = member_id
    return None


# ---- Family: data (PII redaction at log boundary) ----

_MEMBER_ID_RE = re.compile(r"\b(M-\d{4})\b")
_ACCOUNT_ID_RE = re.compile(r"\b(A-\d{4})\b")
_LOAN_ID_RE = re.compile(r"\b(L-\d{4})\b")
_CARD_ID_RE = re.compile(r"\b(C-\d{4})\b")


def redact_pii(text: str) -> str:
    """Mask member/account/loan/card IDs in a string. Used by the SSE event emitter."""
    text = _MEMBER_ID_RE.sub(lambda m: f"M-***{m.group(1)[-2:]}", text)
    text = _ACCOUNT_ID_RE.sub(lambda m: f"A-***{m.group(1)[-2:]}", text)
    text = _LOAN_ID_RE.sub(lambda m: f"L-***{m.group(1)[-2:]}", text)
    text = _CARD_ID_RE.sub(lambda m: f"C-***{m.group(1)[-2:]}", text)
    return text


def _redact_args(args: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in args.items():
        out[k] = redact_pii(v) if isinstance(v, str) else v
    return out
