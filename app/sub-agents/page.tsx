import Link from "next/link";
import { subAgents, getSkill, getGuardrail } from "@/lib/seed";

export default function SubAgentsPage() {
  return (
    <div className="px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Surface 1</div>
          <h1 className="text-2xl font-semibold tracking-tight">Sub-agent Canvas</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Each sub-agent has <em>closed, controlled agency</em>: a scope domain, a bound Skill allowlist, and a
            Guardrail Policy. The Main Orchestrator routes intents to one of these.
          </p>
        </div>
        <button className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium hover:opacity-90">
          + New sub-agent
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {subAgents.map((sa) => {
          const skills = sa.boundSkills.map(getSkill).filter(Boolean);
          const gs = sa.guardrailIds.map(getGuardrail).filter(Boolean);
          return (
            <Link
              key={sa.id}
              href={`/sub-agents/${sa.id}`}
              className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 hover:border-brand-400 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-base">{sa.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Scope: <span className="font-mono text-slate-700 dark:text-slate-300">{sa.scopeDomain}</span> · v
                    {sa.version}
                  </div>
                </div>
                <StatusPill status={sa.status} />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{sa.description}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                {sa.routingIntents.slice(0, 3).map((intent) => (
                  <span
                    key={intent}
                    className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono"
                  >
                    "{intent}"
                  </span>
                ))}
                {sa.routingIntents.length > 3 && (
                  <span className="text-[10px] text-slate-500">+{sa.routingIntents.length - 3}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-slate-500">Bound Skills</div>
                  <div className="font-medium">{skills.length}</div>
                </div>
                <div>
                  <div className="text-slate-500">Guardrail Sets</div>
                  <div className="font-medium">{gs.length}</div>
                </div>
                <div>
                  <div className="text-slate-500">Out-of-scope</div>
                  <div className="font-medium font-mono text-[10px]">
                    {sa.outOfScopeBehaviour === "refuse-and-handback" ? "refuse + handback" : "escalate"}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    draft: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    "in-review": "bg-sky-50 text-sky-700 border-sky-200",
    deprecated: "bg-slate-100 text-slate-700 border-slate-300",
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wide rounded border ${map[status] || map.draft}`}>
      {status}
    </span>
  );
}
