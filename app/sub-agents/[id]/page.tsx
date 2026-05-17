import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSubAgent, getSkill, getGuardrail, tools as allTools, getToolByName } from "@/lib/seed";
import { SideEffectBadge } from "@/components/ToolCallPill";

const SCOPE_DOMAINS = [
  "Authentication",
  "Account Services",
  "Loan Servicing",
  "Card Services",
  "Collections",
  "Payments",
];

export default async function SubAgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sa = getSubAgent(id);
  if (!sa) notFound();

  const boundSkills = sa.boundSkills.map(getSkill).filter(Boolean) as NonNullable<ReturnType<typeof getSkill>>[];
  const guardrails = sa.guardrailIds.map(getGuardrail).filter(Boolean) as NonNullable<ReturnType<typeof getGuardrail>>[];

  // Compute the tools transitively allowed via bound Skills
  const allowedToolNames = new Set<string>();
  boundSkills.forEach((s) => s.toolsUsed.forEach((tid) => {
    const t = allTools.find((tt) => tt.id === tid);
    if (t) allowedToolNames.add(t.name);
  }));

  return (
    <div className="px-10 py-8 max-w-6xl">
      <div className="mb-2 text-[11px]">
        <Link href="/sub-agents" className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          ← Sub-agents
        </Link>
      </div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">{sa.name}</h1>
        <button className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium">
          Test in harness →
        </button>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400 mb-6">{sa.description}</div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Version" value={sa.version} />
        <Stat label="Status" value={sa.status} />
        <Stat label="Last test pass" value={sa.lastTestPassAt ? new Date(sa.lastTestPassAt).toLocaleString() : "never"} />
      </div>

      {/* Scope chip-picker (affordance: bounded picker) */}
      {sa.policy && (
        <Section title="Operating policy">
          <p className="text-xs text-slate-500 mb-3">
            The SOP for this sub-agent. Read once before publishing; this is the contract the orchestrator routes against.
          </p>
          <div className="markdown-body p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{sa.policy}</ReactMarkdown>
          </div>
        </Section>
      )}

      <Section title="Scope domain (bounded chip-picker)">
        <p className="text-xs text-slate-500 mb-3">
          The chip <em>is</em> the contract. Sub-agent refuses any intent outside the selected domain.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SCOPE_DOMAINS.map((d) => (
            <span
              key={d}
              className={`px-2.5 py-1 text-xs rounded-full border font-mono ${
                d === sa.scopeDomain
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60"
              }`}
              title={d === sa.scopeDomain ? "Current scope" : "Switch scope (disabled in demo)"}
            >
              {d}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Bound Skills - allowlist">
        <p className="text-xs text-slate-500 mb-3">
          Only Skills on this list can be invoked when the orchestrator routes here. Add a Skill via drag-to-bind in the
          Skill Editor.
        </p>
        <div className="space-y-2">
          {boundSkills.map((s) => (
            <Link
              key={s.id}
              href={`/skills/${s.id}`}
              className="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-800 hover:border-brand-400 transition"
            >
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  v{s.version} · {s.regressionCases} regression cases · {s.lintErrors === 0 ? "lint clean" : `${s.lintErrors} lint`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] uppercase tracking-wide ${
                    s.regressionPass ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {s.regressionPass ? "regressions ✓" : "regressions ⚠"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Allowed Tools (computed from bound Skills)">
        <p className="text-xs text-slate-500 mb-3">
          Out-of-scope Tools cannot be summoned by typo - the Skill Editor blocks them at author time.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...allowedToolNames].map((n) => {
            const t = getToolByName(n);
            if (!t) return null;
            return (
              <span
                key={n}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              >
                <span>{t.name}</span>
                <SideEffectBadge kind={t.sideEffect} />
              </span>
            );
          })}
        </div>
      </Section>

      <Section title="Guardrail Policy">
        <p className="text-xs text-slate-500 mb-3">
          Composed from named, reusable Guardrail Sets. Diffed on every Skill publish.
        </p>
        <div className="space-y-2">
          {guardrails.map((g) => (
            <div key={g.id} className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                  {g.family}
                </span>
                <span className="text-sm font-medium">{g.name}</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{g.description}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Routing intents">
        <p className="text-xs text-slate-500 mb-3">
          Intent phrases the Main Orchestrator should route to this sub-agent.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sa.routingIntents.map((i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300"
            >
              "{i}"
            </span>
          ))}
        </div>
      </Section>

      <Section title="Out-of-scope behaviour">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
            {sa.outOfScopeBehaviour}
          </span>
          <span className="text-xs text-slate-500">
            Refuse and hand back to the Main Orchestrator. This is not optional - it is the AI never acts outside
            approved SOPs tenet.
          </span>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
