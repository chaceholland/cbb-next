'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PitcherGameStats } from '@/lib/stats/types';
import { calculateERA, calculateKPer9, formatStat } from '@/lib/stats/calculations';

interface PerformanceChartProps {
  games: PitcherGameStats[];
  metric: 'era' | 'k_per_9' | 'innings';
}

export function PerformanceChart({ games, metric }: PerformanceChartProps) {
  // Sort games by date
  const sortedGames = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative or per-game stats
  const chartData = sortedGames.map((game, index) => {
    const gamesUpToNow = sortedGames.slice(0, index + 1);

    const totalIP = gamesUpToNow.reduce((sum, g) => sum + g.innings_pitched, 0);
    const totalER = gamesUpToNow.reduce((sum, g) => sum + g.earned_runs, 0);
    const totalK = gamesUpToNow.reduce((sum, g) => sum + g.strikeouts, 0);

    return {
      date: new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      opponent: game.opponent_name,
      era: calculateERA(totalER, totalIP),
      k_per_9: calculateKPer9(totalK, totalIP),
      innings: game.innings_pitched,
    };
  });

  const metricLabel = {
    era: 'ERA (Season)',
    k_per_9: 'K/9 (Season)',
    innings: 'Innings Pitched',
  }[metric];

  const metricColor = {
    era: '#3b82f6', // blue
    k_per_9: '#10b981', // green
    innings: '#6366f1', // indigo
  }[metric];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-slate-100">{metricLabel} Trend</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            domain={metric === 'innings' ? [0, 'auto'] : ['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number | undefined) => value !== undefined ? formatStat(value) : 'N/A'}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return `${label} vs ${payload[0].payload.opponent}`;
              }
              return label;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={metricColor}
            strokeWidth={2}
            dot={{ fill: metricColor, r: 4 }}
            activeDot={{ r: 6 }}
            name={metricLabel}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
