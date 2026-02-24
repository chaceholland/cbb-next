import { PitcherSeasonStats } from '@/lib/stats/types';
import { formatStat } from '@/lib/stats/calculations';

interface PitcherStatsCardProps {
  stats: PitcherSeasonStats | null;
  label?: string;
  className?: string;
}

export function PitcherStatsCard({ stats, label = 'Season Stats', className = '' }: PitcherStatsCardProps) {
  if (!stats) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">{label}</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">No stats available</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-slate-100">{label}</h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">Games</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.games}</div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">IP</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {formatStat(stats.innings_pitched)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">ERA</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatStat(stats.era)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">WHIP</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatStat(stats.whip)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">K</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.strikeouts}</div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">BB</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.walks}</div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">K/9</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatStat(stats.k_per_9)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-600 dark:text-slate-400">K/BB</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatStat(stats.k_bb_ratio)}
          </div>
        </div>
      </div>
    </div>
  );
}
