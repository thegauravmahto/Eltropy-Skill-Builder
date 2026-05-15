import Link from "next/link";
import { skills } from "@/lib/seed";

export default function SkillsPage() {
  return (
    <div className="px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Surface 2</div>
          <h1 className="text-2xl font-semibold tracking-tight">Skill Registry</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Markdown SOPs with curly-brace tool calls. Versioned, scoped, lint-able, replay-testable.
          </p>
        </div>
        <button className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium hover:opacity-90">
          + New Skill
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-left">
              <Th>Name</Th>
              <Th>Domain</Th>
              <Th>Version</Th>
              <Th>Status</Th>
              <Th>Tenant</Th>
              <Th>Tools</Th>
              <Th>Regressions</Th>
              <Th>Lint</Th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40"
              >
                <td className="px-3 py-2.5">
                  <Link href={`/skills/${s.id}`} className="font-medium hover:text-indigo-600">
                    {s.name}
                  </Link>
                  <div className="text-[11px] text-slate-500">{s.description}</div>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{s.domain}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{s.version}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2.5 text-xs">{s.tenantScope}</td>
                <td className="px-3 py-2.5 text-xs font-mono">{s.toolsUsed.length}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`text-[10px] font-medium ${s.regressionPass ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {s.regressionCases} {s.regressionPass ? "✓" : "⚠"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`text-[10px] font-medium ${s.lintErrors === 0 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {s.lintErrors === 0 ? "clean" : `${s.lintErrors} err`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">{children}</th>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "in-review": "bg-sky-100 text-sky-800",
    deprecated: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wide rounded ${map[status] || map.draft}`}>
      {status}
    </span>
  );
}
