# DESIGN_SPEC.md

## Overview

The **Skill Builder Harness** is an ADK-powered runtime that executes Skills authored in the Next.js Skill Builder UI. The frontend renders Sub-agents, Skills, Tools, and Guardrails as first-class authoring objects; this backend turns those authoring artifacts into a real multi-agent execution graph using Google ADK.

The harness exposes a single SSE endpoint that streams ADK `Event`s shaped into the frontend's existing `TraceStep[]` contract. A Main Orchestrator `LlmAgent` routes member intents to the correct sub-agent (Authentication, Account Services, Loan Servicing). Each sub-agent has a bound Skill allowlist and a Guardrail Policy implemented as `before_tool_callback` / `before_model_callback` hooks. All Tools are mocked Python functions returning plausible banking responses — no real banking actions in this prototype.

Phase 1 is text-only. Voice via Gemini Live API is deferred to Phase 2. Local-only execution, no Cloud Run deployment.

## Example Use Cases

1. **Skip-A-Pay (happy path, pre-authenticated)** — Member says *"I want to skip my next loan payment."* Orchestrator routes to `loan_servicing`. `defer_payment` is financial, so the financial-step-up guardrail prompts confirmation. Tool fires, mocked deferral response, member sees new due date.
2. **Skip-A-Pay (unauthenticated)** — Same transcript, but the member is not authenticated. The no-balance-pre-auth behavioural guardrail pre-routes to `authentication` sub-agent. Once authenticated, control returns to `loan_servicing`.
3. **Account balance (authenticated)** — *"What's my checking balance?"* → `account_services` → `get_account_balance` → returns mocked $4,231.07.
4. **Out-of-scope refusal** — *"Open an IRA for me."* → no sub-agent matches → orchestrator handback with reason logged in the trace.
5. **Cross-domain scope violation** — Member is mid-conversation with `account_services` and suddenly asks about loan deferral. The scope guardrail refuses and hands back to the orchestrator with a `scope-violation` event.

## Tools Required (7 mocked functions)

Schema must match `lib/seed.ts` exactly. All are mocked — no real API calls.

| Tool | Domain | Side-effect | Required scopes | Purpose |
|---|---|---|---|---|
| `authenticate_member(member_id, channel)` | Authentication | write | `auth:write` | Mocked L2 authentication |
| `get_account_balance(member_id, account_id)` | Account Services | read | `account:read` | Mocked balance lookup |
| `get_recent_transactions(member_id, account_id, limit)` | Account Services | read | `account:read` | Mocked tx list |
| `lock_card(card_id, reason)` | Account Services | write | `card:write` | Mocked card freeze |
| `get_loan_status(loan_id)` | Loan Servicing | read | `loan:read` | Mocked loan summary |
| `defer_payment(loan_id, days, reason)` | Loan Servicing | **financial** | `loan:write`, `auth:step-up` | Mocked Skip-A-Pay |
| `initiate_payment(from_account, to_account, amount)` | Account Services | **financial** | `payment:write`, `auth:step-up` | Mocked transfer |

## Mock Data Fixtures

A `backend/app/fixtures/` module provides plausible, internally-consistent banking data. The mocked tools read from these fixtures so traces feel realistic across multiple use cases.

**Members (4):**
- `M-1001` Alex Chen — authenticated L3, primary member, 1 checking + 1 savings + 1 auto loan + 1 credit card
- `M-1002` Priya Patel — authenticated L2, 1 checking + 1 mortgage + 2 credit cards
- `M-1003` Marcus Johnson — unauthenticated, 1 checking + 1 personal loan (eligible for Skip-A-Pay)
- `M-1004` Linda Okafor — authenticated L3, joint accounts, recently locked card

**Accounts (10):** checking, savings, money-market — each with balance, last 4 digits, account type, opening date.

**Loans (4):**
- `L-2001` auto loan, on-time, eligible for Skip-A-Pay (no prior deferrals)
- `L-2002` mortgage, on-time, ineligible (mortgage policy)
- `L-2003` personal loan, 1 prior deferral 90 days ago — eligible
- `L-2004` personal loan, 1 prior deferral 14 days ago — **ineligible** (drives edge case #3)

**Cards (5):** debit + credit, last 4 digits, status (active / locked / expired).

**Transactions (~40):** spread across accounts, realistic merchants (grocery, gas, rent, payroll deposit), recent 30 days.

**Skip-A-Pay eligibility rules (encoded in `defer_payment`):**
- Loan type must be `auto` or `personal` (mortgages excluded)
- No prior deferral within last 30 days
- Loan status must be `current` (not delinquent)

These fixtures make the Test Harness output convincing in a demo — multiple distinct members, eligible vs ineligible loans, locked cards to demonstrate state, etc.

## Constraints & Safety Rules

- **Closed agency:** Each `LlmAgent` sub-agent has an explicit `tools=[...]` whitelist. Sub-agents cannot reach tools outside their scope domain.
- **Tool-allowlist guardrail:** `before_tool_callback` rejects any tool call not on the sub-agent's allowlist; emits `guardrail.blocked` event.
- **Financial step-up guardrail:** `before_tool_callback` for any tool with `sideEffect: financial` checks `session.state["auth_level"] >= "L3"`; otherwise refuses and emits `guardrail.step-up-required`.
- **No-balance-pre-auth (behavioural):** `before_model_callback` on `account_services` pre-routes to `authentication` if `session.state["authenticated"]` is false.
- **PII redaction at log boundary:** Member IDs, account numbers, and card numbers are masked in SSE event payloads (last 4 digits only).
- **Scope guardrail:** Orchestrator's routing function refuses out-of-scope intents and emits a `handback` step.
- **No real banking:** All Tools return mocked data from fixtures. No external API calls.
- **Model:** `gemini-3-flash-preview` with `thinking_level="minimal"` everywhere (orchestrator + sub-agents).
- **API key:** Per-request via `X-Gemini-Key` header. Backend never stores; instantiates `genai.Client(api_key=...)` per request.

## Success Criteria

- All 5 example use cases run end-to-end with real ADK model decisions (not regex routing) and stream to the Next.js Test Harness via SSE.
- Trace shows at least one **real guardrail callback firing** for the Skip-A-Pay unauthenticated case (visible `▣ guardrail` step in the UI).
- Authoring contract preserved: the 3 sub-agents, 7 tools, and 5 guardrail families in `lib/seed.ts` map 1:1 to ADK objects.
- Backend runs locally with a single command (`make playground` or `uv run uvicorn ...`) using only an AI Studio API key (no GCP credentials needed).
- Frontend gates real-harness mode behind `NEXT_PUBLIC_HARNESS_URL`; with the env unset, the existing mocked trace continues to work (v1 stays prod-safe on Vercel).

## Edge Cases to Handle

1. **Ambiguous intent** — Orchestrator returns low confidence → handback to orchestrator with `reason: "no-matching-subagent"` rather than guessing.
2. **Mid-conversation scope drift** — Member crosses domains; the scope guardrail must catch this *before* the model emits a tool call.
3. **Mocked tool failure** — `defer_payment` returns `{success: false, reason: "prior-deferral-too-recent"}` for loan `L-2004`; sub-agent must surface this gracefully, not retry.
4. **Missing API key** — Backend returns `400` with a structured error; frontend shows "Set your Gemini API key in Settings" instead of a silent failure.
5. **Concurrent requests with different keys** — Two browser tabs with different keys must not bleed state; per-request `genai.Client` instantiation, never `os.environ`.
