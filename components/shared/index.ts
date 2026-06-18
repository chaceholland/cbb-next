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
// Pass 3 B4 (prep): client wrapper that reads /api/health and renders the chip.
// Additive + not yet mounted — mounting/placement is the gated B4 step (Chace).
export {
  DataFreshnessFooter,
  type DataFreshnessFooterProps,
} from "./DataFreshnessFooter";
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

// Top-level chrome — promoted from CBB components/ in Pass 3 B2. Generalized to
// props (brand, gradient, tab items) that default to CBB's values, so CBB stays
// pixel-identical and MLB/swim can override on adoption. TabBar needs the
// framer-motion peer dep.
export { Navigation, type NavigationProps } from "./Navigation";
export { TabBar, type TabBarProps, type TabItem } from "./TabBar";

// Filter primitives — promoted from CBB components/FilterPills.tsx in Pass 3 B3.
// Pill's active gradient is a prop defaulting to CBB's brand gradient (pixel-
// identical for CBB). FilterPillGroup is an additive generic group for MLB/swim.
export { Pill, type PillProps } from "./Pill";
export {
  FilterPillGroup,
  type FilterPillGroupProps,
  type FilterPillOption,
} from "./FilterPillGroup";

// Landing hero — promoted from CBB components/HeroSection.tsx in Pass 3 B3.
// Content (title/subtitle/stats) is prop-driven, defaulting to CBB's exact
// current values (pixel-identical). Visual size/identity left for a later step.
export { HeroSection, type HeroSectionProps, type HeroStat } from "./HeroSection";
