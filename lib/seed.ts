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

Goal: confirm member identity to L2 before any account-specific request.

1. Greet by member name if context provides it; otherwise ask for member ID.
2. Run identity verification: {{tool: authenticate_member(member_id=$member.id, channel=$channel)}}
3. If verification returns L2 or higher, return verified state to orchestrator.
4. If verification fails after 2 attempts, {{handback: orchestrator}} with reason="auth_failed".
5. Never quote account-specific data here. Stay within the Authentication scope.`,
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

Pre-condition: member is verified to L2 by Authentication sub-agent.

1. Confirm which account the member is asking about.
2. Fetch balance: {{tool: get_account_balance(member_id=$member.id, account_id=$account.id)}}
3. Read back available balance first, then current balance.
4. Offer to share recent transactions if member asks.
5. Stay strictly within Account Services scope. For loan questions, {{handback: orchestrator}}.`,
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

Pre-condition: member is verified to L2.

1. Fetch: {{tool: get_recent_transactions(account_id=$account.id, limit=5)}}
2. Summarise: most recent debit, most recent credit, anything > $500.
3. Offer to deep-dive on any specific transaction.
4. Do not categorise or judge spending. Stay neutral and factual.
5. Loan or card-specific questions: {{handback: orchestrator}}.`,
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

Pre-condition: member is verified to L2. Eligibility rules apply (no prior deferral in 12 months).

1. Confirm which loan: {{tool: get_loan_status(loan_id=$loan.id)}}
2. Check eligibility: prior deferral count, current payment status.
3. If eligible, request explicit confirmation from member (financial action).
4. Execute deferral: {{tool: defer_payment(loan_id=$loan.id, days=30, reason="member_request")}}
5. Confirm new due date back to member. Log the audit trail.
6. If ineligible, explain why and offer to {{handback: orchestrator}} for human review.`,
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
