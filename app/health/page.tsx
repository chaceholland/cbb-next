'use client';

// Pass 4 Feature #5 — Data-health page.
// One card per tracker: sync freshness, last run, 24h error count, recent runs.
// Client-fetches /api/health-all so the route stays a plain client page.

import { useEffect, useState } from 'react';
import { DataFreshnessChip, SectionHeader, cn } from '@/components/shared';

type SyncRow = {
  sync_type: string | null;
  records_count: number | null;
  status: string | null;
  error_message: string | null;
  synced_at: string | null;
};

type TrackerHealth = {
  key: string;
  name: string;
  ok: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunType: string | null;
  lastRunRecords: number | null;
  lastSuccessAt: string | null;
  errors24h: number;
  lastError: string | null;
  recent: SyncRow[];
};

function fmt(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function StatusDot({ status }: { status: string | null }) {
  const okStatus = status === 'success';
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full shrink-0',
        okStatus ? 'bg-emerald-500' : 'bg-red-500',
      )}
      title={status ?? 'unknown'}
    />
  );
}

export default function HealthPage() {
  const [trackers, setTrackers] = useState<TrackerHealth[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/health-all')
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setTrackers(d.trackers ?? []);
        setGeneratedAt(d.generatedAt ?? null);
      })
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <SectionHeader
        title="Data health"
        subtitle={
          generatedAt
            ? `Sync status across all trackers · checked ${fmt(generatedAt)}`
            : 'Sync status across all trackers'
        }
      />

      {error && (
        <p className="mt-6 text-sm text-red-400">Failed to load: {error}</p>
      )}
      {!trackers && !error && (
        <p className="mt-6 text-sm text-slate-400 animate-pulse">Loading…</p>
      )}

      {trackers && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {trackers.map((t) => (
            <div
              key={t.key}
              className="rounded-2xl bg-slate-800 border border-slate-700 shadow-md shadow-black/30 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-100 truncate">{t.name}</h3>
                <DataFreshnessChip lastSync={t.lastSuccessAt} />
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={t.lastRunStatus} />
                  <span>
                    Last run {fmt(t.lastRunAt)}
                    {t.lastRunType ? ` · ${t.lastRunType}` : ''}
                    {t.lastRunRecords != null
                      ? ` · ${t.lastRunRecords} records`
                      : ''}
                  </span>
                </div>
                <div>
                  Errors (24h):{' '}
                  <span
                    className={cn(
                      'font-semibold',
                      t.errors24h > 0 ? 'text-red-400' : 'text-emerald-400',
                    )}
                  >
                    {t.errors24h}
                  </span>
                </div>
                {t.lastError && (
                  <div className="text-red-400/80 line-clamp-2 break-words">
                    {t.lastError}
                  </div>
                )}
              </div>

              {t.recent.length > 0 && (
                <ul className="border-t border-slate-700 pt-2 space-y-1">
                  {t.recent.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-[11px] text-slate-400"
                    >
                      <StatusDot status={r.status} />
                      <span className="tabular-nums">{fmt(r.synced_at)}</span>
                      <span className="truncate">{r.sync_type ?? ''}</span>
                      <span className="ml-auto tabular-nums">
                        {r.records_count ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
