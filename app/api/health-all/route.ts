// Pass 4 Feature #5 — Data-health endpoint.
// Per-tracker sync status across all 5 trackers from the uniform <sport>_sync_log
// tables (id, sync_type, records_count, status, error_message, synced_at).
// Read-only; unblocked 2026-07-06 once NTFY_TOPIC alerting went live in all
// 5 Vercel projects.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

const TRACKERS = [
  { key: "cbb", name: "CBB Pitcher Tracker", table: "cbb_sync_log" },
  { key: "mlb", name: "MLB Pitcher Tracker", table: "mlb_sync_log" },
  { key: "nfl", name: "NFL QB Tracker", table: "nfl_sync_log" },
  { key: "cfb", name: "CFB QB Tracker", table: "cfb_sync_log" },
  { key: "swim", name: "NCAA Swim & Dive", table: "swim_sync_log" },
] as const;

type SyncRow = {
  sync_type: string | null;
  records_count: number | null;
  status: string | null;
  error_message: string | null;
  synced_at: string | null;
};

export type TrackerHealth = {
  key: string;
  name: string;
  ok: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunType: string | null;
  lastRunRecords: number | null;
  lastSuccessAt: string | null;
  errors24h: number;
  lastError: string | null;
  recent: SyncRow[];
};

export async function GET() {
  const sb = createClient();

  const trackers: TrackerHealth[] = await Promise.all(
    TRACKERS.map(async (t) => {
      try {
        const { data, error } = await sb
          .from(t.table)
          .select("sync_type, records_count, status, error_message, synced_at")
          .order("synced_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        const rows = (data ?? []) as SyncRow[];
        const lastRun = rows[0] ?? null;
        const lastSuccess = rows.find((r) => r.status === "success") ?? null;
        const dayAgo = Date.now() - 24 * 36e5;
        const errors24h = rows.filter(
          (r) =>
            r.status !== "success" &&
            r.synced_at &&
            Date.parse(r.synced_at) >= dayAgo,
        ).length;
        return {
          key: t.key,
          name: t.name,
          ok: !!lastSuccess,
          lastRunAt: lastRun?.synced_at ?? null,
          lastRunStatus: lastRun?.status ?? null,
          lastRunType: lastRun?.sync_type ?? null,
          lastRunRecords: lastRun?.records_count ?? null,
          lastSuccessAt: lastSuccess?.synced_at ?? null,
          errors24h,
          lastError:
            rows.find((r) => r.error_message)?.error_message?.slice(0, 300) ??
            null,
          recent: rows.slice(0, 6),
        };
      } catch (e) {
        return {
          key: t.key,
          name: t.name,
          ok: false,
          lastRunAt: null,
          lastRunStatus: null,
          lastRunType: null,
          lastRunRecords: null,
          lastSuccessAt: null,
          errors24h: 0,
          lastError: String(e).slice(0, 300),
          recent: [],
        };
      }
    }),
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    trackers,
  });
}
