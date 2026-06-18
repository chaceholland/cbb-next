// Shared tracker UI primitives — canonical source (CBB). Copy-portable to the
// other React trackers (MLB, swim). See README.md in this folder.
export { cn } from "./cn";
export { StatusChip, type StatusChipProps } from "./StatusChip";
export { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
export { StatCard, type StatCardProps } from "./StatCard";
export {
  DataFreshnessChip,
  type DataFreshnessChipProps,
} from "./DataFreshnessChip";
export {
  STATUS_TOKENS,
  getStatusToken,
  type TrackerStatus,
  type StatusToken,
} from "./statusTokens";

// Theme wrappers (next-themes) — client components. Promoted from CBB
// components/ in Pass 3 B1; app-agnostic, safe to copy to other trackers.
export { ThemeProvider } from "./ThemeProvider";
export { ThemeToggle } from "./ThemeToggle";
