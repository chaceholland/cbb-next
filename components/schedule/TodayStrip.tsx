"use client";

import { CbbGame, CbbTeam } from "@/lib/supabase/types";
import { StatusChip } from "@/components/shared";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDate(iso: string): string {
  const p = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[p[1] - 1]} ${p[2]}`;
}

interface TodayStripProps {
  games: CbbGame[];
  teams: Record<string, CbbTeam>;
  favoriteTeamIds: Set<string>;
  favoriteGameIds: string[];
  onSelectGame: (g: CbbGame) => void;
}

/**
 * D1 "Today" strip — a quick glance at today's tracked games with favorited
 * teams pinned first (Chace's pick). Falls back to the next upcoming game day
 * when nothing is on today; renders nothing if there are no upcoming games.
 * Independent of the schedule filters by design (always answers "what's on now").
 */
export function TodayStrip({
  games,
  teams,
  favoriteTeamIds,
  favoriteGameIds,
  onSelectGame,
}: TodayStripProps) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const isFav = (g: CbbGame) =>
    favoriteTeamIds.has(g.home_team_id) ||
    favoriteTeamIds.has(g.away_team_id) ||
    favoriteGameIds.includes(g.game_id);

  const dayOf = (g: CbbGame) => (g.date || "").slice(0, 10);

  let label = "Today";
  let list = games.filter((g) => dayOf(g) === todayStr);
  if (list.length === 0) {
    const future = games
      .map(dayOf)
      .filter((d) => d > todayStr)
      .sort();
    if (future.length > 0) {
      const next = future[0];
      list = games.filter((g) => dayOf(g) === next);
      label = `Next up · ${fmtDate(next)}`;
    }
  }
  if (list.length === 0) return null;

  // Favorites first (stable sort preserves date order within each group).
  const sorted = [...list].sort((a, b) => Number(isFav(b)) - Number(isFav(a)));

  const teamName = (id: string, fallback: string | null | undefined) =>
    teams[id]?.display_name || fallback || "TBD";

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-slate-200">{label}</span>
        <span className="text-xs text-slate-400">
          {sorted.length} {sorted.length === 1 ? "game" : "games"}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {sorted.map((g) => {
          const fav = isFav(g);
          return (
            <button
              key={g.game_id}
              onClick={() => onSelectGame(g)}
              className={cn(
                "flex-shrink-0 w-60 text-left rounded-xl border p-3 transition-all",
                "bg-slate-800/80 hover:bg-slate-700/80 shadow-sm shadow-black/20",
                fav
                  ? "border-amber-500/40 ring-1 ring-amber-500/20"
                  : "border-slate-700",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <StatusChip status={g.completed ? "final" : "scheduled"} />
                {fav && <span className="text-amber-300 text-xs">★</span>}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200 truncate">
                    {teamName(g.away_team_id, g.away_name)}
                  </span>
                  {g.completed && (
                    <span className="text-sm font-semibold text-slate-100">
                      {g.away_score}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200 truncate">
                    {teamName(g.home_team_id, g.home_name)}
                  </span>
                  {g.completed && (
                    <span className="text-sm font-semibold text-slate-100">
                      {g.home_score}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
