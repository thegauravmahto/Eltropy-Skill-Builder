"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getApiKey, isHarnessLive } from "@/lib/harness";

const NAV = [
  { href: "/", label: "Overview", icon: "▸" },
  { href: "/sub-agents", label: "Sub-agents", icon: "◇" },
  { href: "/skills", label: "Skills", icon: "✦" },
  { href: "/tools", label: "Tools", icon: "⚙" },
  { href: "/test", label: "Test Harness", icon: "▶" },
  { href: "/publish", label: "Publish", icon: "↗" },
];

const ROLES = [
  { id: "fdpm", label: "Eltropy FDPM", color: "bg-indigo-500" },
  { id: "ailead", label: "CU AI Lead", color: "bg-emerald-500" },
  { id: "partner", label: "Fintech Partner", color: "bg-sky-500" },
  { id: "compliance", label: "Compliance Reviewer", color: "bg-amber-500" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [role, setRole] = useState("fdpm");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const currentRole = ROLES.find((r) => r.id === role)!;
  const live = isHarnessLive();

  useEffect(() => {
    function sync() {
      setHasKey(Boolean(getApiKey()));
    }
    sync();
    window.addEventListener("skill_builder.api_key_changed", sync);
    return () => window.removeEventListener("skill_builder.api_key_changed", sync);
  }, []);

  return (
    <div className="flex h-full min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
              E
            </div>
            <div>
              <div className="font-semibold tracking-tight">Skill Builder</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Eltropy Agentic AI</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="opacity-50 w-4 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Acting as (RBAC)</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${currentRole.color}`} />
              <span>Demo tenant - Brookline FCU</span>
            </div>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-1.5">
              <span className="opacity-60">⚙</span>
              <span>Harness · Gemini key</span>
            </span>
            <span className="flex items-center gap-1">
              <span
                title={live ? "Live ADK backend" : "Mocked traces"}
                className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`}
              />
              <span
                title={hasKey ? "key set" : "key missing"}
                className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
