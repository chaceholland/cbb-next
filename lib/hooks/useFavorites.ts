"use client";

import { useState, useEffect, useCallback } from "react";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase on mount, fall back to localStorage
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/favorites");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setFavorites(data);
            // Sync localStorage for offline compat
            window.localStorage.setItem("cbb-favorites", JSON.stringify(data));
          }
        }
      } catch {
        // Fallback to localStorage
        try {
          const stored = window.localStorage.getItem("cbb-favorites");
          if (stored) setFavorites(JSON.parse(stored));
        } catch {}
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
