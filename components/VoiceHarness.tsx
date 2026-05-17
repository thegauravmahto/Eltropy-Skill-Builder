"use client";

import { useEffect, useRef, useState } from "react";
import { isHarnessLive } from "@/lib/harness";
import { startVoiceSession, type VoiceEvent, type VoiceSessionHandle } from "@/lib/voice";

interface TranscriptLine {
  role: "user" | "model";
  text: string;
  is_final: boolean;
}

interface TraceLine {
  type: "tool-call" | "guardrail" | "sub-agent";
  label: string;
  detail?: string;
  blocked?: boolean;
}

export function VoiceHarness() {
  const [authenticated, setAuthenticated] = useState(false);
  const [memberId, setMemberId] = useState("M-1001");
  const [connected, setConnected] = useState(false);
  const [talking, setTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const handleRef = useRef<VoiceSessionHandle | null>(null);
  const live = isHarnessLive();
  const transcriptEnd = useRef<HTMLDivElement>(null);

  // Space = push-to-talk
  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    }
    function onDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (!connected || isTypingTarget(e.target)) return;
      e.preventDefault();
      if (!talking) {
        setTalking(true);
        handleRef.current?.setTalking(true);
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (!connected) return;
      e.preventDefault();
      if (talking) {
        setTalking(false);
        handleRef.current?.setTalking(false);
      }
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [connected, talking]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, trace]);

  async function start() {
    setError(null);
    setTranscript([]);
    setTrace([]);
    setSessionId(null);
    const handle = await startVoiceSession({
      authenticated,
      memberId,
      onEvent: handleEvent,
      onClose: () => setConnected(false),
    });
    if (handle) {
      handleRef.current = handle;
      setConnected(true);
    }
  }

  async function stop() {
    await handleRef.current?.stop();
    handleRef.current = null;
    setConnected(false);
  }

  function handleEvent(e: VoiceEvent) {
    if (e.type === "error") {
      setError(e.message ?? "unknown error");
      return;
    }
    if (e.type === "ready") {
      if (e.session_id) setSessionId(e.session_id);
      return;
    }
    if (e.type === "transcript" && e.role && e.text) {
      setTranscript((prev) => mergeTranscript(prev, { role: e.role!, text: e.text!, is_final: Boolean(e.is_final) }));
      return;
    }
    if (e.type === "tool-call") {
      setTrace((prev) => [
        ...prev,
        {
          type: "tool-call",
          label: `⚙ ${e.name}`,
          detail: e.args ? Object.entries(e.args).map(([k, v]) => `${k}=${v}`).join(", ") : "",
        },
      ]);
      return;
    }
    if (e.type === "sub-agent") {
      setTrace((prev) => [...prev, { type: "sub-agent", label: `→ ${e.name}` }]);
      return;
    }
    if (e.type === "guardrail") {
      setTrace((prev) => [
        ...prev,
        { type: "guardrail", label: e.label ?? "▣ guardrail", detail: e.detail, blocked: true },
      ]);
      return;
    }
  }

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 mt-4 h-[640px]">
      {/* Sidebar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Voice channel</div>
        <div
          className={`text-[10px] mb-3 px-2 py-1 rounded-md border ${
            talking
              ? "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200"
              : connected
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
              : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 text-slate-500"
          }`}
        >
          {talking
            ? "🎙 RECORDING — release Space to send"
            : connected
            ? "● Connected · hold Space to talk"
            : "Disconnected"}
        </div>

        <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-2 mb-2">Pre-conditions</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={authenticated}
            onChange={(e) => setAuthenticated(e.target.checked)}
            disabled={connected}
            className="rounded"
          />
          <span>Authenticated to L2</span>
        </label>

        <div className="mt-3">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Member</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            disabled={connected}
            className="w-full px-2 py-1.5 text-xs font-mono rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
          >
            <option value="M-1001">M-1001 · Alex (L3)</option>
            <option value="M-1002">M-1002 · Priya (L2)</option>
            <option value="M-1003">M-1003 · Marcus</option>
            <option value="M-1004">M-1004 · Linda (L3)</option>
          </select>
        </div>

        {sessionId && (
          <div className="mt-3 text-[10px] font-mono text-slate-500 break-all">{sessionId}</div>
        )}

        <div className="mt-4">
          {!connected ? (
            <button
              onClick={start}
              className="w-full px-3 py-2 text-sm rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700"
            >
              ● Start voice session
            </button>
          ) : (
            <button
              onClick={stop}
              className="w-full px-3 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium"
            >
              ◼ Stop
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-md border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <div className="mt-5 text-[10px] text-slate-500 leading-relaxed">
          <strong>Hold <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">Space</kbd> to talk · release to send.</strong>
          <br />Model: <code className="font-mono">gemini-3.1-flash-live-preview</code> · PCM16 16 kHz up / 24 kHz down.
          Same tools / guardrails as text. Server-side VAD off (push-to-talk only).
        </div>
      </div>

      {/* Transcript + trace */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Voice transcript & trace</div>
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
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {transcript.length === 0 && trace.length === 0 && (
            <div className="text-center text-sm text-slate-500 mt-12">
              Click <strong>Start voice session</strong> and speak.
              <br />
              <span className="text-xs">
                Try: <em>"Hi this is Alex M-1001, can you check my balance on A-3001?"</em>
              </span>
            </div>
          )}

          {transcript.map((t, i) => (
            <div key={`t${i}`} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${
                  t.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                } ${t.is_final ? "" : "italic opacity-80"}`}
              >
                <div className="whitespace-pre-wrap">{t.text}</div>
              </div>
            </div>
          ))}

          {trace.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Trace</div>
              {trace.map((s, i) => (
                <div key={`s${i}`} className="text-[11px] font-mono">
                  <span className={s.blocked ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}>
                    {s.label}
                  </span>
                  {s.detail && <span className="text-slate-500"> — {s.detail.slice(0, 140)}</span>}
                </div>
              ))}
            </div>
          )}

          <div ref={transcriptEnd} />
        </div>
      </div>
    </div>
  );
}

function mergeTranscript(prev: TranscriptLine[], next: TranscriptLine): TranscriptLine[] {
  // If the last line is from the same role and was non-final, replace it with the new
  // (longer) text. Otherwise append a new line.
  const last = prev[prev.length - 1];
  if (last && last.role === next.role && !last.is_final) {
    return [...prev.slice(0, -1), next];
  }
  return [...prev, next];
}
