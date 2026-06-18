import { cn } from "./cn";
import { getStatusToken, type TrackerStatus } from "./statusTokens";

export interface StatusChipProps {
  /** A known TrackerStatus or any free-form status string; normalized internally. */
  status: TrackerStatus | string | null | undefined;
  /** Optional label override (defaults to the token's label). */
  label?: string;
  className?: string;
}

/**
 * Shared status chip — Played / DNP / Live (pulse) / Final / Scheduled / No data.
 * Presentational only; safe to drop into any tracker's card or player row.
 */
export function StatusChip({ status, label, className }: StatusChipProps) {
  const token = getStatusToken(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        token.className,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          token.dotClassName,
          token.pulse && "animate-pulse",
        )}
      />
      {label ?? token.label}
    </span>
  );
}
