"use client";

import { useState } from "react";
import { runTrace, sampleTranscripts } from "@/lib/trace";
import type { Trace, TraceStep } from "@/lib/types";

export function TestHarness() {
  const [transcript, setTranscript] = useState(sampleTranscripts[0]);
  const [authenticated, setAuthenticated] = useState(false);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    // Simulate latency for affordance
    await new Promise((r) => setTimeout(r, 400));
    setTrace(runTrace(transcript, { authenticated }));
    setRunning(false);
  }

  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-4 mt-4">
      {/* Input */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">Member transcript</div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={4}
          className="w-full font-mono text-sm p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-4 mb-2">Sample transcripts</div>
        <div className="space-y-1">
          {sampleTranscripts.map((s) => (
            <button
              key={s}
              onClick={() => setTranscript(s)}
              className="w-full text-left text-xs p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              "{s}"
            </button>
          ))}
        </div>

        <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-4 mb-2">Pre-conditions</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={authenticated}
            onChange={(e) => setAuthenticated(e.target.checked)}
            className="rounded"
          />
          <span>Member is already authenticated to L2</span>
        </label>
        <div className="text-[10px] text-slate-500 mt-1 ml-6">
          When unchecked, the behavioural guardrail will pre-route to Authentication first.
        </div>

        <button
          onClick={run}
          disabled={running}
          className="mt-5 w-full px-3 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium disabled:opacity-50"
        >
          {running ? "Tracing..." : "▶ Run shadow trace"}
        </button>
        <div className="text-[10px] text-slate-500 mt-2 text-center">
          No real Tool calls. Mocked responses, full audit trace.
        </div>
      </div>

      {/* Trace output */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 min-h-[400px]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Execution trace</div>
          {trace && (
            <div className="text-[10px] text-slate-500">
              {trace.steps.length} steps · {trace.durationMs}ms · {trace.guardrailsFired.length} guardrail
              {trace.guardrailsFired.length === 1 ? "" : "s"} fired
            </div>
          )}
        </div>

        {!trace && (
          <div className="text-sm text-slate-500 mt-10 text-center">
            Pick or paste a transcript and click <strong>Run shadow trace</strong>.
            <br />
            <span className="text-xs">The author sees the guardrail in action before publish.</span>
          </div>
        )}

        {trace && (
          <>
            <div className="space-y-1 mb-4">
              {trace.steps.map((s, i) => (
                <TraceRow key={i} step={s} />
              ))}
            </div>
            <div className="p-3 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
                Final response to member
              </div>
              <div className="text-indigo-900 dark:text-indigo-100">{trace.finalResponse}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TraceRow({ step }: { step: TraceStep }) {
  const map: Record<TraceStep["type"], { icon: string; tone: string }> = {
    "intent-match": { icon: "◆", tone: "text-violet-600 dark:text-violet-400" },
    "sub-agent-invoke": { icon: "◇", tone: "text-indigo-600 dark:text-indigo-400" },
    "skill-invoke": { icon: "✦", tone: "text-sky-600 dark:text-sky-400" },
    "tool-call": { icon: "⚙", tone: "text-emerald-600 dark:text-emerald-400" },
    guardrail: { icon: "▣", tone: step.blocked ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400" },
    response: { icon: "▸", tone: "text-slate-700 dark:text-slate-300" },
    handback: { icon: "↗", tone: "text-amber-600 dark:text-amber-400" },
  };
  const m = map[step.type];

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className={`shrink-0 w-5 text-center font-mono ${m.tone}`}>{m.icon}</span>
      <div className="flex-1">
        <div className={`font-medium ${m.tone}`}>{step.label}</div>
        {step.detail && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{step.detail}</div>
        )}
      </div>
    </div>
  );
}
