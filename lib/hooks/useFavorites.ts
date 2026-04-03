"use client";

import { useState, useEffect, useCallback } from "react";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase on mount, fall back to localStorage
  useEffect(() => {
    async function load() {
      // Always load localStorage first as baseline
      let localFavs: string[] = [];
      try {
        const stored = window.localStorage.getItem("cbb-favorites");
        if (stored) localFavs = JSON.parse(stored);
      } catch {}

      try {
        const res = await fetch("/api/favorites");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Merge: keep anything in localStorage that's not in API, plus API data
            const merged = [...new Set([...data, ...localFavs])];
            setFavorites(merged);
            window.localStorage.setItem("cbb-favorites", JSON.stringify(merged));
          } else {
            // API returned empty — keep localStorage data, don't wipe it
            setFavorites(localFavs);
          }
        } else {
          setFavorites(localFavs);
        }
      } catch {
        // Fallback to localStorage
        setFavorites(localFavs);
      }
      setLoaded(true);
    }
    load();
  }, []);

  const toggleFavorite = useCallback(async (pitcherId: string) => {
    // Optimistic update
    setFavorites((prev) => {
      const next = prev.includes(pitcherId)
        ? prev.filter((id) => id !== pitcherId)
        : [...prev, pitcherId];
      window.localStorage.setItem("cbb-favorites", JSON.stringify(next));
      return next;
    });

    // Sync to Supabase
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitcher_id: pitcherId }),
      });
    } catch {
      // Revert on failure
      setFavorites((prev) => {
        const reverted = prev.includes(pitcherId)
          ? prev.filter((id) => id !== pitcherId)
          : [...prev, pitcherId];
        window.localStorage.setItem("cbb-favorites", JSON.stringify(reverted));
        return reverted;
      });
    }
  }, []);

  return { favorites, toggleFavorite, loaded } as const;
}
