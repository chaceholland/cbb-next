'use client';

import { useState, useEffect } from 'react';
import { getConferenceStandings } from '@/lib/stats/team-records';
import { TeamRecord } from '@/lib/stats/types';
import { formatStat } from '@/lib/stats/calculations';

interface ConferenceStandingsProps {
  defaultConference?: string;
}

const CONFERENCES = [
  'SEC', 'ACC', 'Big 12', 'Big Ten', 'Pac-12',
  'American', 'Sun Belt', 'C-USA', 'Mountain West', 'MAC'
];

export function ConferenceStandings({ defaultConference = 'SEC' }: ConferenceStandingsProps) {
  const [conference, setConference] = useState(defaultConference);
  const [standings, setStandings] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      setLoading(true);
      const data = await getConferenceStandings(conference);
      setStandings(data);
      setLoading(false);
    }

    loadStandings();
  }, [conference]);

  return (
    <div className="space-y-4">
      {/* Conference selector */}
      <div className="flex gap-2 flex-wrap">
        {CONFERENCES.map(conf => (
          <button
            key={conf}
            onClick={() => setConference(conf)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              conference === conf
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {conf}
          </button>
        ))}
      </div>

      {/* Standings table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
        {loading ? (
          <div className="p-8 text-center text-gray-600 dark:text-slate-400">Loading standings...</div>
        ) : standings.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-slate-400">No teams found in {conference}</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300">Team</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">W-L</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">Win%</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">Conf</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-slate-300">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {standings.map((team, index) => (
                <tr key={team.team_id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-slate-100">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                    {team.team_name}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                    {team.wins}-{team.losses}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {formatStat(team.win_percentage, 3)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-slate-300">
                    {team.conference_wins}-{team.conference_losses}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400">
                    {team.streak}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
