"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getApiKey, isHarnessLive } from "@/lib/harness";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { section: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    section: "Mission Control",
    items: [{ href: "/", label: "Overview", icon: "▸" }],
  },
  {
    section: "Build",
    items: [
      { href: "/sub-agents", label: "Sub-agents", icon: "◇" },
      { href: "/skills", label: "Skills", icon: "✦" },
      { href: "/tools", label: "Tools", icon: "⚙" },
    ],
  },
  {
    section: "Validate",
    items: [{ href: "/test", label: "Test Harness", icon: "▶" }],
  },
  {
    section: "Deploy",
    items: [{ href: "/publish", label: "Publish", icon: "↗" }],
  },
];

const ROLES = [
  { id: "fdpm", label: "Eltropy FDPM", color: "bg-brand-500" },
  { id: "ailead", label: "CU AI Lead", color: "bg-emerald-500" },
  { id: "partner", label: "Fintech Partner", color: "bg-sky-500" },
  { id: "compliance", label: "Compliance Reviewer", color: "bg-amber-500" },
];

const SETUP_STEPS = [
  { label: "Author a Skill SOP", done: true, href: "/skills" },
  { label: "Bind to a Sub-agent scope", done: true, href: "/sub-agents" },
  { label: "Pass shadow trace", done: false, href: "/test" },
  { label: "Request Compliance review", done: false, href: "/publish" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [role, setRole] = useState("fdpm");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const currentRole = ROLES.find((r) => r.id === role)!;
  const live = isHarnessLive();
  const doneCount = SETUP_STEPS.filter((s) => s.done).length;

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
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-700 to-accent-500 flex items-center justify-center text-white text-sm font-bold">
              E
            </div>
            <div>
              <div className="font-semibold tracking-tight">Skill Builder</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Eltropy Agentic AI</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
                {group.section}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-brand-900 text-white dark:bg-accent-500 dark:text-brand-950 font-medium"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="opacity-60 w-4 text-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Get-to-publish widget — persistent across pages */}
        <div className="mx-3 mb-3 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-950/40">
          <button
            onClick={() => setSetupOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-left"
            aria-expanded={setupOpen}
          >
            <span className="flex items-center gap-2 text-xs font-medium text-brand-900 dark:text-brand-100">
              <span className="relative flex items-center justify-center w-5 h-5">
                <span className="absolute inset-0 rounded-full bg-accent-500/15" />
                <span className="text-accent-600 dark:text-accent-300 text-[10px] font-semibold">
                  {doneCount}
                </span>
              </span>
              <span>Get to publish</span>
              <span className="text-brand-500/70 dark:text-brand-300/70 font-mono text-[10px]">
                {doneCount}/{SETUP_STEPS.length}
              </span>
            </span>
            <span className="text-brand-500 dark:text-brand-300 text-xs">{setupOpen ? "▾" : "▸"}</span>
          </button>
          {setupOpen && (
            <ol className="px-2 pb-2 space-y-0.5">
              {SETUP_STEPS.map((step) => (
                <li key={step.label}>
                  <Link
                    href={step.href}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-colors hover:bg-white/70 dark:hover:bg-brand-900/40 ${
                      step.done
                        ? "text-brand-600/70 dark:text-brand-300/60 line-through decoration-1 decoration-brand-400/40"
                        : "text-brand-900 dark:text-brand-100"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shrink-0 ${
                        step.done
                          ? "bg-accent-500 text-white"
                          : "border border-brand-300 dark:border-brand-700 text-brand-400 dark:text-brand-500"
                      }`}
                    >
                      {step.done ? "✓" : ""}
                    </span>
                    <span className="flex-1">{step.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Acting as (RBAC)</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
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
