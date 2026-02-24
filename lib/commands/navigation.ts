'use client';

import { commandRegistry } from './registry';

export function registerNavigationCommands(
  setActiveTab: (tab: 'schedule' | 'rosters' | 'analytics') => void
) {
  commandRegistry.register({
    id: 'nav-schedule',
    label: 'Go to Schedule',
    description: 'View the game schedule',
    category: 'navigation',
    shortcut: ['1'],
    keywords: ['schedule', 'games', 'calendar'],
    action: () => setActiveTab('schedule'),
  });

  commandRegistry.register({
    id: 'nav-rosters',
    label: 'Go to Rosters',
    description: 'View team rosters and pitchers',
    category: 'navigation',
    shortcut: ['2'],
    keywords: ['rosters', 'teams', 'pitchers', 'players'],
    action: () => setActiveTab('rosters'),
  });

  commandRegistry.register({
    id: 'nav-analytics',
    label: 'Go to Analytics',
    description: 'View analytics and insights',
    category: 'navigation',
    shortcut: ['3'],
    keywords: ['analytics', 'stats', 'insights', 'data'],
    action: () => setActiveTab('analytics'),
  });
}
