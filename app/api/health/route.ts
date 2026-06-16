// Pass 2 — read-only health endpoint. Summarizes recent cbb_sync_log runs.
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOG_TABLE = "cbb_sync_log";
const APP = "cbb";

export async function GET() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${LOG_TABLE}?select=sync_type,records_count,status,error_message,synced_at&order=synced_at.desc&limit=20`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ app: APP, ok: false, error: `sync_log fetch ${r.status}` }, { status: 502 });
    const rows = await r.json();
    const last = rows[0] ?? null;
    const lastSuccess = rows.find((x: any) => x.status === "success") ?? null;
    const recentErrors = rows.filter((x: any) => x.status === "error").length;
    return NextResponse.json({
      app: APP,
      ok: last ? last.status !== "error" : false,
      lastRun: last?.synced_at ?? null,
      lastStatus: last?.status ?? null,
      lastRecords: last?.records_count ?? null,
      lastSuccessAt: lastSuccess?.synced_at ?? null,
      recentErrors,
      recent: rows.slice(0, 5),
    });
  } catch (e: any) {
    return NextResponse.json({ app: APP, ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
