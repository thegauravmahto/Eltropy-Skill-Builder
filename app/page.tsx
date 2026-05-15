import Link from "next/link";
import { skills, subAgents, tools, guardrails } from "@/lib/seed";

export default function Home() {
  const published = subAgents.filter((s) => s.status === "published").length;
  const drafts = subAgents.filter((s) => s.status === "draft").length;
  const financialTools = tools.filter((t) => t.sideEffect === "financial").length;

  const stats = [
    { label: "Sub-agents", value: subAgents.length, sub: `${published} published, ${drafts} draft` },
    { label: "Skills", value: skills.length, sub: `${skills.filter((s) => s.status === "published").length} published` },
    { label: "Tools", value: tools.length, sub: `${financialTools} financial side-effect` },
    { label: "Guardrail Sets", value: guardrails.length, sub: "scope · tool · data · behavioural · audit" },
  ];

  return (
    <div className="px-10 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Mission Control</div>
        <h1 className="text-3xl font-semibold tracking-tight">Skill Builder</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
          Authoring layer for the Eltropy Agentic AI Platform. Compose <strong>Tools</strong> into{" "}
          <strong>Skills</strong>; bind Skills to <strong>Sub-agents</strong> with closed, controlled agency. The Main
          Orchestrator routes member intents to the sub-agents you publish here.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
          >
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
            <div className="text-[11px] text-slate-500 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Three-layer composition">
          <div className="font-mono text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <div>
              <span className="text-violet-600 dark:text-violet-400">Sub-agent</span> ::= role + intent-routing + skill bundle + guardrail policy
            </div>
            <div>
              <span className="text-indigo-600 dark:text-indigo-400">Skill</span> ::= Markdown SOP + tool calls (
              <code>{`{{tool: …}}`}</code>)
            </div>
            <div>
              <span className="text-sky-600 dark:text-sky-400">Tool</span> ::= named, schema-typed wrapper over one API
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            One Tool wraps one API. One Skill composes 1-N Tools. One Sub-agent binds 1-N Skills within a scope (e.g.{" "}
            <em>loans-and-payments-and-services and nothing else</em>).
          </div>
        </Card>

        <Card title="Grading metrics">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">●</span>
              <div>
                <strong>Guardrails</strong>
                <div className="text-xs text-slate-500">First-class objects. Scope, tool, data, behavioural, audit.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">●</span>
              <div>
                <strong>Usability</strong>
                <div className="text-xs text-slate-500">Time to first published Skill &lt; 30 min for a CU AI Lead.</div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">●</span>
              <div>
                <strong>Affordance</strong>
                <div className="text-xs text-slate-500">
                  UI signals what is possible. Bounded chip-pickers, pill-rendered tool calls, persistent financial
                  badge.
                </div>
              </div>
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-8">
        <Card title="Quick start">
          <div className="grid grid-cols-3 gap-3 mt-1">
            <QuickLink href="/sub-agents" label="Browse Sub-agents" sub="Authentication, Account Services, Loan Servicing" />
            <QuickLink href="/skills" label="Open the Skill Editor" sub="Two-pane Markdown + pill-rendered tool calls" />
            <QuickLink href="/test" label="Run the Test Harness" sub="Paste a member transcript, see the trace" />
          </div>
        </Card>
      </div>
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

function QuickLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="block p-3 rounded-md border border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition"
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-slate-500 mt-1">{sub}</div>
    </Link>
  );
}
