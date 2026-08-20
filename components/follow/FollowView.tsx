"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { CbbPitcher, CbbTeam } from "@/lib/supabase/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { RosterSkeleton } from "@/components/roster/RosterSkeleton";
import { cn } from "@/lib/utils";

type Followed = CbbPitcher & { team: CbbTeam };

/**
 * Follow tab — every followed player on one page, grouped by team, so Chace
 * can see headshots + names across all rosters at once instead of opening
 * team cards one at a time. Following is toggled from the Data Quality box on
 * a pitcher card; this view is read-plus-unfollow only.
 */
export function FollowView({
  follows,
  toggleFollow,
}: {
  follows: string[];
  toggleFollow: (pitcherId: string) => void;
}) {
  const [pitchers, setPitchers] = useState<CbbPitcher[]>([]);
  const [teams, setTeams] = useState<Record<string, CbbTeam>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: teamsData } = await supabase.from("cbb_teams").select("*");
      const all: CbbPitcher[] = [];
      let page = 0;
      while (true) {
        const { data } = await supabase
          .from("cbb_pitchers")
          .select(
            "pitcher_id, team_id, name, display_name, number, position, hometown, headshot",
          )
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        all.push(...(data as CbbPitcher[]));
        if (data.length < 1000) break;
        page++;
      }
      if (!alive) return;
      const map: Record<string, CbbTeam> = {};
      (teamsData || []).forEach((t: CbbTeam) => (map[t.team_id] = t));
      setTeams(map);
      setPitchers(all);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const followSet = useMemo(() => new Set(follows), [follows]);

  // Followed players, grouped by team, teams alphabetical by display name.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = pitchers
      .filter((p) => followSet.has(p.pitcher_id))
      .map((p) => ({ ...p, team: teams[p.team_id] }))
      .filter((p): p is Followed => Boolean(p.team))
      .filter((p) =>
        q
          ? (p.display_name || p.name).toLowerCase().includes(q) ||
            p.team.display_name.toLowerCase().includes(q)
          : true,
      );

    const byTeam = new Map<string, Followed[]>();
    for (const p of rows) {
      if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, []);
      byTeam.get(p.team_id)!.push(p);
    }
    return [...byTeam.entries()]
      .map(([teamId, list]) => ({
        team: teams[teamId],
        players: list.sort((a, b) => {
          const na = Number(a.number ?? 999);
          const nb = Number(b.number ?? 999);
          if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb)
            return na - nb;
          return (a.display_name || a.name).localeCompare(
            b.display_name || b.name,
          );
        }),
      }))
      .sort((a, b) => a.team.display_name.localeCompare(b.team.display_name));
  }, [pitchers, teams, followSet, query]);

  const total = groups.reduce((n, g) => n + g.players.length, 0);

  if (loading) return <RosterSkeleton />;

  if (follows.length === 0) {
    return (
      <EmptyState
        title="No players followed yet"
        description="Hit the Follow button on any player card in the Rosters tab — it's the person icon next to the data-issues triangle. They'll all collect here, grouped by team."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search followed players or teams..."
          className="flex-1 min-w-[220px] max-w-sm px-4 py-2 rounded-full bg-slate-800 border border-slate-600 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-sm text-slate-400">
          <span className="font-semibold text-emerald-400">{total}</span>{" "}
          {total === 1 ? "player" : "players"} across{" "}
          <span className="font-semibold text-slate-200">{groups.length}</span>{" "}
          {groups.length === 1 ? "team" : "teams"}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No matches"
          description="No followed players match that search."
        />
      ) : (
        <div className="space-y-8">
          {groups.map(({ team, players }) => (
            <section key={team.team_id}>
              <div className="flex items-center gap-3 mb-3 sticky top-32 z-20 bg-slate-900 py-2">
                {team.logo && (
                  <div className="w-8 h-8 relative shrink-0">
                    <Image
                      src={team.logo}
                      alt={team.display_name}
                      fill
                      className="object-contain"
                      sizes="32px"
                    />
                  </div>
                )}
                <h2 className="text-lg font-bold text-slate-100">
                  {team.display_name}
                </h2>
                <span className="text-xs text-slate-400">
                  {players.length} followed
                </span>
                <div className="flex-1 h-px bg-slate-700 ml-2" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {players.map((p) => (
                  <FollowCard
                    key={`${p.team_id}:${p.pitcher_id}`}
                    player={p}
                    onUnfollow={() => toggleFollow(p.pitcher_id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowCard({
  player,
  onUnfollow,
}: {
  player: Followed;
  onUnfollow: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const name = player.display_name || player.name;
  const showHeadshot = player.headshot && !imgError;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-sm shadow-black/20 hover:shadow-lg transition-shadow">
      <div className="relative aspect-square bg-gradient-to-br from-slate-700 to-slate-600">
        {showHeadshot ? (
          <Image
            src={player.headshot!}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-400">
            {initials}
          </div>
        )}
        {player.number && (
          <span className="absolute top-1.5 left-1.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-100 border border-slate-600">
            #{player.number}
          </span>
        )}
        <button
          type="button"
          onClick={onUnfollow}
          title="Unfollow"
          className={cn(
            "absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center",
            "bg-emerald-600 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
            "hover:bg-red-600",
          )}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </button>
      </div>
      <div className="p-2">
        <p className="text-sm font-bold text-slate-100 truncate" title={name}>
          {name}
        </p>
        <p className="text-[11px] text-slate-400 truncate">
          {[player.position, player.team.display_name]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
