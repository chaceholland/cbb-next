"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Follow list — players collected onto the Follow tab. Deliberately separate
 * from useFavorites: following a player never stars them and vice versa.
 * Cloud-backed (u18_follows) so the list survives a browser clear and follows
 * Chace to his phone, matching how Favorites works.
 */
export function useFollows() {
  const [follows, setFollows] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/follows");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setFollows(data);
        }
      } catch (e) {
        console.error("[Follow] Failed to load:", e);
      }
      setLoaded(true);
    }
    load();
  }, []);

  const toggleFollow = useCallback(async (pitcherId: string) => {
    const flip = (prev: string[]) =>
      prev.includes(pitcherId)
        ? prev.filter((id) => id !== pitcherId)
        : [...prev, pitcherId];

    setFollows(flip); // optimistic
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitcher_id: pitcherId }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setFollows(flip); // revert
    }
  }, []);

  return { follows, toggleFollow, loaded } as const;
}
