"use client";

import { useState, useEffect, useCallback } from "react";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase (cloud-only, no localStorage)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/favorites");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setFavorites(data);
          }
        }
      } catch (e) {
        console.error("[Fav] Failed to load:", e);
      }
      setLoaded(true);
    }
    load();
  }, []);

  const toggleFavorite = useCallback(async (pitcherId: string) => {
    // Optimistic update
    setFavorites((prev) => {
      return prev.includes(pitcherId)
        ? prev.filter((id) => id !== pitcherId)
        : [...prev, pitcherId];
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
        return prev.includes(pitcherId)
          ? prev.filter((id) => id !== pitcherId)
          : [...prev, pitcherId];
      });
    }
  }, []);

  return { favorites, toggleFavorite, loaded } as const;
}
