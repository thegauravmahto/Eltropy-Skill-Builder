"use client";

import { useMemo, useState } from "react";
import { lintBody, parseBody, autocompleteTools } from "@/lib/parser";
import { ToolCallPill, SideEffectBadge } from "@/components/ToolCallPill";
import { getToolByName, tools as allTools } from "@/lib/seed";
import type { Skill } from "@/lib/types";

interface Props {
  skill: Skill;
  allowedToolNames: string[]; // computed from the bound sub-agent's scope
}

type PreviewMode = "member" | "trace";
type Persona = { id: string; label: string; auth: "unauth" | "L2" | "L3" };

const PERSONAS: Persona[] = [
  { id: "M-1001", label: "Alex Chen · L3 (eligible loan)", auth: "L3" },
  { id: "M-1002", label: "Priya Patel · L2 (mortgage)", auth: "L2" },
  { id: "M-1003", label: "Marcus Johnson · unauthed", auth: "unauth" },
];

export function SkillEditor({ skill, allowedToolNames }: Props) {
  const [body, setBody] = useState(skill.body);
  const [showAllTools, setShowAllTools] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("member");
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);

  const segments = useMemo(() => parseBody(body), [body]);
  const lint = useMemo(() => lintBody(body, allowedToolNames), [body, allowedToolNames]);
  const tools = autocompleteTools(allowedToolNames);

  const errorCount = lint.filter((l) => l.severity === "error").length;
  const warnCount = lint.filter((l) => l.severity === "warning").length;

  function insertToolCall(name: string) {
    const tool = getToolByName(name);
    if (!tool) return;
    const params = tool.inputs
      .filter((i) => i.required)
      .map((i) => `${i.name}=$${i.name}`)
      .join(", ");
    const insert = `{{tool: ${name}${params ? `(${params})` : "()"}}}`;
    setBody((prev) => prev + (prev.endsWith("\n") ? "" : "\n") + insert);
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_240px] gap-4 mt-4 h-[calc(100vh-220px)] min-h-[500px]">
      {/* Editor pane */}
      <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
          <span>Skill SOP (Markdown)</span>
          <div className="flex items-center gap-3">
            <span className={errorCount > 0 ? "text-rose-600" : "text-emerald-600"}>
              ● {errorCount === 0 ? "lint clean" : `${errorCount} error${errorCount > 1 ? "s" : ""}`}
            </span>
            {warnCount > 0 && <span className="text-amber-600">⚠ {warnCount}</span>}
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          className="flex-1 p-4 font-mono text-sm bg-transparent outline-none resize-none leading-relaxed text-slate-800 dark:text-slate-100"
        />
        {lint.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
            {lint.map((l, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 ${
                  l.severity === "error" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"
                }`}
              >
                <span className="font-mono opacity-60 shrink-0">L{l.line}</span>
                <span>{l.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview pane */}
      <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-3 pt-2 pb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">Testing as</span>
              <select
                value={persona.id}
                onChange={(e) => setPersona(PERSONAS.find((p) => p.id === e.target.value) ?? PERSONAS[0])}
                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-brand-500 truncate"
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <span
              className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                persona.auth === "unauth"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              }`}
            >
              {persona.auth}
            </span>
          </div>
          <div className="flex items-center gap-1 px-2">
            <PreviewTab active={previewMode === "member"} onClick={() => setPreviewMode("member")}>
              Member view
            </PreviewTab>
            <PreviewTab active={previewMode === "trace"} onClick={() => setPreviewMode("trace")}>
              Shadow trace
            </PreviewTab>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed">
          {previewMode === "member" ? (
            <SkillPreview segments={segments} />
          ) : (
            <TracePreview segments={segments} persona={persona} />
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
          {previewMode === "member"
            ? "Tool calls render as pills — the SOP looks the way it executes."
            : "Deterministic shadow trace. No real Tool calls; guardrails fire as they would in prod."}
        </div>
      </div>

      {/* Tool palette */}
      <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
          <span>Tools (palette)</span>
          <button
            className="text-[10px] underline opacity-70 hover:opacity-100"
            onClick={() => setShowAllTools((v) => !v)}
          >
            {showAllTools ? "scope only" : "show all"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(showAllTools ? allTools.map((t) => t.name) : tools).map((name) => {
            const t = getToolByName(name)!;
            const allowed = tools.includes(name);
            return (
              <button
                key={name}
                onClick={() => (allowed ? insertToolCall(name) : null)}
                disabled={!allowed}
                title={t.description}
                className={`w-full text-left p-2 rounded-md text-xs ${
                  allowed
                    ? "hover:bg-brand-50 dark:hover:bg-brand-950/30 cursor-pointer border border-transparent hover:border-brand-200"
                    : "opacity-50 cursor-not-allowed border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium truncate">{t.name}</span>
                  <SideEffectBadge kind={t.sideEffect} />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
                {!allowed && (
                  <div className="text-[9px] uppercase tracking-wide text-rose-600 mt-1">
                    out of scope - blocked
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
          Click a Tool to insert its call at cursor. Out-of-scope Tools are dimmed so they cannot be summoned by typo.
        </div>
      </div>
    </div>
  );
}

function PreviewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-brand-700 text-brand-900 dark:border-accent-500 dark:text-accent-300"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function TracePreview({
  segments,
  persona,
}: {
  segments: ReturnType<typeof parseBody>;
  persona: Persona;
}) {
  const toolSegments = segments.filter((s) => s.type === "toolcall" && s.toolCall);
  const needsAuth = persona.auth === "unauth";

  return (
    <div className="space-y-1 font-mono text-[11px]">
      <TraceRow
        icon="◆"
        tone="text-accent-600 dark:text-accent-300"
        label="intent matched"
        detail={`route → this Skill (persona ${persona.id})`}
      />
      {needsAuth && (
        <TraceRow
          icon="▣"
          tone="text-rose-600 dark:text-rose-400"
          label="behavioural guardrail blocked"
          detail="persona unauthenticated · pre-route to Authentication sub-agent"
        />
      )}
      {!needsAuth &&
        toolSegments.map((s, i) => {
          const t = s.toolCall ? getToolByName(s.toolCall.name) : null;
          return (
            <TraceRow
              key={i}
              icon="⚙"
              tone={
                t?.sideEffect === "financial"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
              label={`tool: ${s.toolCall?.name}`}
              detail={
                t
                  ? `${t.sideEffect} · ${t.requiredScopes.join(", ") || "no scopes"}`
                  : "out-of-scope"
              }
            />
          );
        })}
      {!needsAuth && toolSegments.length === 0 && (
        <div className="text-slate-500 italic">No tool calls in this SOP — pure conversational response.</div>
      )}
      {!needsAuth && (
        <TraceRow
          icon="▸"
          tone="text-slate-700 dark:text-slate-300"
          label="response sent to member"
          detail={`${toolSegments.length} tool call${toolSegments.length === 1 ? "" : "s"} · all guardrails passed`}
        />
      )}
    </div>
  );
}

function TraceRow({
  icon,
  tone,
  label,
  detail,
}: {
  icon: string;
  tone: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className={`shrink-0 w-4 text-center ${tone}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className={tone}>{label}</div>
        {detail && <div className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}

function SkillPreview({ segments }: { segments: ReturnType<typeof parseBody> }) {
  // Render text segments with very light Markdown handling (headings, ordered lists)
  const out: React.ReactNode[] = [];
  let textBuffer = "";

  function flushText(key: string) {
    if (!textBuffer) return;
    out.push(renderMarkdown(textBuffer, key));
    textBuffer = "";
  }

  segments.forEach((seg, i) => {
    if (seg.type === "text") {
      textBuffer += seg.content;
    } else if (seg.toolCall) {
      flushText(`t${i}`);
      out.push(
        <span key={`p${i}`} className="inline-block mx-0.5 align-baseline">
          <ToolCallPill call={seg.toolCall} />
        </span>
      );
    }
  });
  flushText("t-end");
  return <div className="prose-sm">{out}</div>;
}

function renderMarkdown(text: string, key: string): React.ReactNode {
  // Minimal MD: headings (# / ##), ordered list lines, paragraphs
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (/^\s*#\s+/.test(line)) {
      elements.push(
        <h2 key={`${key}-${idx}`} className="text-base font-semibold mt-3 mb-2">
          {line.replace(/^\s*#\s+/, "")}
        </h2>
      );
    } else if (/^\s*##\s+/.test(line)) {
      elements.push(
        <h3 key={`${key}-${idx}`} className="text-sm font-semibold mt-3 mb-2 text-slate-700 dark:text-slate-300">
          {line.replace(/^\s*##\s+/, "")}
        </h3>
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const num = line.match(/^\s*(\d+)\./)?.[1];
      const rest = line.replace(/^\s*\d+\.\s+/, "");
      elements.push(
        <div key={`${key}-${idx}`} className="flex gap-2 my-1">
          <span className="text-slate-400 font-mono w-5 text-right shrink-0">{num}.</span>
          <span>{rest}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`${key}-${idx}`} className="h-2" />);
    } else {
      elements.push(
        <p key={`${key}-${idx}`} className="my-1">
          {line}
        </p>
      );
    }
  });
  return <div key={key}>{elements}</div>;
}
