import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkill, getTool, subAgents, getGuardrail } from "@/lib/seed";
import { SkillEditor } from "@/components/SkillEditor";

export default async function SkillEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();

  // Which sub-agents bind this Skill?
  const bindings = subAgents.filter((sa) => sa.boundSkills.includes(skill.id));

  // Compute allowed Tool names from all sub-agents that bind this Skill
  // For the demo we union them; in production we'd resolve per-binding.
  const allowedToolNames = new Set<string>();
  bindings.forEach((sa) => {
    sa.boundSkills.forEach((sid) => {
      const s = getSkill(sid);
      if (s) s.toolsUsed.forEach((tid) => {
        const t = getTool(tid);
        if (t) allowedToolNames.add(t.name);
      });
    });
  });
  // Also seed with the Skill's own current tools so editor doesn't false-flag
  skill.toolsUsed.forEach((tid) => {
    const t = getTool(tid);
    if (t) allowedToolNames.add(t.name);
  });

  return (
    <div className="px-10 py-8 max-w-7xl">
      <div className="mb-2 text-[11px]">
        <Link href="/skills" className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          ← Skills
        </Link>
      </div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
            Surface 2 - Skill Editor (the affordance + guardrail surface)
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{skill.name}</h1>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{skill.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            Save draft
          </button>
          <Link
            href="/publish"
            className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium"
          >
            Publish v{bump(skill.version)} →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-mono">v{skill.version}</span>
        <span>·</span>
        <span className="font-mono">{skill.domain}</span>
        <span>·</span>
        <span>
          Bound by{" "}
          {bindings.map((b, i) => (
            <span key={b.id}>
              <Link className="underline hover:text-brand-600" href={`/sub-agents/${b.id}`}>
                {b.name}
              </Link>
              {i < bindings.length - 1 ? ", " : ""}
            </span>
          ))}
        </span>
        <span>·</span>
        <span>{skill.regressionCases} regression cases ({skill.regressionPass ? "passing" : "failing"})</span>
      </div>

      <SkillEditor skill={skill} allowedToolNames={[...allowedToolNames]} />

      <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
        <Info title="Affordance moves on this surface">
          <ul className="space-y-1 list-disc ml-4 text-slate-600 dark:text-slate-400">
            <li>Tool calls render as <strong>pills</strong> in the preview - SOP looks the way it executes.</li>
            <li>Out-of-scope Tools are <strong>dimmed</strong> in the palette - cannot be summoned by typo.</li>
            <li>Financial Tools wear a persistent <strong>red badge</strong>.</li>
            <li>Inline <strong>lint errors</strong> with line numbers - "why blocked?" answered before save.</li>
          </ul>
        </Info>
        <Info title="Guardrails enforced here">
          <ul className="space-y-1 list-disc ml-4 text-slate-600 dark:text-slate-400">
            {skill.guardrailIds.map((g) => (
              <li key={g}>{getGuardrail(g)?.name}</li>
            ))}
          </ul>
        </Info>
        <Info title="What you cannot do here">
          <ul className="space-y-1 list-disc ml-4 text-slate-600 dark:text-slate-400">
            <li>Author a new Tool (engineering-only).</li>
            <li>Invoke a Tool outside this sub-agent's scope.</li>
            <li>Publish without regression set passing.</li>
            <li>Bypass Compliance Reviewer on tenant-prod publishes.</li>
          </ul>
        </Info>
      </div>
    </div>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{title}</div>
      {children}
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
