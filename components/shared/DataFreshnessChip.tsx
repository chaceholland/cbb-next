import { cn } from "./cn";

export interface DataFreshnessChipProps {
  /** Last successful sync time (Date, ISO string, or epoch ms). */
  lastSync?: Date | string | number | null;
  /** Coverage percentage 0–100 (optional). */
  coveragePct?: number | null;
  /** Consider data stale after this many ms (default 26h). */
  staleAfterMs?: number;
  /** Optional leading label (default "Updated"). */
  label?: string;
  className?: string;
}

function toDate(v: DataFreshnessChipProps["lastSync"]): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relativeTime(from: Date, now: Date): string {
  const ms = now.getTime() - from.getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Shared data-freshness chip — e.g. "Updated 2h ago · 70% coverage" (plan §C:
 * "standard data-freshness footer chip on every page"). Drives trust and
 * surfaces cron failures. Feed it the latest `*_sync_log` time and, optionally,
 * coverage %. Green = fresh, amber = stale, slate = no sync data.
 *
 * Note: relative time is computed at render. For client components that hydrate,
 * pass a stable string or render under `suppressHydrationWarning` if needed.
 */
export function DataFreshnessChip({
  lastSync,
  coveragePct,
  staleAfterMs = 26 * 3_600_000,
  label = "Updated",
  className,
}: DataFreshnessChipProps) {
  const date = toDate(lastSync);
  const now = new Date();
  const stale = date ? now.getTime() - date.getTime() > staleAfterMs : true;

  const tone = !date
    ? "bg-slate-500/10 text-slate-400 border-slate-500/20"
    : stale
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  const dot = !date ? "bg-slate-500" : stale ? "bg-amber-400" : "bg-emerald-400";

  const parts: string[] = [
    date ? `${label} ${relativeTime(date, now)}` : "No sync data",
  ];
  if (coveragePct !== null && coveragePct !== undefined && Number.isFinite(coveragePct)) {
    parts.push(`${Math.round(coveragePct)}% coverage`);
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone,
        className,
      )}
      title={date ? date.toLocaleString() : "No successful sync recorded"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {parts.join(" · ")}
    </span>
  );
}
