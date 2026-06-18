/**
 * Shared status color tokens — the one place every tracker defines what
 * "Played / DNP / Live / Final / Scheduled / No data" look like (plan §C:
 * "same color tokens per status"). Dark-theme slate palette to match CBB.
 */
export type TrackerStatus =
  | "played"
  | "dnp"
  | "live"
  | "final"
  | "scheduled"
  | "nodata";

export interface StatusToken {
  /** Human label shown in the chip. */
  label: string;
  /** Tailwind classes for the chip container (bg + text + border). */
  className: string;
  /** Tailwind classes for the small leading dot. */
  dotClassName: string;
  /** Whether the dot should pulse (live games). */
  pulse: boolean;
}

export const STATUS_TOKENS: Record<TrackerStatus, StatusToken> = {
  played: {
    label: "Played",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClassName: "bg-emerald-400",
    pulse: false,
  },
  dnp: {
    label: "DNP",
    className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    dotClassName: "bg-slate-400",
    pulse: false,
  },
  live: {
    label: "Live",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClassName: "bg-red-400",
    pulse: true,
  },
  final: {
    label: "Final",
    className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dotClassName: "bg-blue-400",
    pulse: false,
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    dotClassName: "bg-slate-500",
    pulse: false,
  },
  nodata: {
    label: "No data",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClassName: "bg-amber-400",
    pulse: false,
  },
};

/** Aliases mapping free-form status strings to a known token. */
const STATUS_ALIASES: Record<string, TrackerStatus> = {
  played: "played",
  complete: "played",
  completed: "played",
  success: "played",
  dnp: "dnp",
  didnotplay: "dnp",
  inactive: "dnp",
  scratched: "dnp",
  live: "live",
  inprogress: "live",
  final: "final",
  scheduled: "scheduled",
  upcoming: "scheduled",
  pregame: "scheduled",
  nodata: "nodata",
  nodataavailable: "nodata",
  error: "nodata",
};

/** Normalize a free-form status string to a token (defaults to "scheduled"). */
export function getStatusToken(status: string | null | undefined): StatusToken {
  const key = (status ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  const mapped = STATUS_ALIASES[key];
  return STATUS_TOKENS[mapped ?? "scheduled"];
}
