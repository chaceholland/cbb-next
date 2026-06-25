"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

type HubData = {
  today: string;
  trackers: TrackerSummary[];
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatGameTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TrackerCard({ tracker }: { tracker: TrackerSummary }) {
  const hasToday = tracker.games_today.length > 0;
  const sortedGames = [...tracker.games_today].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return (a.start ?? "").localeCompare(b.start ?? "");
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <a
          href={tracker.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 transition-colors"
        >
          {tracker.name} →
        </a>
        <span className="text-xs text-slate-400" title={tracker.last_sync ?? ""}>
          synced {formatRelative(tracker.last_sync)}
        </span>
      </div>

      {tracker.note && (
        <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          {tracker.note}
        </div>
      )}

      {hasToday ? (
        <div className="space-y-1.5">
          {sortedGames.slice(0, 6).map((g) => (
            <div
              key={g.id}
              className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-md ${
                g.is_favorite
                  ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                  : "bg-slate-50 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {g.is_favorite && <span className="text-amber-500">★</span>}
                <span className="truncate text-slate-800 dark:text-slate-200">
                  <span className="text-slate-500 dark:text-slate-400">{g.away}</span>
                  <span className="mx-1.5 text-slate-300 dark:text-slate-600">@</span>
                  {g.home}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 ml-2 shrink-0">
                {g.completed ? "Final" : formatGameTime(g.start)}
              </div>
            </div>
          ))}
          {sortedGames.length > 6 && (
            <div className="text-xs text-slate-400 text-center pt-1">
              + {sortedGames.length - 6} more
            </div>
          )}
        </div>
      ) : tracker.next_game ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Next:{" "}
          <span className="text-slate-700 dark:text-slate-200">
            {tracker.next_game.away} @ {tracker.next_game.home}
          </span>{" "}
          ·{" "}
          <span className="text-slate-500 dark:text-slate-400">
            {tracker.next_game.start
              ? new Date(tracker.next_game.start).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : ""}
          </span>
        </div>
      ) : (
        <div className="text-sm text-slate-400 dark:text-slate-500 italic">
          No games today.
        </div>
      )}
    </div>
  );
}

export default function HubPage() {
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/hub/summary");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setData(j);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              ← CBB Tracker
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              My Sports
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Today's slate across all your trackers
              {data?.today ? ` — ${data.today}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
            Hub summary failed to load: {error}
          </div>
        )}

        {!data && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.trackers.map((t) => (
              <TrackerCard key={t.key} tracker={t} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
