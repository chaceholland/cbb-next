"use client";

import { useEffect, useState } from "react";
import { DataFreshnessChip } from "./DataFreshnessChip";

/**
 * Client wrapper for Pass 3 B4: fetches the app's /api/health endpoint on mount
 * and renders a <DataFreshnessChip> ("Updated 2h ago"). Built additive + UNUSED
 * (not mounted anywhere yet) — same playbook as the A1/A2 primitives, so CBB's
 * build/behavior is unchanged until someone mounts it.
 *
 * Why a client fetch: keeps the page statically prerenderable. A server
 * component querying Supabase directly would force `/` dynamic. /api/health is
 * already `force-dynamic` + read-only (summarizes *_sync_log).
 *
 * Coverage %: the current /api/health does NOT return a coverage figure (only
 * lastSuccessAt / lastRun / lastRecords / recentErrors), so the chip shows
 * freshness only. To add "X% coverage", extend /api/health with a
 * completed-with-participation ÷ total query and pass `coveragePct` through.
 *
 * TO COMPLETE B4 (left for Chace — placement/visual is a design call): mount
 * once, e.g. in app/layout.tsx after {children} inside a footer, or at the
 * bottom of app/page.tsx:
 *     <footer className="flex justify-center py-4"><DataFreshnessFooter /></footer>
 */
export interface DataFreshnessFooterProps {
  /** Health endpoint to read (default "/api/health"). */
  endpoint?: string;
  /** Leading label on the chip (default "Updated"). */
  label?: string;
  className?: string;
}

interface HealthResponse {
  app?: string;
  ok?: boolean;
  lastRun?: string | null;
  lastStatus?: string | null;
  lastRecords?: number | null;
  lastSuccessAt?: string | null;
  recentErrors?: number;
}

export function DataFreshnessFooter({
  endpoint = "/api/health",
  label = "Updated",
  className,
}: DataFreshnessFooterProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint, { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`health ${r.status}`)),
      )
      .then((data: HealthResponse) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  // Prefer the last *successful* sync for freshness; fall back to last run.
  const lastSync = health?.lastSuccessAt ?? health?.lastRun ?? null;

  // Render nothing until the first fetch settles (avoids a flash / hydration
  // mismatch). Show the chip's "No sync data" state only once a fetch fails.
  if (!health && !failed) return null;

  return (
    <DataFreshnessChip lastSync={lastSync} label={label} className={className} />
  );
}
