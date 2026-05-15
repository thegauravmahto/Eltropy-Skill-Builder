import { skills, getSkill, getGuardrail } from "@/lib/seed";

export default function PublishPage() {
  const drafts = skills.filter((s) => s.status === "draft");

  return (
    <div className="px-10 py-8 max-w-5xl">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Surface 5</div>
        <h1 className="text-2xl font-semibold tracking-tight">Publish & Versioning</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
          Skills are immutable after publish. Republish creates a new version. The publishing flow gates on lint pass,
          regression-set pass, guardrail-policy diff, and (in production) Compliance Reviewer approval.
        </p>
      </div>

      <div className="space-y-4">
        {drafts.map((s) => {
          const blocking =
            (s.regressionPass ? 0 : 1) + (s.lintErrors > 0 ? 1 : 0);
          const canPublish = blocking === 0;
          return (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-base font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-slate-500">v{s.version} (draft)</div>
                  <div className="font-mono text-xs text-emerald-600">-&gt; v{bump(s.version)}</div>
                </div>
              </div>

              {/* Gate checklist */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <Gate
                  label="Lint clean"
                  passed={s.lintErrors === 0}
                  detail={s.lintErrors === 0 ? "0 errors" : `${s.lintErrors} error(s)`}
                />
                <Gate
                  label="Regression set passes"
                  passed={s.regressionPass}
                  detail={`${s.regressionCases} cases`}
                />
                <Gate label="Guardrail diff reviewed" passed pendingLabel="auto-shown on publish" />
                <Gate
                  label="Compliance approval"
                  passed={false}
                  pendingLabel="required for prod tenant"
                />
              </div>

              {/* Guardrail diff preview */}
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Guardrail Policy diff</div>
              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-md p-3 font-mono text-[11px] space-y-0.5">
                {s.guardrailIds.map((gid) => {
                  const g = getGuardrail(gid);
                  if (!g) return null;
                  return (
                    <div key={gid} className="text-slate-700 dark:text-slate-300">
                      <span className="text-emerald-600">+</span> {g.family}: {g.name}
                    </div>
                  );
                })}
                <div className="text-slate-400">
                  <span className="text-rose-500">-</span> (no previous version - this is v1)
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-[11px] text-slate-500">
                  {canPublish
                    ? "All gates passing - ready to request Compliance Review."
                    : "Cannot publish until blocking gates pass."}
                </div>
                <button
                  disabled={!canPublish}
                  className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Request review
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Version history snapshot */}
      <div className="mt-10">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">
          Recently published (immutable history)
        </div>
        <div className="space-y-1">
          {skills
            .filter((s) => s.status === "published")
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md"
              >
                <div>
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-500 font-mono">v{s.version}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(s.lastEditedAt).toLocaleDateString()} · {s.authoredBy}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Gate({
  label,
  passed,
  detail,
  pendingLabel,
}: {
  label: string;
  passed: boolean;
  detail?: string;
  pendingLabel?: string;
}) {
  return (
    <div
      className={`p-2.5 rounded-md border ${
        passed
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
          : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={passed ? "text-emerald-600" : "text-amber-600"}>{passed ? "✓" : "○"}</span>
        <div className="text-[11px] font-medium">{label}</div>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">{passed ? detail : pendingLabel || detail}</div>
    </div>
  );
}

function bump(v: string): string {
  const parts = v.split(".").map((n) => parseInt(n, 10));
  if (parts.length === 3 && !isNaN(parts[2])) {
    parts[2] += 1;
    return parts.join(".");
  }
  return v;
}
