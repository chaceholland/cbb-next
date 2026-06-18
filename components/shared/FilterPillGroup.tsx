"use client";

import { cn } from "./cn";
import { Pill } from "./Pill";

export interface FilterPillOption {
  id: string;
  label: string;
  count?: number;
}

export interface FilterPillGroupProps {
  /** Optional uppercase section label rendered above the row. */
  title?: string;
  options: FilterPillOption[];
  activeId: string;
  onChange: (id: string) => void;
  /** Active-state gradient passed through to each Pill. Defaults to CBB's brand gradient. */
  activeGradient?: string;
  /** Class for the pill row. Defaults to a wrapping, horizontally-scrollable row. */
  rowClassName?: string;
}
/**
 * Generic labeled group of filter Pills ("presets as props"). Additive shared
 * primitive added in Pass 3 B3 for MLB / swim adoption. CBB's existing
 * RosterFilterPills / ScheduleFilterPills are left composing Pill directly
 * (pixel-identical) and can migrate onto this later.
 */
export function FilterPillGroup({
  title,
  options,
  activeId,
  onChange,
  activeGradient,
  rowClassName,
}: FilterPillGroupProps) {
  return (
    <div className="space-y-2">
      {title && (
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {title}
        </h3>
      )}
      <div className={cn(rowClassName ?? "flex gap-2 overflow-x-auto pb-2 flex-wrap")}>
        {options.map((o) => (
          <Pill
            key={o.id}
            label={o.label}
            count={o.count}
            active={activeId === o.id}
            onClick={() => onChange(o.id)}
            activeGradient={activeGradient}
          />
        ))}
      </div>
    </div>
  );
}
