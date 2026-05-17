// Eltropy Skill Builder - Core types
// Three-layer composition: Tool -> Skill -> Sub-agent

export type SideEffect = "read" | "write" | "financial";
export type ScopeDomain =
  | "Authentication"
  | "Account Services"
  | "Loan Servicing"
  | "Card Services"
  | "Collections"
  | "Payments";

export type Role =
  | "Eltropy FDPM"
  | "CU AI Lead"
  | "CU FDE"
  | "Fintech Partner"
  | "Compliance Reviewer";

export type SkillStatus = "draft" | "in-review" | "published" | "deprecated";
export type GuardrailFamily = "scope" | "tool" | "data" | "behavioural" | "audit";

export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description?: string;
  pii?: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  domain: ScopeDomain;
  sideEffect: SideEffect;
  requiredScopes: string[];
  rateLimitTier: "low" | "medium" | "high";
  piiSurface: boolean;
  inputs: ToolParam[];
  output: { type: string; example?: string };
}

export interface GuardrailSet {
  id: string;
  name: string;
  family: GuardrailFamily;
  description: string;
  rules: string[];
}

export interface Skill {
  id: string;
  name: string;
  domain: ScopeDomain;
  description: string;
  status: SkillStatus;
  version: string;
  authoredBy: Role;
  tenantScope: "Eltropy" | "tenant" | "marketplace";
  // The SOP body in Markdown with curly-brace tool calls: {{tool: name(arg=val)}}
  body: string;
  toolsUsed: string[]; // Tool IDs referenced in body
  guardrailIds: string[];
  regressionCases: number;
  regressionPass: boolean;
  lintErrors: number;
  lastEditedAt: string;
}

export interface SubAgent {
  id: string;
  name: string;
  scopeDomain: ScopeDomain;
  description: string;
  // Rich operating policy in Markdown (MUST NEVER / MUST ALWAYS / red flags / escalation).
  // Description is for cards; policy is for the detail page.
  policy?: string;
  status: SkillStatus;
  version: string;
  routingIntents: string[];
  boundSkills: string[]; // Skill IDs - the allowlist
  guardrailIds: string[];
  outOfScopeBehaviour: "refuse-and-handback" | "escalate-to-human";
  lastTestPassAt?: string;
  lastEditedAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  // The Safe AI 4 questions
  what: string; // what the agent did
  why: string; // why it did it
  whatData: string[]; // what data it used
  how: string; // how it decided
  // Plus operational context
  subAgentId: string;
  skillId?: string;
  toolCalls: { toolId: string; args: Record<string, unknown>; result?: string }[];
  guardrailsFired: string[];
  memberHash?: string;
}

export interface TraceStep {
  type: "intent-match" | "sub-agent-invoke" | "skill-invoke" | "tool-call" | "guardrail" | "response" | "handback";
  label: string;
  detail?: string;
  blocked?: boolean;
}

export interface Trace {
  transcript: string;
  steps: TraceStep[];
  finalResponse: string;
  guardrailsFired: string[];
  durationMs: number;
}
