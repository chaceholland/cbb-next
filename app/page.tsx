'use client';
import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { HeroSection } from '@/components/HeroSection';
import { TabBar } from '@/components/TabBar';
import { ScheduleView } from '@/components/schedule/ScheduleView';
import { RosterView } from '@/components/roster/RosterView';

type Tab = 'schedule' | 'rosters';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');

  // Sync tab with URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Tab;
    if (hash === 'schedule' || hash === 'rosters') setActiveTab(hash);

    const handler = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (h === 'schedule' || h === 'rosters') setActiveTab(h);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  return (
    <>
      <Navigation />
      <HeroSection />
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center mb-8">
            <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
          {activeTab === 'schedule' ? <ScheduleView /> : <RosterView />}
        </div>
      </main>
    </>
  );
}
