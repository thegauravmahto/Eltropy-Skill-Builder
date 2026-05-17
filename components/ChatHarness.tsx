"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isHarnessLive } from "@/lib/harness";
import { runLiveTrace } from "@/lib/harnessClient";
import { createRecognizer, isSpeechSupported } from "@/lib/speech";
import type { TraceStep } from "@/lib/types";

const STARTER_SUGGESTIONS = [
  "Hi this is Alex M-1001, can you check my balance on A-3001?",
  "I want to skip my next loan payment on L-2001.",
  "What were my last 5 transactions on A-3001?",
  "Please lock my card C-4001 — I think I lost it.",
  "How do I open an IRA?",
];

function followUpSuggestions(lastAgentText: string): string[] {
  const t = lastAgentText.toLowerCase();
  if (t.includes("balance")) {
    return ["Show my last 5 transactions on that account.", "What was my largest transaction this month?"];
  }
  if (t.includes("verified") || t.includes("verify") || t.includes("identity")) {
    return ["My checking balance please.", "Recent transactions on A-3001."];
  }
  if (t.includes("deferred") || t.includes("skip") || t.includes("payment")) {
    return ["Confirm the new due date.", "Are there any fees for skipping?"];
  }
  if (t.includes("locked") || t.includes("card")) {
    return ["What's my balance now?", "Can you send a replacement card?"];
  }
  if (t.includes("out of scope") || t.includes("cannot help")) {
    return ["Connect me to a human agent.", "What can you help me with?"];
  }
  return ["What else can you help with?", "Show recent activity on my checking account."];
}

interface ChatTurn {
  role: "user" | "agent";
  text: string;
  steps?: TraceStep[];
  guardrailsFired?: string[];
  durationMs?: number;
}

export function ChatHarness() {
  const [authenticated, setAuthenticated] = useState(false);
  const [memberId, setMemberId] = useState("M-1001");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceOk, setVoiceOk] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const recRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const live = isHarnessLive();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoiceOk(isSpeechSupported());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interim]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    setRunning(true);
    setDraft("");

    const userTurn: ChatTurn = { role: "user", text: trimmed };
    const agentTurn: ChatTurn = { role: "agent", text: "", steps: [], guardrailsFired: [] };
    setTurns((prev) => [...prev, userTurn, agentTurn]);

    // Track which steps we've already applied for this turn so React's strict-mode
    // double-invocation of state setters doesn't append the same step twice.
    const appliedSteps = new Set<string>();
    let stepCounter = 0;

    await runLiveTrace(
      trimmed,
      { authenticated, memberId, sessionId: sessionId ?? undefined },
      {
        onStep: (step) => {
          const key = `${stepCounter++}|${step.type}|${step.label}`;
          if (appliedSteps.has(key)) return;
          appliedSteps.add(key);
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            const updated: ChatTurn = {
              ...last,
              steps: [...(last.steps ?? []), step],
              guardrailsFired:
                step.type === "guardrail"
                  ? [...(last.guardrailsFired ?? []), step.label]
                  : last.guardrailsFired,
              text: step.type === "response" ? step.detail ?? last.text : last.text,
            };
            return [...prev.slice(0, -1), updated];
          });
        },
        onSummary: (s) => {
          if (s.sessionId) setSessionId(s.sessionId);
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            const updated: ChatTurn = {
              ...last,
              durationMs: s.durationMs,
              text: s.finalResponse || last.text,
              guardrailsFired: s.guardrailsFired.length ? s.guardrailsFired : last.guardrailsFired,
            };
            return [...prev.slice(0, -1), updated];
          });
        },
        onError: (msg) => {
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            return [...prev.slice(0, -1), { ...last, text: `⚠ ${msg}` }];
          });
        },
      }
    );
    setRunning(false);
  }

  function startRecording() {
    if (!voiceOk || recording) return;
    recRef.current = createRecognizer({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setInterim("");
        setRecording(false);
        send(t);
      },
      onError: () => {
        setInterim("");
        setRecording(false);
      },
    });
    if (recRef.current) {
      recRef.current.start();
      setRecording(true);
    }
  }

  function stopRecording() {
    if (recRef.current && recording) {
      recRef.current.stop();
      setRecording(false);
    }
  }

  function reset() {
    setTurns([]);
    setSessionId(null);
    setExpanded(new Set());
    setInterim("");
  }

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 mt-4 h-[640px]">
      {/* Sidebar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Pre-conditions</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={authenticated}
            onChange={(e) => setAuthenticated(e.target.checked)}
            className="rounded"
          />
          <span>Member authenticated to L2</span>
        </label>

        <div className="mt-3">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
            Member (mock fixtures)
          </label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <option value="M-1001">M-1001 · Alex Chen (L3)</option>
            <option value="M-1002">M-1002 · Priya Patel (L2)</option>
            <option value="M-1003">M-1003 · Marcus Johnson (unauthed)</option>
            <option value="M-1004">M-1004 · Linda Okafor (L3)</option>
          </select>
        </div>

        <div className="mt-4 text-[11px] uppercase tracking-wider text-slate-500 mb-2">Session</div>
        <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">
          {sessionId ?? "new (will be created on first message)"}
        </div>
        <button
          onClick={reset}
          disabled={turns.length === 0}
          className="mt-3 w-full px-2 py-1.5 text-xs rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset conversation
        </button>

        <div className="mt-5 text-[10px] text-slate-500 leading-relaxed">
          Multi-turn conversation reuses the ADK session, so the agent remembers
          earlier turns. Click any agent reply to expand the full trace + guardrail
          events.
        </div>
      </div>

      {/* Chat area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Chat with agent</div>
            <span
              className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-medium ${
                live
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {live ? "Live ADK" : "Mocked"}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">{turns.filter((t) => t.role === "user").length} turn(s)</div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {turns.length === 0 && (
            <div className="text-center text-sm text-slate-500 mt-12">
              Start chatting with the agent.
              <br />
              <span className="text-xs">
                Try: <em>"Hi this is Alex M-1001, can you check my balance on A-3001?"</em>
              </span>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${
                  t.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              >
                {t.role === "user" ? (
                  <div className="whitespace-pre-wrap">{t.text}</div>
                ) : (
                  <div className="markdown-body">
                    {t.text ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.text}</ReactMarkdown>
                    ) : running ? (
                      <span className="italic text-slate-500">…</span>
                    ) : null}
                  </div>
                )}
                {t.role === "agent" && (t.steps?.length ?? 0) > 0 && (
                  <button
                    onClick={() => toggle(i)}
                    className="mt-2 text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 underline decoration-dotted"
                  >
                    {expanded.has(i) ? "Hide trace" : `Show trace (${t.steps?.length} steps · ${t.durationMs ?? 0}ms)`}
                  </button>
                )}
                {t.role === "agent" && expanded.has(i) && (
                  <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                    {t.steps?.map((s, j) => (
                      <div key={j} className="text-[11px] font-mono">
                        <span className={s.blocked ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}>
                          {s.label}
                        </span>
                        {s.detail && (
                          <span className="text-slate-500 dark:text-slate-400"> — {s.detail.slice(0, 140)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {recording && (
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-lg px-3 py-2 text-sm bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-100 italic">
                🎙 {interim || "Listening..."}
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {(() => {
          const lastAgent = [...turns].reverse().find((t) => t.role === "agent" && t.text);
          const suggestions = lastAgent
            ? followUpSuggestions(lastAgent.text)
            : turns.length === 0
            ? STARTER_SUGGESTIONS
            : [];
          if (suggestions.length === 0) return null;
          return (
            <div className="px-3 pt-3 pb-1 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                {lastAgent ? "Follow-ups" : "Try"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={running}
                    className="text-[11px] px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Input */}
        <div className="px-3 pb-3 pt-2 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            placeholder="Type a message or hold the mic to speak..."
            className="flex-1 text-sm p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            disabled={running}
          />
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={!voiceOk || running}
            title={voiceOk ? "Hold to speak" : "Voice not supported in this browser"}
            className={`shrink-0 w-10 h-10 rounded-md font-medium select-none transition-colors ${
              recording
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {recording ? "●" : "🎙"}
          </button>
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim() || running}
            className="shrink-0 px-3 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
