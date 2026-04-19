"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CbbGame, CbbTeam, ParticipationRow } from "@/lib/supabase/types";
import { GameCard } from "./GameCard";
import { GameDetailModal } from "./GameDetailModal";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

type SortMode = "date" | "favCount" | "favIP";

const normName = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/[^a-z]/g, "");

interface FavoritesViewProps {
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

export function FavoritesView({
  favorites,
  toggleFavorite,
}: FavoritesViewProps) {
  const [teams, setTeams] = useState<Record<string, CbbTeam>>({});
  const [pitcherById, setPitcherById] = useState<
    Record<
      string,
      {
        team_id: string;
        name: string;
        headshot: string | null;
        espn_id: string | null;
      }
    >
  >({});
  const [games, setGames] = useState<CbbGame[]>([]);
  const [participationByGame, setParticipationByGame] = useState<
    Record<string, ParticipationRow[]>
  >({});
  const [headshotsMap, setHeadshotsMap] = useState<
    Record<string, string | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [selectedGame, setSelectedGame] = useState<CbbGame | null>(null);
  const [favoriteGameIds, setFavoriteGameIds] = useLocalStorage<string[]>(
    "cbb-favorite-games",
    [],
  );
  const [watchedGameIds, setWatchedGameIds] = useLocalStorage<string[]>(
    "cbb-watched-games",
    [],
  );

  const favoritePitcherIds = useMemo(() => new Set(favorites), [favorites]);

  const favsByTeam = useMemo(() => {
    const map: Record<
      string,
      Array<{
        pitcher_id: string;
        espn_id: string | null;
        pitcher_name: string;
        team_id: string;
        headshot: string | null;
      }>
    > = {};
    for (const pid of favorites) {
      const info = pitcherById[pid];
      if (!info) continue;
      if (!map[info.team_id]) map[info.team_id] = [];
      map[info.team_id].push({
        pitcher_id: pid,
        espn_id: info.espn_id,
        pitcher_name: info.name,
        team_id: info.team_id,
        headshot: info.headshot,
      });
    }
    return map;
  }, [favorites, pitcherById]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        // 1. Load all teams
        const { data: teamsData } = await supabase
          .from("cbb_teams")
          .select("*");
        const teamsMap: Record<string, CbbTeam> = {};
        (teamsData || []).forEach((t: CbbTeam) => {
          teamsMap[t.team_id] = t;
        });
        setTeams(teamsMap);

        // 2. Load all pitchers (needed to resolve favorites → espn_id + name)
        const allPitchers: {
          pitcher_id: string;
          espn_id: string | null;
          team_id: string;
          name: string;
          headshot: string | null;
        }[] = [];
        let pitcherPage = 0;
        while (true) {
          const { data: pd } = await supabase
            .from("cbb_pitchers")
            .select("pitcher_id, espn_id, team_id, name, headshot")
            .range(pitcherPage * 1000, (pitcherPage + 1) * 1000 - 1);
          if (!pd || pd.length === 0) break;
          allPitchers.push(...pd);
          if (pd.length < 1000) break;
          pitcherPage++;
        }
        const pMap: Record<
          string,
          {
            team_id: string;
            name: string;
            headshot: string | null;
            espn_id: string | null;
          }
        > = {};
        // Match ScheduleView's headshot-map key scheme so GameCard's
        // lookupHeadshot hits: keep spaces/digits in the normalized
        // key, plus a team-scoped last-name-only key for D1Baseball.
        const normHeadshot = (s: string) =>
          s
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();
        const hMap: Record<string, string | null> = {};
        for (const p of allPitchers) {
          if (p.pitcher_id) {
            pMap[p.pitcher_id] = {
              team_id: p.team_id,
              name: p.name,
              headshot: p.headshot,
              espn_id: p.espn_id,
            };
          }
          if (p.headshot) {
            const n = normHeadshot(p.name);
            hMap[n] = p.headshot;
            hMap[`${p.team_id}:${n}`] = p.headshot;
            const parts = p.name.trim().split(/\s+/);
            const lastWord = parts[parts.length - 1]
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");
            if (lastWord) {
              const lnKey = `${p.team_id}:ln:${lastWord}`;
              hMap[lnKey] = lnKey in hMap ? null : p.headshot;
            }
          }
        }
        setPitcherById(pMap);
        setHeadshotsMap(hMap);

        if (favorites.length === 0) {
          setGames([]);
          setParticipationByGame({});
          setLoading(false);
          return;
        }

        // 3. Build lookup of favorite espn_ids + normalized names
        const favoriteEspnIds: string[] = [];
        const favoriteNames = new Set<string>();
        for (const pid of favorites) {
          const info = pMap[pid];
          if (!info) continue;
          if (info.espn_id) favoriteEspnIds.push(info.espn_id);
          if (info.name) favoriteNames.add(normName(info.name));
        }

        // 4. Query participation rows matching favorites (by espn_id or name)
        const favGameIds = new Set<string>();

        if (favoriteEspnIds.length > 0) {
          // Chunk the in() filter to avoid URL length limits
          const chunk = 200;
          for (let i = 0; i < favoriteEspnIds.length; i += chunk) {
            const slice = favoriteEspnIds.slice(i, i + chunk);
            const { data } = await supabase
              .from("cbb_pitcher_participation")
              .select("game_id")
              .in("pitcher_id", slice);
            (data || []).forEach((r: { game_id: string }) =>
              favGameIds.add(r.game_id),
            );
          }
        }

        // Fallback: match by name (covers walk-ons without espn_id)
        if (favoriteNames.size > 0) {
          // Can't do normalized-name matching server-side cheaply; fetch
          // all participation rows and filter client-side. This is still
          // lighter than fetching all games + participation unconditionally.
          let page = 0;
          while (true) {
            const { data } = await supabase
              .from("cbb_pitcher_participation")
              .select("game_id, pitcher_name")
              .range(page * 1000, (page + 1) * 1000 - 1);
            if (!data || data.length === 0) break;
            for (const r of data as {
              game_id: string;
              pitcher_name: string;
            }[]) {
              if (favoriteNames.has(normName(r.pitcher_name))) {
                favGameIds.add(r.game_id);
              }
            }
            if (data.length < 1000) break;
            page++;
          }
        }

        if (favGameIds.size === 0) {
          setGames([]);
          setParticipationByGame({});
          setLoading(false);
          return;
        }

        // 5. Fetch the games + full participation for those games
        const gameIdList = Array.from(favGameIds);
        const loadedGames: CbbGame[] = [];
        const chunk = 200;
        for (let i = 0; i < gameIdList.length; i += chunk) {
          const slice = gameIdList.slice(i, i + chunk);
          const { data } = await supabase
            .from("cbb_games")
            .select("*")
            .in("game_id", slice);
          if (data) loadedGames.push(...(data as CbbGame[]));
        }
        setGames(loadedGames);

        const partByGame: Record<string, ParticipationRow[]> = {};
        for (let i = 0; i < gameIdList.length; i += chunk) {
          const slice = gameIdList.slice(i, i + chunk);
          const { data } = await supabase
            .from("cbb_pitcher_participation")
            .select("*")
            .in("game_id", slice);
          (data || []).forEach((row: ParticipationRow) => {
            if (!partByGame[row.game_id]) partByGame[row.game_id] = [];
            partByGame[row.game_id].push(row);
          });
        }
        setParticipationByGame(partByGame);
      } catch (e) {
        console.error("Failed to load favorites view:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [favorites]);

  const favGamesComputed = useMemo(() => {
    const result: Array<{
      game: CbbGame;
      favCount: number;
      favIP: number;
    }> = [];

    const favoriteEspnIds = new Set<string>();
    const favoriteNames = new Set<string>();
    for (const pid of favorites) {
      const info = pitcherById[pid];
      if (!info) continue;
      if (info.espn_id) favoriteEspnIds.add(info.espn_id);
      if (info.name) favoriteNames.add(normName(info.name));
    }
    const isFavRow = (r: ParticipationRow) =>
      (r.pitcher_id && favoriteEspnIds.has(r.pitcher_id)) ||
      favoriteNames.has(normName(r.pitcher_name));

    for (const game of games) {
      const rows = participationByGame[game.game_id] || [];
      const favRows = rows.filter(isFavRow);
      if (favRows.length === 0) continue;
      let totalIP = 0;
      for (const r of favRows) {
        totalIP += parseFloat(r.stats?.IP ?? "") || 0;
      }
      result.push({ game, favCount: favRows.length, favIP: totalIP });
    }
    return result;
  }, [games, participationByGame, favorites, pitcherById]);

  const sortedFavGames = useMemo(() => {
    const arr = [...favGamesComputed];
    if (sortMode === "favCount") {
      arr.sort((a, b) => b.favCount - a.favCount || b.favIP - a.favIP);
    } else if (sortMode === "favIP") {
      arr.sort((a, b) => b.favIP - a.favIP || b.favCount - a.favCount);
    } else {
      arr.sort(
        (a, b) =>
          new Date(b.game.date).getTime() - new Date(a.game.date).getTime(),
      );
    }
    return arr;
  }, [favGamesComputed, sortMode]);

  const trackedTeamIds = useMemo(() => new Set(Object.keys(teams)), [teams]);

  const toggleFavoriteGame = useCallback(
    (gameId: string) => {
      setFavoriteGameIds((prev) =>
        prev.includes(gameId)
          ? prev.filter((id) => id !== gameId)
          : [...prev, gameId],
      );
    },
    [setFavoriteGameIds],
  );

  const toggleWatchedGame = useCallback(
    (gameId: string) => {
      setWatchedGameIds((prev) =>
        prev.includes(gameId)
          ? prev.filter((id) => id !== gameId)
          : [...prev, gameId],
      );
    },
    [setWatchedGameIds],
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse">
        Loading favorites...
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        You have no favorited pitchers. Star pitchers from the Rosters tab to
        see their games here.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-2xl font-extrabold text-slate-100">
          Favorite Pitcher Games
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({sortedFavGames.length}{" "}
            {sortedFavGames.length === 1 ? "game" : "games"})
          </span>
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="fav-sort" className="text-sm text-slate-400">
            Sort by:
          </label>
          <select
            id="fav-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-slate-800 text-slate-100 border border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="date">Date (newest first)</option>
            <option value="favCount"># Favorite Pitchers</option>
            <option value="favIP">Total Favorite IP</option>
          </select>
        </div>
      </div>

      {sortedFavGames.length === 0 ? (
        <p className="text-center text-slate-500 py-8">
          No games yet with pitching data for your favorites.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sortedFavGames.map(({ game, favCount, favIP }) => (
            <div key={game.game_id} className="space-y-1">
              <div className="flex items-center gap-3 px-2 text-xs">
                <span className="font-semibold text-amber-300">
                  {favCount} fav {favCount === 1 ? "pitcher" : "pitchers"}
                </span>
                {favIP > 0 && (
                  <span className="font-semibold text-blue-300">
                    {favIP.toFixed(1)} fav IP
                  </span>
                )}
              </div>
              <GameCard
                game={game}
                teams={teams}
                trackedTeamIds={trackedTeamIds}
                participation={participationByGame[game.game_id] || []}
                headshotsMap={headshotsMap}
                onClick={() => setSelectedGame(game)}
                isFavorite={favoriteGameIds.includes(game.game_id)}
                isWatched={watchedGameIds.includes(game.game_id)}
                onToggleFavorite={() => toggleFavoriteGame(game.game_id)}
                onToggleWatched={() => toggleWatchedGame(game.game_id)}
                favoritePitcherIds={favoritePitcherIds}
                pitcherFilter="favorites-or-played"
                favsByTeam={favsByTeam}
                onToggleFavoritePitcher={toggleFavorite}
              />
            </div>
          ))}
        </div>
      )}

      <GameDetailModal
        game={selectedGame}
        teams={teams}
        favoritePitcherIds={favoritePitcherIds}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
