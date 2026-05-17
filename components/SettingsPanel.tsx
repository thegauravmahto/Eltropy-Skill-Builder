"use client";

import { useEffect, useState } from "react";
import {
  clearApiKey,
  getApiKey,
  getHarnessUrl,
  isHarnessLive,
  setApiKey,
} from "@/lib/harness";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [keyDraft, setKeyDraft] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const existing = getApiKey();
    setHasKey(Boolean(existing));
    setKeyDraft(existing ?? "");
  }, [open]);

  if (!open) return null;

  const harnessUrl = getHarnessUrl();
  const live = isHarnessLive();

  function save() {
    if (keyDraft.trim()) {
      setApiKey(keyDraft.trim());
      setHasKey(true);
    }
  }

  function remove() {
    clearApiKey();
    setKeyDraft("");
    setHasKey(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40" onClick={onClose} />
      <div className="w-[420px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Harness</div>
            <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 overflow-y-auto">
          {/* Backend status */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
              Harness backend
            </div>
            <div
              className={`p-3 rounded-md border text-xs ${
                live
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                  : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400"
              }`}
            >
              {live ? (
                <>
                  <div className="font-medium">Live ADK backend</div>
                  <div className="font-mono text-[10px] mt-1 break-all">{harnessUrl}</div>
                </>
              ) : (
                <>
                  <div className="font-medium">Mocked traces (v1)</div>
                  <div className="mt-1">
                    Set <code className="font-mono">NEXT_PUBLIC_HARNESS_URL</code> to point at your
                    local Python harness (default <code className="font-mono">http://localhost:8787</code>).
                  </div>
                </>
              )}
            </div>
          </section>

          {/* API key */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">
                Gemini API key
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  hasKey
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                }`}
              >
                {hasKey ? "key set" : "missing"}
              </span>
            </div>

            <input
              type={reveal ? "text" : "password"}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="AIza..."
              className="w-full font-mono text-xs p-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reveal}
                  onChange={(e) => setReveal(e.target.checked)}
                />
                Reveal
              </label>
              <div className="flex gap-2">
                {hasKey && (
                  <button
                    onClick={remove}
                    className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={!keyDraft.trim() || keyDraft.trim() === getApiKey()}
                  className="text-xs px-3 py-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Get a free key from{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted"
              >
                aistudio.google.com/apikey
              </a>
              . Stored only in this browser (localStorage). Sent as{" "}
              <code className="font-mono">X-Gemini-Key</code> header per request — backend instantiates
              a new client per call and never persists it.
            </div>
          </section>

          {/* Model info */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Model</div>
            <div className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs">
              <div className="font-mono">gemini-3-flash-preview</div>
              <div className="text-slate-500 mt-1">
                Thinking level: <code className="font-mono">minimal</code> · AI Studio (free tier)
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
