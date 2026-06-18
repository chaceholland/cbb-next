import { cn } from "./cn";

export interface SectionHeaderProps {
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Optional count shown as a pill next to the title (e.g. number of games). */
  count?: number;
  /** Optional right-aligned content (buttons, filters, a freshness chip). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Generic section header — title (+ optional count pill / subtitle) on the left,
 * optional action slot on the right. Presentational; heads Schedule / Roster /
 * Analytics sections consistently across trackers.
 */
export function SectionHeader({
  title,
  subtitle,
  count,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold text-slate-100">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-300">
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
