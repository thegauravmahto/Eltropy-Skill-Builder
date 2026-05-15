import { TestHarness } from "@/components/TestHarness";

export default function TestPage() {
  return (
    <div className="px-10 py-8 max-w-6xl">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Surface 4</div>
        <h1 className="text-2xl font-semibold tracking-tight">Test Harness - replay sandbox</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
          Paste a member transcript and watch the orchestrator -&gt; sub-agent -&gt; skill -&gt; tool-call chain execute
          with mocked Tool responses. The author <strong>sees the guardrail act before publish</strong> - this is where
          Affordance and Guardrails meet.
        </p>
      </div>

      <TestHarness />
    </div>
  );
}
