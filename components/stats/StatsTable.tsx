import { PitcherSeasonStats } from '@/lib/stats/types';
import { formatStat } from '@/lib/stats/calculations';

interface StatsTableProps {
  pitchers: PitcherSeasonStats[];
  onPitcherClick?: (pitcherId: string) => void;
}

export function StatsTable({ pitchers, onPitcherClick }: StatsTableProps) {
  if (pitchers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-gray-600 dark:text-slate-400">No pitcher stats available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Pitcher</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">G</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">IP</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">ERA</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">K</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">BB</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">WHIP</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">K/9</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {pitchers.map((pitcher) => (
            <tr
              key={pitcher.pitcher_id}
              onClick={() => onPitcherClick?.(pitcher.pitcher_id)}
              className={onPitcherClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700' : ''}
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                {pitcher.pitcher_name}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {pitcher.games}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {formatStat(pitcher.innings_pitched)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatStat(pitcher.era)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {pitcher.strikeouts}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                {pitcher.walks}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatStat(pitcher.whip)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400">
                {formatStat(pitcher.k_per_9)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
