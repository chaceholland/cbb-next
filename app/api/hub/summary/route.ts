// Pass 4 Feature #1 — My Sports hub batched summary endpoint.
// Returns today's slate (or next upcoming) across all six trackers in one round trip.
// Read-only. Cached at edge for 2 minutes.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createPortalClient, portalAvailable } from "@/lib/supabase/portal-client";

export const dynamic = "force-dynamic";

type GameRow = {
  id: string;
  home: string;
  away: string;
  start: string | null;
  status: string | null;
  completed: boolean;
  is_favorite?: boolean;
};

type TrackerSummary = {
  key: string;
  name: string;
  url: string;
  games_today: GameRow[];
  next_game: GameRow | null;
  last_sync: string | null;
  coverage_pct: number | null;
  note?: string;
};

function todayUTCDate(): string {
  // YYYY-MM-DD in UTC. Trackers store dates as date or timestamp; an ILIKE catches both.
  return new Date().toISOString().slice(0, 10);
}

async function buildCBB(sb: ReturnType<typeof createClient>, favs: Set<string>): Promise<TrackerSummary> {
  const today = todayUTCDate();
  const { data: gamesToday } = await sb
    .from("cbb_games")
    .select("game_id, date, home_name, away_name, status, completed")
    .ilike("date", `${today}%`)
    .order("date", { ascending: true })
    .limit(50);

  let next: GameRow | null = null;
  if (!gamesToday || gamesToday.length === 0) {
    const { data: nextRow } = await sb
      .from("cbb_games")
      .select("game_id, date, home_name, away_name, status, completed")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1);
    if (nextRow && nextRow[0]) {
      const g = nextRow[0];
      next = {
        id: String(g.game_id),
        home: g.home_name ?? "",
        away: g.away_name ?? "",
        start: g.date,
        status: g.status,
        completed: !!g.completed,
      };
    }
  }

  const { data: counts } = await sb
    .from("cbb_games")
    .select("completed", { count: "exact", head: false })
    .eq("completed", true)
    .limit(1);
  // For coverage % we use the same shape the audit doc tracked; just expose a hint
  // here — full calc is in the dedicated data-health page (feature #5).
  void counts;

  const { data: lastSync } = await sb
    .from("cbb_sync_log")
    .select("synced_at")
    .eq("status", "success")
    .order("synced_at", { ascending: false })
    .limit(1);

  return {
    key: "cbb",
    name: "College Baseball",
    url: "/",
    games_today: (gamesToday ?? []).map((g) => ({
      id: String(g.game_id),
      home: g.home_name ?? "",
      away: g.away_name ?? "",
      start: g.date,
      status: g.status,
      completed: !!g.completed,
      is_favorite: favs.has(String(g.game_id)),
    })),
    next_game: next,
    last_sync: lastSync?.[0]?.synced_at ?? null,
    coverage_pct: null,
  };
}

async function buildSimpleTracker(
  sb: ReturnType<typeof createClient>,
  args: {
    key: string;
    name: string;
    url: string;
    gamesTable: string;
    idCol: string;
    dateCol: string;
    homeCol: string;
    awayCol: string;
    statusCol?: string;
    syncTable?: string;
    extraFilter?: { col: string; eq: unknown };
  },
): Promise<TrackerSummary> {
  const today = todayUTCDate();
  const selectCols = [
    args.idCol,
    args.dateCol,
    args.homeCol,
    args.awayCol,
    args.statusCol ?? null,
    "completed",
  ]
    .filter(Boolean)
    .join(", ");

  let q = sb
    .from(args.gamesTable)
    .select(selectCols)
    .ilike(args.dateCol, `${today}%`)
    .order(args.dateCol, { ascending: true })
    .limit(50);
  if (args.extraFilter) q = q.eq(args.extraFilter.col, args.extraFilter.eq as never);
  const { data: gamesToday } = await q;

  let next: GameRow | null = null;
  if (!gamesToday || gamesToday.length === 0) {
    let q2 = sb
      .from(args.gamesTable)
      .select(selectCols)
      .gte(args.dateCol, today)
      .order(args.dateCol, { ascending: true })
      .limit(1);
    if (args.extraFilter) q2 = q2.eq(args.extraFilter.col, args.extraFilter.eq as never);
    const { data: nextRow } = await q2;
    if (nextRow && nextRow[0]) {
      const g = nextRow[0] as unknown as Record<string, unknown>;
      next = {
        id: String(g[args.idCol]),
        home: String(g[args.homeCol] ?? ""),
        away: String(g[args.awayCol] ?? ""),
        start: (g[args.dateCol] as string) ?? null,
        status: args.statusCol ? ((g[args.statusCol] as string) ?? null) : null,
        completed: !!g.completed,
      };
    }
  }

  let lastSync: string | null = null;
  if (args.syncTable) {
    const { data } = await sb
      .from(args.syncTable)
      .select("synced_at")
      .eq("status", "success")
      .order("synced_at", { ascending: false })
      .limit(1);
    lastSync = data?.[0]?.synced_at ?? null;
  }

  return {
    key: args.key,
    name: args.name,
    url: args.url,
    games_today: ((gamesToday ?? []) as unknown as Record<string, unknown>[]).map((g) => ({
      id: String(g[args.idCol]),
      home: String(g[args.homeCol] ?? ""),
      away: String(g[args.awayCol] ?? ""),
      start: (g[args.dateCol] as string) ?? null,
      status: args.statusCol ? ((g[args.statusCol] as string) ?? null) : null,
      completed: !!g.completed,
    })),
    next_game: next,
    last_sync: lastSync,
    coverage_pct: null,
  };
}

async function buildPortal(): Promise<TrackerSummary> {
  const fallback: TrackerSummary = {
    key: "portal",
    name: "CFB Portal",
    url: "https://cfb-portal.vercel.app",
    games_today: [],
    next_game: null,
    last_sync: null,
    coverage_pct: null,
    note: portalAvailable()
      ? undefined
      : "Portal Supabase env not configured on this deployment — set PORTAL_SUPABASE_URL + PORTAL_SUPABASE_ANON_KEY to enable.",
  };
  const portal = createPortalClient();
  if (!portal) return fallback;
  try {
    const { data: recent } = await portal
      .from("portal_changes")
      .select("id, player_name, change_type, new_value, description, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    const { data: settings } = await portal
      .from("portal_settings")
      .select("value")
      .eq("key", "last_update")
      .limit(1);
    return {
      ...fallback,
      games_today: (recent ?? []).map((r) => ({
        id: String(r.id),
        home: r.new_value ?? "",
        away: r.player_name ?? "",
        start: r.created_at ?? null,
        status: r.change_type ?? null,
        completed: true,
      })),
      last_sync: (settings?.[0]?.value as string) ?? null,
      note: undefined,
    };
  } catch (e) {
    return { ...fallback, note: `portal fetch failed: ${(e as Error).message}` };
  }
}

export async function GET() {
  const sb = createClient();

  // CBB favorites read for the favorites-first treatment.
  const { data: favRows } = await sb
    .from("cbb_game_favorites")
    .select("game_id")
    .limit(500);
  const favs = new Set<string>((favRows ?? []).map((r) => String(r.game_id)));

  const trackers = await Promise.all([
    buildCBB(sb, favs),
    buildSimpleTracker(sb, {
      key: "mlb",
      name: "MLB Pitchers",
      url: "https://mlb-pitcher-tracker.vercel.app",
      gamesTable: "mlb_games",
      idCol: "game_id",
      dateCol: "date",
      homeCol: "home_team_name",
      awayCol: "away_team_name",
      statusCol: "status",
      syncTable: "mlb_sync_log",
    }),
    buildSimpleTracker(sb, {
      key: "nfl",
      name: "NFL QBs",
      url: "https://nfl-qb-tracker.vercel.app",
      gamesTable: "nfl_games",
      idCol: "id",
      dateCol: "date",
      homeCol: "home_team_id",
      awayCol: "away_team_id",
      statusCol: "status",
      syncTable: "nfl_sync_log",
    }),
    buildSimpleTracker(sb, {
      key: "cfb",
      name: "CFB QBs",
      url: "https://cfb-qb-tracker.vercel.app",
      gamesTable: "cfb_games",
      idCol: "game_id",
      dateCol: "date",
      homeCol: "home_team_id",
      awayCol: "away_team_id",
      statusCol: "status",
      syncTable: "cfb_sync_log",
    }),
    buildSimpleTracker(sb, {
      key: "swim",
      name: "NCAA Swim",
      url: "https://ncaa-swim-dive-tracker.vercel.app",
      gamesTable: "swim_meets",
      idCol: "id",
      dateCol: "date_start",
      homeCol: "name",
      awayCol: "location",
      syncTable: "swim_sync_log",
    }),
    buildPortal(),
  ]);

  return NextResponse.json(
    {
      today: todayUTCDate(),
      trackers,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
