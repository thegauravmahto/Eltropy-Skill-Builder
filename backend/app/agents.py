"""Skill Builder sub-agents and Main Orchestrator.

Maps 1:1 to the authoring objects in skill-builder/lib/seed.ts:
- 3 sub-agents (Authentication, Account Services, Loan Servicing)
- 7 tools (mocked in tools.py)
- Guardrails wired as before_tool / before_model / after_tool callbacks

Two model variants produced from the same definitions:
- `orchestrator` — text path, `gemini-3-flash-preview` with `thinking_level=minimal`
- `live_orchestrator` — voice path, `gemini-3.1-flash-live-preview` (audio-to-audio)
"""

from __future__ import annotations

from google.adk.agents import Agent
from google.adk.models import Gemini
from google.genai import types

from . import tools as t
from .guardrails import (
    after_tool_audit,
    make_tool_guardrail,
    no_balance_pre_auth,
)

TEXT_MODEL_ID = "gemini-3-flash-preview"
LIVE_MODEL_ID = "gemini-3.1-flash-live-preview"


def _gen_config(model_id: str) -> types.GenerateContentConfig | None:
    """Return the GenerateContentConfig appropriate for the model.

    Gemini 3 text models support `thinking_level`. Live models don't.
    """
    if "live" in model_id:
        return None
    return types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="minimal")
    )


def _model(model_id: str) -> Gemini:
    return Gemini(
        model=model_id,
        retry_options=types.HttpRetryOptions(attempts=3),
    )


def build_orchestrator(model_id: str) -> Agent:
    """Build the full orchestrator + 3 sub-agent tree at a given model.

    Same tools, same guardrails, same instructions — only the underlying
    Gemini model changes. Used to produce both the text and the live trees.
    """
    cfg = _gen_config(model_id)

    authentication_agent = Agent(
        name="authentication",
        model=_model(model_id),
        description="Verifies member identity within the conversation. Always runs first when authentication is required.",
        instruction=(
            "You are the Authentication sub-agent for an Eltropy credit-union member-service flow.\n"
            "Scope: identity verification only. Never quote balances, transactions, loan details.\n"
            "\n"
            "Process:\n"
            "1. If the user message contains a member ID (format M-XXXX), use it. Otherwise ask for it.\n"
            "2. Call authenticate_member(member_id=..., channel='chat').\n"
            "3. On success: briefly confirm verification, then IMMEDIATELY call transfer_to_agent(agent_name='orchestrator') so the original request can be fulfilled.\n"
            "4. On failure: say so once, then call transfer_to_agent(agent_name='orchestrator').\n"
            "5. Anything outside identity verification: call transfer_to_agent(agent_name='orchestrator') with no extra commentary.\n"
        ),
        tools=[t.authenticate_member],
        before_tool_callback=make_tool_guardrail({"authenticate_member"}),
        after_tool_callback=after_tool_audit,
        generate_content_config=cfg,
    )

    account_services_agent = Agent(
        name="account_services",
        model=_model(model_id),
        description="Quotes balances, walks members through transactions, handles routine account queries after auth.",
        instruction=(
            "You are the Account Services sub-agent for an Eltropy credit-union member-service flow.\n"
            "Scope: balances, recent transactions, card freeze. Nothing else.\n"
            "\n"
            "Session state:\n"
            "- authenticated: {authenticated?}\n"
            "- auth_level: {auth_level?}\n"
            "- member_id: {member_id?}\n"
            "\n"
            "If authenticated is True, use the member_id from state and proceed directly. Do NOT re-verify.\n"
            "Tools: get_account_balance, get_recent_transactions, lock_card.\n"
            "Process:\n"
            "1. Identify the account_id from the user request (e.g. A-3001).\n"
            "2. Call the relevant tool with the member_id from state and the requested account_id.\n"
            "3. Read back the result in plain language.\n"
            "4. Anything about loans, deferrals, payments, transfers: call transfer_to_agent(agent_name='orchestrator').\n"
        ),
        tools=[t.get_account_balance, t.get_recent_transactions, t.lock_card],
        before_model_callback=no_balance_pre_auth,
        before_tool_callback=make_tool_guardrail(
            {"get_account_balance", "get_recent_transactions", "lock_card"}
        ),
        after_tool_callback=after_tool_audit,
        generate_content_config=cfg,
    )

    loan_servicing_agent = Agent(
        name="loan_servicing",
        model=_model(model_id),
        description="Loan status queries and Skip-A-Pay deferrals.",
        instruction=(
            "You are the Loan Servicing sub-agent for an Eltropy credit-union member-service flow.\n"
            "Scope: loan status, Skip-A-Pay deferrals. Nothing else.\n"
            "\n"
            "Session state:\n"
            "- authenticated: {authenticated?}\n"
            "- auth_level: {auth_level?}\n"
            "- member_id: {member_id?}\n"
            "\n"
            "If authenticated is True, proceed directly. Do NOT re-verify.\n"
            "Tools: get_loan_status, defer_payment.\n"
            "Process for Skip-A-Pay:\n"
            "1. Call get_loan_status(loan_id) first to confirm the loan and eligibility signals.\n"
            "2. If type=mortgage, refuse — mortgages are not eligible.\n"
            "3. If prior deferral < 30 days ago, refuse with the reason returned.\n"
            "4. Otherwise call defer_payment(loan_id, days=30, reason='member_request') immediately. The defer_payment tool returns success or a reason; do not invent confirmation text before calling it.\n"
            "5. defer_payment requires L3 step-up auth — the guardrail will block at L2. If blocked, ask the member to step up.\n"
            "6. Anything about balances, transactions, cards, transfers: call transfer_to_agent(agent_name='orchestrator').\n"
        ),
        tools=[t.get_loan_status, t.defer_payment],
        before_model_callback=no_balance_pre_auth,
        before_tool_callback=make_tool_guardrail({"get_loan_status", "defer_payment"}),
        after_tool_callback=after_tool_audit,
        generate_content_config=cfg,
    )

    return Agent(
        name="orchestrator",
        model=_model(model_id),
        description=(
            "Main Orchestrator for the Eltropy Skill Builder harness. "
            "Routes member intents to the correct sub-agent."
        ),
        instruction=(
            "You are the Main Orchestrator routing a credit-union member's request.\n"
            "\n"
            "## Session state (authoritative — TRUST IT, DO NOT re-verify)\n"
            "- authenticated: {authenticated?}\n"
            "- auth_level: {auth_level?}\n"
            "- member_id: {member_id?}\n"
            "\n"
            "Three sub-agents available:\n"
            "- authentication: identity verification\n"
            "- account_services: balance, transactions, card freeze\n"
            "- loan_servicing: loan status, Skip-A-Pay deferrals\n"
            "\n"
            "Routing rules:\n"
            "1. If `authenticated` is True, route directly to the domain sub-agent. NEVER re-ask for the member ID.\n"
            "2. If `authenticated` is False or missing, AND the request needs account-specific data, transfer to authentication FIRST.\n"
            "3. For balance / transaction / card → account_services.\n"
            "4. For loan / Skip-A-Pay / deferral → loan_servicing.\n"
            "5. Anything else (open new account, IRA, investments, complaints) — REFUSE and explain it is out of scope. Do not invent capabilities.\n"
            "\n"
            "Delegate via transfer_to_agent. Do not chat — route immediately."
        ),
        sub_agents=[authentication_agent, account_services_agent, loan_servicing_agent],
        generate_content_config=cfg,
    )


# Text path (SSE harness)
orchestrator = build_orchestrator(TEXT_MODEL_ID)

# Voice path (Live API WebSocket harness)
live_orchestrator = build_orchestrator(LIVE_MODEL_ID)
