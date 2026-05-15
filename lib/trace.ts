// Mock test harness execution - runs a member transcript through the orchestrator -> sub-agent -> skill -> tools

import { parseBody } from "./parser";
import { getSkill, getSubAgent, getTool, getToolByName, skills, subAgents } from "./seed";
import type { Skill, SubAgent, Trace, TraceStep } from "./types";

function matchIntent(transcript: string): SubAgent | null {
  const lower = transcript.toLowerCase();
  // Auth keywords first
  if (/\b(verify|authenticate|i am|log me in|who am i|my name is)\b/.test(lower)) {
    return subAgents.find((s) => s.id === "subagent_authentication") || null;
  }
  if (/\b(skip[- ]?a[- ]?pay|skip a payment|defer|loan status|miss.*payment)\b/.test(lower)) {
    return subAgents.find((s) => s.id === "subagent_loan_servicing") || null;
  }
  if (/\b(balance|transaction|recent activity|how much.*account|spent|deposit)\b/.test(lower)) {
    return subAgents.find((s) => s.id === "subagent_account_services") || null;
  }
  return null;
}

function selectSkill(sa: SubAgent, transcript: string): Skill | null {
  const lower = transcript.toLowerCase();
  const bound = sa.boundSkills.map(getSkill).filter(Boolean) as Skill[];
  if (bound.length === 0) return null;
  if (sa.id === "subagent_account_services") {
    if (/\btransaction|recent|activity|spent\b/.test(lower)) {
      return bound.find((s) => s.id === "skill_recent_transactions") || bound[0];
    }
    return bound.find((s) => s.id === "skill_account_balance") || bound[0];
  }
  return bound[0];
}

export function runTrace(transcript: string, opts?: { authenticated?: boolean }): Trace {
  const t0 = Date.now();
  const steps: TraceStep[] = [];
  const guardrailsFired: string[] = [];
  let finalResponse = "";
  const authenticated = opts?.authenticated ?? false;

  steps.push({ type: "intent-match", label: "Orchestrator: classifying member intent", detail: `"${transcript}"` });

  const sa = matchIntent(transcript);
  if (!sa) {
    steps.push({
      type: "guardrail",
      label: "Scope guardrail fired",
      detail: "No sub-agent matched the intent within configured scope domains. Handing back to human.",
      blocked: true,
    });
    guardrailsFired.push("gr_scope_strict");
    finalResponse = "I'm going to connect you with a teammate who can help with this.";
    return { transcript, steps, finalResponse, guardrailsFired, durationMs: Date.now() - t0 };
  }

  steps.push({
    type: "sub-agent-invoke",
    label: `Route to "${sa.name}" sub-agent`,
    detail: `Scope: ${sa.scopeDomain} - Version: ${sa.version}`,
  });

  // Behavioural guardrail: no balance / loan / payment pre-auth
  if (!authenticated && sa.id !== "subagent_authentication") {
    steps.push({
      type: "guardrail",
      label: "Behavioural guardrail fired: no-balance-pre-auth",
      detail: "Member is not authenticated. Routing first to Authentication sub-agent.",
      blocked: true,
    });
    guardrailsFired.push("gr_no_balance_pre_auth");
    const authSa = subAgents.find((s) => s.id === "subagent_authentication")!;
    steps.push({
      type: "sub-agent-invoke",
      label: `Pre-route to "Authentication" sub-agent`,
      detail: `Scope: ${authSa.scopeDomain}`,
    });
    const authSkill = getSkill("skill_member_auth_l2")!;
    steps.push({
      type: "skill-invoke",
      label: `Invoke Skill: ${authSkill.name} (v${authSkill.version})`,
    });
    steps.push({
      type: "tool-call",
      label: `Tool: authenticate_member`,
      detail: `member_id=*****, channel=voice`,
    });
    steps.push({
      type: "response",
      label: "Authentication verified (L2)",
      detail: "Returning to original sub-agent",
    });
  }

  const skill = selectSkill(sa, transcript);
  if (!skill) {
    steps.push({
      type: "handback",
      label: "No matching Skill on sub-agent allowlist",
      detail: "Handing back to Main Orchestrator",
      blocked: true,
    });
    finalResponse = "Let me connect you with a teammate.";
    return { transcript, steps, finalResponse, guardrailsFired, durationMs: Date.now() - t0 };
  }

  steps.push({
    type: "skill-invoke",
    label: `Invoke Skill: ${skill.name} (v${skill.version})`,
    detail: skill.status === "published" ? "Pinned version, immutable" : `Status: ${skill.status}`,
  });

  // Walk the skill body for tool calls
  const segments = parseBody(skill.body);
  for (const seg of segments) {
    if (seg.type !== "toolcall" || !seg.toolCall) continue;
    if (seg.toolCall.isHandback) {
      steps.push({
        type: "handback",
        label: `Handback: ${seg.toolCall.name}`,
      });
      continue;
    }
    const tool = getToolByName(seg.toolCall.name);
    if (!tool) {
      steps.push({
        type: "guardrail",
        label: "Tool guardrail fired",
        detail: `Tool "${seg.toolCall.name}" not in registry`,
        blocked: true,
      });
      guardrailsFired.push("gr_tool_allowlist");
      continue;
    }
    if (tool.sideEffect === "financial") {
      steps.push({
        type: "guardrail",
        label: "Step-up auth required for financial Tool",
        detail: `Tool "${tool.name}" requires step-up auth before invocation`,
      });
      guardrailsFired.push("gr_tool_allowlist");
    }
    steps.push({
      type: "tool-call",
      label: `Tool: ${tool.name}`,
      detail:
        Object.entries(seg.toolCall.args)
          .map(([k, v]) => `${k}=${tool.inputs.find((i) => i.name === k)?.pii ? "*****" : v}`)
          .join(", ") || "(no args)",
    });
  }

  // Audit always fires
  steps.push({
    type: "guardrail",
    label: "Safe AI audit logged",
    detail: "what / why / what data / how recorded to append-only audit log",
  });
  guardrailsFired.push("gr_audit_full_trace");

  if (sa.id === "subagent_authentication") {
    finalResponse = "You're verified. How can I help with your account today?";
  } else if (sa.id === "subagent_account_services") {
    finalResponse = "Your available balance is $1,842.55 (current $1,850.00). Anything else?";
  } else if (sa.id === "subagent_loan_servicing") {
    finalResponse = "I can defer your next payment by 30 days. Confirm yes to proceed.";
  } else {
    finalResponse = "Done.";
  }

  steps.push({ type: "response", label: "Response to member", detail: finalResponse });

  return { transcript, steps, finalResponse, guardrailsFired, durationMs: Date.now() - t0 };
}

// Example transcripts for the Test Harness UI
export const sampleTranscripts = [
  "Hi, this is Maria Rodriguez. Can you tell me my checking balance?",
  "I want to skip my next loan payment - things are tight this month.",
  "What were my last few transactions on the savings account?",
  "I think someone used my card - please freeze it.",
  "How do I open a new IRA?",
];
