"use client";

import Link from "next/link";
import { useState } from "react";
import { skills, subAgents, tools, guardrails, getSkill, getGuardrail } from "@/lib/seed";

type Tab = "active" | "drafts" | "concepts";

export default function Home() {
  const [tab, setTab] = useState<Tab>("active");

  const publishedSubAgents = subAgents.filter((s) => s.status === "published");
  const draftSubAgents = subAgents.filter((s) => s.status === "draft");
  const publishedSkills = skills.filter((s) => s.status === "published");
  const draftSkills = skills.filter((s) => s.status === "draft");
  const financialTools = tools.filter((t) => t.sideEffect === "financial").length;

  // Mocked operational KPIs (Mission Control wants vital signs, not seed counts)
  const guardrailPassRate = 98.7;
  const traceCoverage = `${publishedSubAgents.length}/${subAgents.length}`;
  const toolSuccess = 99.2;

  const kpis = [
    {
      label: "Guardrail pass-rate",
      value: `${guardrailPassRate}%`,
      sub: "last 24h · all sub-agents",
      action: { label: "Guardrails", href: "/sub-agents" },
      tooltip: "Fraction of agent turns that satisfied every bound Guardrail Set.",
      tone: "ok" as const,
    },
    {
      label: "Trace coverage",
      value: traceCoverage,
      sub: "sub-agents with passing regression set",
      action: { label: "Run trace", href: "/test" },
      tooltip: "Sub-agents with a shadow-trace pass in the last release.",
      tone: traceCoverage.startsWith(`${subAgents.length}`) ? ("ok" as const) : ("warn" as const),
    },
    {
      label: "Tool-call success",
      value: `${toolSuccess}%`,
      sub: `${tools.length} Tools · ${financialTools} financial`,
      action: { label: "Tools", href: "/tools" },
      tooltip: "Tool invocations that returned within budget and passed output schema.",
      tone: "ok" as const,
    },
    {
      label: "Active Sub-agents",
      value: publishedSubAgents.length,
      sub: `${draftSubAgents.length} draft · routes member intent`,
      action: { label: "Sub-agents", href: "/sub-agents" },
      tooltip: "Published sub-agents the Main Orchestrator can route to right now.",
      tone: "ok" as const,
    },
    {
      label: "Skills published",
      value: publishedSkills.length,
      sub: `${draftSkills.length} draft · ${guardrails.length} guardrail sets`,
      action: { label: "Skills", href: "/skills" },
      tooltip: "Immutable Skill versions live in tenant.",
      tone: "ok" as const,
    },
  ];

  const tabs: { id: Tab; label: string; count?: string }[] = [
    { id: "active", label: "Active sub-agents", count: `${publishedSubAgents.length} Live` },
    { id: "drafts", label: "Drafts", count: `${draftSkills.length + draftSubAgents.length}` },
    { id: "concepts", label: "Concepts" },
  ];

  return (
    <div className="px-10 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-brand-600 dark:text-accent-300 mb-1 font-medium">
            Mission Control · Brookline FCU
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Skill Builder</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1.5 max-w-2xl text-sm leading-relaxed">
            Closed, controlled agency for credit union AI. Author Skills, bind them to Sub-agents,
            ship under a Guardrail Policy. The Main Orchestrator routes member intents here.
          </p>
        </div>
        <Link
          href="/skills"
          className="px-3 py-1.5 text-sm rounded-md bg-brand-900 text-white dark:bg-accent-500 dark:text-brand-950 font-medium hover:opacity-90 shrink-0"
        >
          + New Skill
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col"
          >
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-500">
              <span>{k.label}</span>
              <span title={k.tooltip} className="cursor-help opacity-50">
                ⓘ
              </span>
            </div>
            <div
              className={`text-2xl font-semibold mt-1 tabular-nums ${
                k.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-brand-900 dark:text-slate-100"
              }`}
            >
              {k.value}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex-1">{k.sub}</div>
            <Link
              href={k.action.href}
              className="mt-2 inline-flex items-center gap-1 self-start text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-100 hover:text-brand-900 dark:hover:bg-brand-900 dark:hover:text-white transition-colors"
            >
              <span>→</span>
              <span>{k.action.label}</span>
            </Link>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-4">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                active
                  ? "border-brand-700 text-brand-900 dark:border-accent-500 dark:text-accent-300"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span>{t.label}</span>
              {t.count && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums ${
                    t.id === "active" && active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "active" && <ActiveSubAgentsTab subAgents={publishedSubAgents} />}
      {tab === "drafts" && <DraftsTab />}
      {tab === "concepts" && <ConceptsTab />}
    </div>
  );
}

function ActiveSubAgentsTab({ subAgents: list }: { subAgents: typeof subAgents }) {
  if (list.length === 0) {
    return (
      <EmptyState
        title="No sub-agents live yet"
        body="Author a Skill, bind it to a Sub-agent, pass the shadow trace, and request review."
        cta={{ href: "/sub-agents", label: "Browse Sub-agents →" }}
      />
    );
  }
  return (
    <div className="space-y-2">
      {list.map((sa) => {
        const boundSkills = sa.boundSkills.map(getSkill).filter(Boolean);
        const gs = sa.guardrailIds.map(getGuardrail).filter(Boolean);
        return (
          <Link
            key={sa.id}
            href={`/sub-agents/${sa.id}`}
            className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-brand-400 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{sa.name}</span>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                    Live · v{sa.version}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{sa.scopeDomain}</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{sa.description}</div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{boundSkills.length}</span> Skills
                </div>
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{gs.length}</span> Guardrails
                </div>
                <div className="font-mono text-[10px]">
                  {sa.lastTestPassAt ? `pass ${new Date(sa.lastTestPassAt).toLocaleDateString()}` : "never tested"}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function DraftsTab() {
  const dSkills = skills.filter((s) => s.status === "draft" || s.status === "in-review");
  const dSubs = subAgents.filter((s) => s.status === "draft" || s.status === "in-review");
  if (dSkills.length === 0 && dSubs.length === 0) {
    return <EmptyState title="No drafts" body="Everything in this tenant is live." />;
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Skills · {dSkills.length}</div>
        <div className="space-y-1">
          {dSkills.map((s) => (
            <Link
              key={s.id}
              href={`/skills/${s.id}`}
              className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 hover:border-brand-400 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-[10px] font-mono text-slate-500">v{s.version}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{s.description}</div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                <span className={s.regressionPass ? "text-emerald-600" : "text-amber-600"}>
                  {s.regressionPass ? "✓ regressions" : "⚠ regressions"}
                </span>
                <span className={s.lintErrors === 0 ? "text-emerald-600" : "text-rose-600"}>
                  {s.lintErrors === 0 ? "✓ lint" : `${s.lintErrors} lint`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Sub-agents · {dSubs.length}</div>
        <div className="space-y-1">
          {dSubs.map((sa) => (
            <Link
              key={sa.id}
              href={`/sub-agents/${sa.id}`}
              className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 hover:border-brand-400 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{sa.name}</span>
                <span className="text-[10px] uppercase text-amber-600">{sa.status}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {sa.boundSkills.length} bound Skills · {sa.guardrailIds.length} Guardrails
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConceptsTab() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <Card title="Three-layer composition">
        <div className="font-mono text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
          <div>
            <span className="text-accent-600 dark:text-accent-300">Sub-agent</span> ::= role + intent-routing + skill bundle + guardrail policy
          </div>
          <div>
            <span className="text-brand-600 dark:text-brand-300">Skill</span> ::= Markdown SOP + tool calls (
            <code>{`{{tool: …}}`}</code>)
          </div>
          <div>
            <span className="text-sky-600 dark:text-sky-400">Tool</span> ::= named, schema-typed wrapper over one API
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          One Tool wraps one API. One Skill composes 1–N Tools. One Sub-agent binds 1–N Skills within a scope
          (e.g. <em>loans-and-payments-and-services and nothing else</em>).
        </div>
      </Card>

      <Card title="Grading metrics">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-accent-500 mt-0.5">●</span>
            <div>
              <strong>Guardrails</strong>
              <div className="text-xs text-slate-500">First-class objects. Scope, tool, data, behavioural, audit.</div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-500 mt-0.5">●</span>
            <div>
              <strong>Usability</strong>
              <div className="text-xs text-slate-500">Time to first published Skill &lt; 30 min for a CU AI Lead.</div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-500 mt-0.5">●</span>
            <div>
              <strong>Affordance</strong>
              <div className="text-xs text-slate-500">
                UI signals what is possible. Bounded chip-pickers, pill-rendered tool calls, persistent financial badge.
              </div>
            </div>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center">
      <div className="text-base font-medium text-slate-800 dark:text-slate-200">{title}</div>
      <div className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">{body}</div>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-block px-3 py-1.5 text-sm rounded-md bg-brand-900 text-white dark:bg-accent-500 dark:text-brand-950 font-medium"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">{title}</div>
      {children}
    </div>
  );
}
