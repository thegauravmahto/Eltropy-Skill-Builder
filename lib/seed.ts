// Seed data - Authentication + Account Services as reference sub-agents
// These are the two real sub-agents Eltropy shipped on March 27, 2026

import type { GuardrailSet, Skill, SubAgent, Tool } from "./types";

export const tools: Tool[] = [
  {
    id: "tool_authenticate_member",
    name: "authenticate_member",
    description: "Verify a member identity using channel-appropriate factors (voice biometric, OTP, knowledge-based).",
    domain: "Authentication",
    sideEffect: "read",
    requiredScopes: ["member:read", "auth:verify"],
    rateLimitTier: "medium",
    piiSurface: true,
    inputs: [
      { name: "member_id", type: "string", required: true, pii: true },
      { name: "channel", type: "string", required: true },
    ],
    output: { type: "AuthResult", example: "{verified: true, level: 'L2'}" },
  },
  {
    id: "tool_get_account_balance",
    name: "get_account_balance",
    description: "Returns the available and current balance for a member's account.",
    domain: "Account Services",
    sideEffect: "read",
    requiredScopes: ["member:read", "account:read"],
    rateLimitTier: "high",
    piiSurface: false,
    inputs: [
      { name: "member_id", type: "string", required: true, pii: true },
      { name: "account_id", type: "string", required: true },
    ],
    output: { type: "Balance", example: "{available: 1842.55, current: 1850.00}" },
  },
  {
    id: "tool_get_recent_transactions",
    name: "get_recent_transactions",
    description: "Returns the last N transactions on an account.",
    domain: "Account Services",
    sideEffect: "read",
    requiredScopes: ["member:read", "account:read"],
    rateLimitTier: "high",
    piiSurface: false,
    inputs: [
      { name: "account_id", type: "string", required: true },
      { name: "limit", type: "number", required: false },
    ],
    output: { type: "Transaction[]" },
  },
  {
    id: "tool_get_loan_status",
    name: "get_loan_status",
    description: "Returns current loan principal, next due date, and payment history.",
    domain: "Loan Servicing",
    sideEffect: "read",
    requiredScopes: ["member:read", "loan:read"],
    rateLimitTier: "medium",
    piiSurface: false,
    inputs: [{ name: "loan_id", type: "string", required: true }],
    output: { type: "LoanStatus" },
  },
  {
    id: "tool_defer_payment",
    name: "defer_payment",
    description: "Defer a scheduled loan payment by N days. Financial side-effect.",
    domain: "Loan Servicing",
    sideEffect: "financial",
    requiredScopes: ["loan:write", "auth:step-up"],
    rateLimitTier: "low",
    piiSurface: false,
    inputs: [
      { name: "loan_id", type: "string", required: true },
      { name: "days", type: "number", required: true },
      { name: "reason", type: "string", required: false },
    ],
    output: { type: "DeferralResult" },
  },
  {
    id: "tool_lock_card",
    name: "lock_card",
    description: "Place a freeze on a member's card. Reversible.",
    domain: "Card Services",
    sideEffect: "write",
    requiredScopes: ["card:write"],
    rateLimitTier: "medium",
    piiSurface: false,
    inputs: [{ name: "card_id", type: "string", required: true }],
    output: { type: "LockResult" },
  },
  {
    id: "tool_initiate_payment",
    name: "initiate_payment",
    description: "Initiate an internal transfer between member accounts. Financial side-effect.",
    domain: "Payments",
    sideEffect: "financial",
    requiredScopes: ["payment:write", "auth:step-up"],
    rateLimitTier: "low",
    piiSurface: false,
    inputs: [
      { name: "from_account_id", type: "string", required: true },
      { name: "to_account_id", type: "string", required: true },
      { name: "amount", type: "number", required: true },
    ],
    output: { type: "PaymentResult" },
  },
];

export const guardrails: GuardrailSet[] = [
  {
    id: "gr_scope_strict",
    name: "Strict scope enforcement",
    family: "scope",
    description: "Sub-agent refuses any intent outside its declared scope domain and hands back to the orchestrator.",
    rules: [
      "Refuse intents outside declared scope domain",
      "Hand back to Main Orchestrator with reason",
      "Log every refusal as an audit event",
    ],
  },
  {
    id: "gr_tool_allowlist",
    name: "Tool allowlist",
    family: "tool",
    description: "Only Tools explicitly bound to the Skill can be invoked at runtime.",
    rules: [
      "Allowlist enforced at Skill Editor lint time",
      "Allowlist enforced at runtime",
      "Financial-side-effect Tools require step-up auth",
    ],
  },
  {
    id: "gr_pii_redaction",
    name: "PII redaction",
    family: "data",
    description: "SSN, full DOB, and full card numbers are redacted at the log boundary and never spoken on voice.",
    rules: [
      "SSN never spoken on voice channel",
      "Full account numbers redacted in logs",
      "Member name allowed in conversation; never logged in plaintext",
    ],
  },
  {
    id: "gr_no_balance_pre_auth",
    name: "No balance pre-authentication",
    family: "behavioural",
    description: "Never quote a balance, transaction list, or account-specific data until Authentication sub-agent returns verified.",
    rules: [
      "Authentication must complete before any account-specific Tool call",
      "Refuse and request authentication if member skips identity verification",
    ],
  },
  {
    id: "gr_audit_full_trace",
    name: "Full Safe AI audit trace",
    family: "audit",
    description: "Every invocation logs the four Safe AI questions: what / why / what data / how.",
    rules: [
      "Append-only log of what the agent did",
      "Append-only log of why it did it (intent + skill version)",
      "Append-only log of what data it used (tool calls + retrievals)",
      "Append-only log of how it decided (rubric / model + prompt versions)",
    ],
  },
];

export const skills: Skill[] = [
  {
    id: "skill_member_auth_l2",
    name: "Verify member to L2",
    domain: "Authentication",
    description: "Authenticate a member to Level 2 (sufficient for account-specific actions).",
    status: "published",
    version: "1.4.0",
    authoredBy: "Eltropy FDPM",
    tenantScope: "Eltropy",
    body: `# Verify member to L2

**Why this Skill exists.** No account-specific Tool may be invoked before identity is confirmed.
Skipping this step lets a bad actor read balances, transactions, or move money. This is the
gate that prevents the worst day in the credit union's year.

## MUST NEVER
- Quote balances, transactions, loan details, card numbers, or anything else. Authentication scope only.
- Continue after 2 failed attempts. Hand back, log, and let a human take over.
- Accept member identity from conversational context alone — always call \`authenticate_member\`.

## MUST ALWAYS
- Run the verification Tool exactly once per attempt.
- Log every failure as an audit event (the \`gr_audit_full_trace\` guardrail handles this automatically).
- Return control to the orchestrator the moment identity is verified — do not chat further.

## Steps (rigid — do not reorder or skip)
1. Greet by name if context provides it; otherwise ask for member ID. **(flexible: tone)**
2. Run identity verification: {{tool: authenticate_member(member_id=$member.id, channel=$channel)}} **(rigid)**
3. If \`level >= "L2"\` → confirm verified to member, hand back to orchestrator. **(rigid)**
4. If verification fails after 2 attempts → {{handback: orchestrator}} with reason="auth_failed". **(rigid)**

## Red flags — stop and escalate if you think any of these
- *"They sound like the member, I'll proceed without the Tool"* — never.
- *"One more retry can't hurt"* — after attempt 2, hand back.
- *"I'll just quickly confirm their balance to help"* — out of scope; refuse.`,
    toolsUsed: ["tool_authenticate_member"],
    guardrailIds: ["gr_scope_strict", "gr_pii_redaction", "gr_audit_full_trace"],
    regressionCases: 24,
    regressionPass: true,
    lintErrors: 0,
    lastEditedAt: "2026-05-12T10:14:00Z",
  },
  {
    id: "skill_account_balance",
    name: "Quote account balance",
    domain: "Account Services",
    description: "Tell the member their available and current balance after authentication.",
    status: "published",
    version: "2.1.0",
    authoredBy: "Eltropy FDPM",
    tenantScope: "Eltropy",
    body: `# Quote account balance

**Why this Skill exists.** Balance disclosure is the single most-requested member interaction
and the most common point of identity confusion (joint accounts, similar names). Getting the
account-to-member match wrong is a privacy breach, not an inconvenience.

## MUST NEVER
- Run before \`session.authenticated == true\` — the \`gr_no_balance_pre_auth\` guardrail will block, but don't rely on it.
- Quote balance from an account whose \`member_id\` does not match the authenticated member.
- Estimate, round, or "approximately" a balance. Quote what the Tool returns, verbatim.
- Drift into transfers, payments, or loan discussion — those are out of scope.

## MUST ALWAYS
- Read **available** balance first, then **current**. Members hear the first number loudest.
- If the Tool returns an error or no matching account, say so plainly. Do not guess.

## Steps
1. Identify the \`account_id\` from the member's request (e.g. "checking" → resolve to A-XXXX from state). **(rigid)**
2. {{tool: get_account_balance(member_id=$member.id, account_id=$account.id)}} **(rigid)**
3. Read back: *"Your available balance is $X. Current balance is $Y."* **(flexible: wording)**
4. Offer recent transactions if helpful. **(flexible)**
5. Loan / card / transfer questions → {{handback: orchestrator}}.

## Red flags
- *"They mentioned 'their account', I'll just pick the first one"* — ask, don't assume.
- *"The Tool errored, I'll just quote the last known balance"* — never. Surface the error.`,
    toolsUsed: ["tool_get_account_balance"],
    guardrailIds: ["gr_scope_strict", "gr_no_balance_pre_auth", "gr_audit_full_trace"],
    regressionCases: 31,
    regressionPass: true,
    lintErrors: 0,
    lastEditedAt: "2026-05-10T14:32:00Z",
  },
  {
    id: "skill_recent_transactions",
    name: "Read recent transactions",
    domain: "Account Services",
    description: "Walk a member through their last 5 transactions.",
    status: "published",
    version: "1.2.0",
    authoredBy: "Eltropy FDPM",
    tenantScope: "Eltropy",
    body: `# Read recent transactions

**Why this Skill exists.** Transaction read-back is where members spot fraud first. Tone
matters: a neutral, accurate read is what makes them trust the channel. A judgmental summary
("you spent a lot on dining") destroys it.

## MUST NEVER
- Categorise, judge, or counsel on spending. *"You spent $X on Y"* is fine; *"You should cut back"* is not.
- Reveal a transaction the Tool did not return. Stick to what's in the response.
- Continue if the account's \`member_id\` does not match the authenticated member.

## MUST ALWAYS
- Stay neutral and factual.
- Lead with the most recent debit, then most recent credit, then anything notable (e.g. > $500).
- Offer to look up a specific transaction the member names.

## Steps
1. {{tool: get_recent_transactions(account_id=$account.id, limit=5)}} **(rigid)**
2. Summarise neutrally — recent debit, recent credit, anything > $500. **(flexible: wording, neutral tone is rigid)**
3. Offer follow-ups: *"Want me to read more, or look at a specific one?"* **(flexible)**
4. Loan / card / transfer questions → {{handback: orchestrator}}.

## Red flags
- *"This looks like a fraud pattern, I should warn them"* — surface the facts, don't editorialise. Hand back to a human if fraud is suspected.
- *"They asked about category X, I'll group them"* — only if neutral. Never judge.`,
    toolsUsed: ["tool_get_recent_transactions"],
    guardrailIds: ["gr_scope_strict", "gr_no_balance_pre_auth", "gr_audit_full_trace"],
    regressionCases: 18,
    regressionPass: true,
    lintErrors: 0,
    lastEditedAt: "2026-05-09T09:15:00Z",
  },
  {
    id: "skill_skip_a_pay",
    name: "Defer loan payment (Skip-A-Pay)",
    domain: "Loan Servicing",
    description: "Defer a member's next loan payment by 30 days when they qualify.",
    status: "draft",
    version: "0.3.0",
    authoredBy: "CU AI Lead",
    tenantScope: "tenant",
    body: `# Defer loan payment (Skip-A-Pay)

**Why this Skill exists.** Skip-A-Pay is a **financial-side-effect** action that moves real
money in the member's ledger. The decision is regulated, the eligibility rules are policy,
and the audit trail is what protects the credit union in a dispute. This Skill is high-stakes
by design.

## MUST NEVER
- Decide eligibility from conversation alone. **Always** call \`get_loan_status\` first and read the eligibility signals from the Tool response.
- Skip the explicit member confirmation step before \`defer_payment\`. A financial action without recorded consent is the worst-case audit finding.
- Run \`defer_payment\` without L3 step-up auth. The \`gr_tool_allowlist\` guardrail will block; do not work around it.
- Invent a new due-date or confirmation text — read it from the Tool result.

## MUST ALWAYS
- Get the loan's current status from \`get_loan_status\` before any decision.
- Surface the **exact** reason the Tool returns if it refuses (mortgage policy, prior deferral too recent, delinquent, etc.).
- Confirm the new due date back to the member in the Tool's own date string.
- Log the audit trail (handled by \`gr_audit_full_trace\`; do not skip the after-tool callback).

## Steps (rigid)
1. Fetch status: {{tool: get_loan_status(loan_id=$loan.id)}}
2. Read eligibility from the response — do NOT compute from member context.
3. Ask explicit confirmation: *"Confirm you'd like to defer L-XXXX's next payment by 30 days?"*
4. On member "yes": {{tool: defer_payment(loan_id=$loan.id, days=30, reason="member_request")}}
5. Read back \`new_next_due_date\` from the response verbatim.
6. On ineligible / refusal: explain the Tool's reason, offer {{handback: orchestrator}} for human review.

## Eligibility rules (reference — encoded in the Tool, do not duplicate the logic)
| Rule | Effect |
|---|---|
| Loan type = mortgage | Ineligible (policy) |
| Status ≠ current | Ineligible (delinquent loans cannot be deferred) |
| Prior deferral < 30 days ago | Ineligible (lockout window) |
| Authenticated to L3 | Required for the financial step-up |

## Red flags — stop and call the Tool instead
- *"They said they're current, I'll skip get_loan_status"* — never. Call the Tool.
- *"It's been about a month since the last deferral, close enough"* — never. Let the Tool decide.
- *"They sound stressed, I'll just approve it and explain after"* — never. Confirmation is the audit record.
- *"L3 is overkill for $95"* — the policy is the policy; the dollar amount doesn't change it.`,
    toolsUsed: ["tool_get_loan_status", "tool_defer_payment"],
    guardrailIds: ["gr_scope_strict", "gr_tool_allowlist", "gr_audit_full_trace"],
    regressionCases: 7,
    regressionPass: false,
    lintErrors: 1,
    lastEditedAt: "2026-05-14T18:42:00Z",
  },
];

export const subAgents: SubAgent[] = [
  {
    id: "subagent_authentication",
    name: "Authentication",
    scopeDomain: "Authentication",
    description: "Verifies member identity within the conversation. Always runs first when authentication is required.",
    policy: `## Why this sub-agent exists
Every account-specific Tool — balance, transactions, transfers, deferrals — is gated behind L2 authentication. This sub-agent is the gate. The day this fails open is the day the credit union explains itself to its regulator.

## MUST NEVER
- Read, quote, or summarise any account-specific data. Scope is identity verification only.
- Decide a member is "probably them" from voice tone, conversational context, or repeat customer familiarity. The Tool decides.
- Continue after **2** failed verification attempts. Hand back; let a human resume.
- Transfer to a domain sub-agent without a successful \`authenticate_member\` result in session state.

## MUST ALWAYS
- Run \`authenticate_member\` exactly once per attempt.
- Hand back to the orchestrator the instant identity is confirmed — no chat, no upsell.
- Emit a full audit event on every attempt (success or fail). The \`gr_audit_full_trace\` guardrail enforces this; do not bypass.

## Routing
Triggered by intents implying identity (*"this is X"*, *"verify me"*, *"log me in"*) **or** by another sub-agent's \`gr_no_balance_pre_auth\` behavioural guardrail firing.

## Escalation
After 2 failed attempts → \`refuse-and-handback\` with \`reason="auth_failed"\`. Human reviewer takes over from there.`,
    status: "published",
    version: "1.4.0",
    routingIntents: ["verify identity", "log me in", "I am [member]", "who am I"],
    boundSkills: ["skill_member_auth_l2"],
    guardrailIds: ["gr_scope_strict", "gr_pii_redaction", "gr_audit_full_trace"],
    outOfScopeBehaviour: "refuse-and-handback",
    lastTestPassAt: "2026-05-13T16:00:00Z",
    lastEditedAt: "2026-05-12T10:14:00Z",
  },
  {
    id: "subagent_account_services",
    name: "Account Services",
    scopeDomain: "Account Services",
    description: "Quotes balances, walks members through transactions, handles routine account queries after auth.",
    policy: `## Why this sub-agent exists
Balance and transaction read-back is the highest-volume member interaction in the credit union. Most days it is forgettable; the days it goes wrong (mismatched account, privacy breach, judgmental tone) are the days that end on the news. This sub-agent's job is to be **boringly correct**.

## MUST NEVER
- Run before \`session.authenticated == true\`. The \`gr_no_balance_pre_auth\` behavioural guardrail blocks at the model layer; do not rely on it to fix bad authoring.
- Quote balance or transactions from an account whose \`member_id\` does not match the authenticated member.
- Categorise, judge, or counsel on spending. *"You spent $X on dining"* is fine. *"You should cut back"* is not.
- Touch loan-servicing or payment-initiation intents — hand back.

## MUST ALWAYS
- Use the \`member_id\` from session state, never one inferred from the message.
- Quote balances verbatim from the Tool. Never round, estimate, or "approximate".
- Stay neutral. Tone is part of the contract.

## Routing
Triggered by balance / transaction / card-freeze intents from an authenticated member. If the member is not authenticated, the behavioural guardrail pre-routes to \`authentication\` first.

## Escalation
Out-of-scope intents (loans, payments, IRAs) → \`refuse-and-handback\` to the orchestrator. Suspected fraud patterns surface the facts and hand back; do not editorialise.`,
    status: "published",
    version: "2.1.0",
    routingIntents: ["balance", "transactions", "recent activity", "what did I spend"],
    boundSkills: ["skill_account_balance", "skill_recent_transactions"],
    guardrailIds: ["gr_scope_strict", "gr_no_balance_pre_auth", "gr_audit_full_trace"],
    outOfScopeBehaviour: "refuse-and-handback",
    lastTestPassAt: "2026-05-13T16:02:00Z",
    lastEditedAt: "2026-05-10T14:32:00Z",
  },
  {
    id: "subagent_loan_servicing",
    name: "Loan Servicing",
    scopeDomain: "Loan Servicing",
    description: "Loan status queries and Skip-A-Pay deferrals. In draft - not yet published.",
    policy: `## Why this sub-agent exists
Loan servicing actions move real money and are regulated. The blast radius of a wrong Skip-A-Pay or a wrong deferral count is real (NSF cascades, late-fee disputes, compliance findings). This sub-agent is high-stakes by design.

## MUST NEVER
- Decide eligibility from member context. Always call \`get_loan_status\` and read the eligibility signals from the Tool response.
- Invoke \`defer_payment\` without explicit member confirmation in the same turn. Confirmation **is** the audit record.
- Invoke \`defer_payment\` at L2 — the \`gr_tool_allowlist\` financial-step-up guardrail will block. Surface the block; do not work around it.
- Fabricate the new due date — read it from the Tool's response.

## MUST ALWAYS
- Lead with a Tool call. \`get_loan_status\` first, every time.
- Surface refusal reasons verbatim (mortgage policy, prior-deferral lockout, delinquency).
- Confirm new due date in the Tool's own date string.
- Emit a full audit trail (handled by \`gr_audit_full_trace\` — do not bypass after-tool callback).

## Routing
Skip-A-Pay / loan-status / deferral intents from an authenticated member at **L3**. If the member is at L2, ask them to step up before any \`defer_payment\` call.

## Escalation
Any ineligibility, dispute, or fraud signal → \`refuse-and-handback\` with the Tool's reason. Human reviewer takes ineligible deferrals; do not negotiate policy with the member.`,
    status: "draft",
    version: "0.3.0",
    routingIntents: ["skip a payment", "loan status", "defer payment", "can I skip"],
    boundSkills: ["skill_skip_a_pay"],
    guardrailIds: ["gr_scope_strict", "gr_tool_allowlist", "gr_audit_full_trace"],
    outOfScopeBehaviour: "refuse-and-handback",
    lastEditedAt: "2026-05-14T18:42:00Z",
  },
];

// Quick lookups
export function getTool(id: string) {
  return tools.find((t) => t.id === id);
}
export function getToolByName(name: string) {
  return tools.find((t) => t.name === name);
}
export function getSkill(id: string) {
  return skills.find((s) => s.id === id);
}
export function getSubAgent(id: string) {
  return subAgents.find((sa) => sa.id === id);
}
export function getGuardrail(id: string) {
  return guardrails.find((g) => g.id === id);
}
