'use client';
import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { HeroSection } from '@/components/HeroSection';
import { TabBar } from '@/components/TabBar';
import { ScheduleView } from '@/components/schedule/ScheduleView';
import { RosterView } from '@/components/roster/RosterView';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { CommandPalette } from '@/components/command/CommandPalette';
import { registerNavigationCommands } from '@/lib/commands/navigation';
import { useKeyboard } from '@/lib/hooks/useKeyboard';

type Tab = 'schedule' | 'rosters' | 'analytics';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');

  // Sync tab with URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Tab;
    if (hash === 'schedule' || hash === 'rosters' || hash === 'analytics') setActiveTab(hash);

    const handler = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (h === 'schedule' || h === 'rosters' || h === 'analytics') setActiveTab(h);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Register navigation commands on mount
  useEffect(() => {
    registerNavigationCommands(handleTabChange);
  }, []);

  // Add keyboard shortcuts for direct tab switching
  useKeyboard([
    { key: '1', action: () => handleTabChange('schedule') },
    { key: '2', action: () => handleTabChange('rosters') },
    { key: '3', action: () => handleTabChange('analytics') },
  ]);

  return (
    <>
      <CommandPalette />
      <Navigation />
      <HeroSection />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center mb-8">
            <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
          {activeTab === 'schedule' && <ScheduleView />}
          {activeTab === 'rosters' && <RosterView />}
          {activeTab === 'analytics' && <AnalyticsView />}
        </div>
      </main>
    </>
  );
}
