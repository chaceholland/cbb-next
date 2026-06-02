"use client";

import { useState, useEffect, useCallback } from "react";

// Legacy localStorage keys — game favorites used to live in the browser only.
// We migrate them into Supabase once, then stop reading localStorage so the
// cloud copy is authoritative (and survives across browsers/sessions).
const LS_KEY = "cbb-favorite-games";
const LS_MIGRATED = "cbb-favorite-games-migrated";

export function useGameFavorites() {
  const [favoriteGameIds, setFavoriteGameIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase (cloud-only), migrating any pre-existing localStorage
  // favorites on first run so nothing the user already hearted is lost.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let serverIds: string[] = [];
      try {
        const res = await fetch("/api/game-favorites");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) serverIds = data;
        }
      } catch (e) {
        console.error("[GameFav] Failed to load:", e);
      }

      // One-time migration of localStorage favorites into Supabase.
      try {
        if (
          typeof window !== "undefined" &&
          !localStorage.getItem(LS_MIGRATED)
        ) {
          const raw = localStorage.getItem(LS_KEY);
          const localIds: string[] = raw ? JSON.parse(raw) : [];
          const toMigrate = localIds.filter((id) => !serverIds.includes(id));
          if (toMigrate.length > 0) {
            await Promise.allSettled(
              toMigrate.map((game_id) =>
                fetch("/api/game-favorites", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ game_id }),
                }),
              ),
            );
            serverIds = Array.from(new Set([...serverIds, ...toMigrate]));
          }
          localStorage.setItem(LS_MIGRATED, "1");
          localStorage.removeItem(LS_KEY);
        }
      } catch (e) {
        console.error("[GameFav] Migration failed:", e);
      }

      if (!cancelled) {
        setFavoriteGameIds(serverIds);
        setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavoriteGame = useCallback(async (gameId: string) => {
    // Optimistic update
    setFavoriteGameIds((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId],
    );

    // Sync to Supabase
    try {
      await fetch("/api/game-favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId }),
      });
    } catch {
      // Revert on failure
      setFavoriteGameIds((prev) =>
        prev.includes(gameId)
          ? prev.filter((id) => id !== gameId)
          : [...prev, gameId],
      );
    }
  }, []);

  return { favoriteGameIds, toggleFavoriteGame, loaded } as const;
}
