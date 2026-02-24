'use client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Tab = 'schedule' | 'rosters' | 'analytics';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabBar({ activeTab, onTabChange }: Props) {
  const tabs = [
    { id: 'schedule' as const, label: '📅 Schedule' },
    { id: 'rosters' as const, label: '⚾ Rosters' },
    { id: 'analytics' as const, label: '📊 Analytics' },
  ];

  return (
    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative px-6 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
            activeTab === tab.id ? 'text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#1a73e8] to-[#ea4335]"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
