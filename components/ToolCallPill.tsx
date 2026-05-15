import type { ParsedToolCall } from "@/lib/parser";
import { getToolByName } from "@/lib/seed";

interface Props {
  call: ParsedToolCall;
  size?: "sm" | "md";
}

export function ToolCallPill({ call, size = "md" }: Props) {
  const tool = call.isHandback ? null : getToolByName(call.name);
  const isFinancial = tool?.sideEffect === "financial";
  const isWrite = tool?.sideEffect === "write";

  const base =
    size === "sm"
      ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
      : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono";

  let styles = "";
  let prefix = "tool";

  if (call.isHandback) {
    styles = "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900";
    prefix = "handback";
  } else if (call.isUnknown) {
    styles = "bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900";
  } else if (isFinancial) {
    styles = "bg-rose-50 text-rose-900 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900";
  } else if (isWrite) {
    styles = "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900";
  } else {
    styles = "bg-sky-50 text-sky-900 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900";
  }

  return (
    <span className={`${base} ${styles}`} title={tool?.description}>
      <span className="opacity-60">{prefix}:</span>
      <span className="font-semibold">{call.name}</span>
      {Object.keys(call.args).length > 0 && (
        <span className="opacity-70">
          (
          {Object.entries(call.args)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}
          )
        </span>
      )}
      {isFinancial && <span className="ml-0.5 px-1 rounded bg-rose-200/70 text-[9px] uppercase tracking-wide">$</span>}
    </span>
  );
}

// A standalone badge for side-effect classification
export function SideEffectBadge({ kind }: { kind: "read" | "write" | "financial" }) {
  const map = {
    read: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    write: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    financial: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  } as const;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${map[kind]}`}>
      {kind}
    </span>
  );
}
