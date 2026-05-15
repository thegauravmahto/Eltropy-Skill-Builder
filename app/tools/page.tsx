import { tools } from "@/lib/seed";
import { SideEffectBadge } from "@/components/ToolCallPill";

export default function ToolsPage() {
  const byDomain = tools.reduce<Record<string, typeof tools>>((acc, t) => {
    (acc[t.domain] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Surface 3</div>
          <h1 className="text-2xl font-semibold tracking-tight">Tool Registry</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Each Tool wraps exactly one API. Schema-typed, side-effect-classified, scope-bound. CU AI Leads compose
            existing Tools into Skills - they do not author new Tools (engineering-only).
          </p>
        </div>
        <div className="text-[11px] flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1"><SideEffectBadge kind="read" /> read</span>
          <span className="flex items-center gap-1"><SideEffectBadge kind="write" /> write</span>
          <span className="flex items-center gap-1"><SideEffectBadge kind="financial" /> financial</span>
        </div>
      </div>

      {Object.entries(byDomain).map(([domain, list]) => (
        <div key={domain} className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-mono">{domain}</div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-left">
                  <Th>Tool</Th>
                  <Th>Side-effect</Th>
                  <Th>Inputs</Th>
                  <Th>Required scopes</Th>
                  <Th>PII surface</Th>
                  <Th>Rate limit</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className="px-3 py-2.5 align-top">
                      <div className="font-mono text-sm font-medium">{t.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{t.description}</div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <SideEffectBadge kind={t.sideEffect} />
                      {t.sideEffect === "financial" && (
                        <div className="text-[10px] text-rose-600 mt-1 font-medium">step-up auth required</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs font-mono">
                      {t.inputs.map((i) => (
                        <div key={i.name} className="flex gap-1">
                          <span className={i.required ? "" : "opacity-60"}>{i.name}</span>
                          <span className="opacity-50">: {i.type}</span>
                          {i.pii && <span className="text-rose-600">·PII</span>}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {t.requiredScopes.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 font-mono"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs">{t.piiSurface ? "yes" : "no"}</td>
                    <td className="px-3 py-2.5 align-top text-xs uppercase">{t.rateLimitTier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">{children}</th>;
}
