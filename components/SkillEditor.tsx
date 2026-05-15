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

export function SkillEditor({ skill, allowedToolNames }: Props) {
  const [body, setBody] = useState(skill.body);
  const [showAllTools, setShowAllTools] = useState(false);

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
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
          <span>Preview - runtime view</span>
          <span className="text-slate-400">tool calls render as pills</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed">
          <SkillPreview segments={segments} />
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
                    ? "hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer border border-transparent hover:border-indigo-200"
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
