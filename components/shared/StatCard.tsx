import { cn } from "./cn";

export interface StatCardProps {
  /** Small label above the value (e.g. "Coverage", "Pitchers/Game"). */
  label: string;
  /** The headline value. */
  value: React.ReactNode;
  /** Optional sub-text under the value (e.g. "of 99 teams"). */
  hint?: string;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Optional emphasis tone for the value text. */
  tone?: "default" | "positive" | "warning" | "negative";
  className?: string;
}

const TONE_TEXT: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-100",
  positive: "text-emerald-300",
  warning: "text-amber-300",
  negative: "text-red-300",
};

/**
 * Generic stat tile — label, big value, optional hint/icon/tone. For KPI rows,
 * analytics tiles, and data-health summaries across trackers. Presentational.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-700/60 bg-slate-800/40 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon && <span className="text-slate-500">{icon}</span>}
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
