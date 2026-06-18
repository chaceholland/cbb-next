"use client";

import { cn } from "./cn";

export interface PillProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  /** Active-state gradient (Tailwind from/to classes). Defaults to CBB's brand gradient. */
  activeGradient?: string;
}

/**
 * Generic filter / segmented "pill" button. Promoted from CBB
 * components/FilterPills.tsx in Pass 3 B3. The active gradient is a prop
 * defaulting to CBB's brand colors, so CBB stays pixel-identical and other
 * trackers (MLB / swim) can pass their own on adoption.
 */export function Pill({
  label,
  count,
  active,
  onClick,
  activeGradient = "from-[#1a73e8] to-[#ea4335]",
}: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200",
        "font-medium text-sm whitespace-nowrap",
        active
          ? `bg-gradient-to-r ${activeGradient} text-white shadow-lg shadow-blue-500/30`
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600"
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border",
            active
              ? "bg-white/20 text-white border-white/30"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
