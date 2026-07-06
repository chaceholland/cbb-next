'use client';

/**
 * Season-pause banner — shows an amber notice when the sport is out of season
 * and live data updates are paused. Hidden entirely during in-season months.
 * Copy-portable (only depends on ./cn). Month check is client-side local time.
 */
import { cn } from './cn';

export interface SeasonBannerProps {
  /** Months (1-12) when the sport is in season; banner hides during these. */
  inSeasonMonths: number[];
  /** e.g. "College baseball" */
  sportLabel: string;
  /** e.g. "Season resumes in February." */
  resumeNote?: string;
  className?: string;
}

export function SeasonBanner({
  inSeasonMonths,
  sportLabel,
  resumeNote,
  className,
}: SeasonBannerProps) {
  const month = new Date().getMonth() + 1;
  if (inSeasonMonths.includes(month)) return null;
  return (
    <div
      role="status"
      className={cn(
        'w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-600 dark:text-amber-400',
        'text-center text-xs sm:text-sm px-4 py-2',
        className,
      )}
    >
      &#9208;&#65039; {sportLabel} is in the off-season — live game data updates are
      paused.{resumeNote ? ` ${resumeNote}` : ''}
    </div>
  );
}
