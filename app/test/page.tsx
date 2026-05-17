"use client";

import { useState } from "react";
import { TestHarness } from "@/components/TestHarness";
import { ChatHarness } from "@/components/ChatHarness";
import { VoiceHarness } from "@/components/VoiceHarness";

export default function TestPage() {
  const [mode, setMode] = useState<"trace" | "chat" | "voice">("trace");

  return (
    <div className="px-10 py-8 max-w-6xl">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Surface 4</div>
        <h1 className="text-2xl font-semibold tracking-tight">Test Harness</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
          Two modes. <strong>Shadow trace</strong> — single transcript, deterministic
          replay, used at publish gate. <strong>Chat</strong> — multi-turn conversation
          with the live agent, used for exploratory testing. Hold the mic to speak.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <TabButton active={mode === "trace"} onClick={() => setMode("trace")}>
          ▶ Shadow trace
        </TabButton>
        <TabButton active={mode === "chat"} onClick={() => setMode("chat")}>
          💬 Chat
        </TabButton>
        <TabButton active={mode === "voice"} onClick={() => setMode("voice")}>
          🎙 Voice (Live)
        </TabButton>
      </div>

      {mode === "trace" && <TestHarness />}
      {mode === "chat" && <ChatHarness />}
      {mode === "voice" && <VoiceHarness />}
    </div>
  );
}

function TabButton({
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
      className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-indigo-500 text-slate-900 dark:text-white"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
