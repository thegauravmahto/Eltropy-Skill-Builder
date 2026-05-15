// Parse Skill body Markdown to extract and render tool calls
// Saahil's syntax: {{tool: name(arg1=val1, arg2=val2)}} and {{handback: orchestrator}}

import { getToolByName, tools as allTools } from "./seed";

export interface ParsedToolCall {
  raw: string;
  name: string;
  args: Record<string, string>;
  isHandback: boolean;
  isUnknown: boolean;
  isOutOfScope?: boolean;
}

export interface ParsedSegment {
  type: "text" | "toolcall";
  content: string;
  toolCall?: ParsedToolCall;
}

const TOOL_CALL_RE = /\{\{(tool|handback):\s*([a-zA-Z_][\w]*)(?:\(([^)]*)\))?\}\}/g;

export function parseToolCall(raw: string): ParsedToolCall | null {
  // Reset regex state for single-match parse
  const re = /\{\{(tool|handback):\s*([a-zA-Z_][\w]*)(?:\(([^)]*)\))?\}\}/;
  const m = re.exec(raw);
  if (!m) return null;
  const kind = m[1];
  const name = m[2];
  const argsStr = m[3] || "";
  const args: Record<string, string> = {};
  if (argsStr) {
    argsStr.split(",").forEach((pair) => {
      const [k, v] = pair.split("=").map((s) => s.trim());
      if (k) args[k] = v || "";
    });
  }
  const isHandback = kind === "handback";
  const isUnknown = !isHandback && !getToolByName(name);
  return { raw, name, args, isHandback, isUnknown };
}

export function parseBody(body: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;
  TOOL_CALL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOOL_CALL_RE.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: body.slice(lastIndex, match.index) });
    }
    const tc = parseToolCall(match[0]);
    if (tc) {
      segments.push({ type: "toolcall", content: match[0], toolCall: tc });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", content: body.slice(lastIndex) });
  }
  return segments;
}

export interface LintIssue {
  line: number;
  severity: "error" | "warning";
  message: string;
  toolCall?: string;
}

// Lint a Skill body against the bound sub-agent's allowed tools
export function lintBody(body: string, allowedToolNames: string[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = body.split("\n");
  lines.forEach((line, idx) => {
    const re = /\{\{(tool|handback):\s*([a-zA-Z_][\w]*)(?:\(([^)]*)\))?\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const m = match;
      const raw = m[0];
      const kind = m[1];
      const name = m[2];
      if (kind === "handback") continue;
      const tool = getToolByName(name);
      if (!tool) {
        issues.push({
          line: idx + 1,
          severity: "error",
          message: `Undefined Tool reference: "${name}". Not present in the Tool Registry.`,
          toolCall: raw,
        });
        continue;
      }
      if (allowedToolNames.length > 0 && !allowedToolNames.includes(name)) {
        issues.push({
          line: idx + 1,
          severity: "error",
          message: `Out-of-scope Tool: "${name}" is not on this sub-agent's allowlist.`,
          toolCall: raw,
        });
      }
      // Check required params
      const argsStr = m[3] || "";
      const provided = new Set(
        argsStr
          .split(",")
          .map((p) => p.split("=")[0]?.trim())
          .filter(Boolean) as string[]
      );
      tool.inputs.forEach((input) => {
        if (input.required && !provided.has(input.name)) {
          issues.push({
            line: idx + 1,
            severity: "warning",
            message: `Tool "${name}" missing required param: ${input.name}`,
            toolCall: raw,
          });
        }
      });
    }
  });
  return issues;
}

// Build the autocomplete list of allowed Tools for a sub-agent's scope
export function autocompleteTools(allowedToolNames: string[]): string[] {
  if (allowedToolNames.length === 0) return allTools.map((t) => t.name);
  return allTools.filter((t) => allowedToolNames.includes(t.name)).map((t) => t.name);
}
