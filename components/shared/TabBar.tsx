'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
}

export interface TabBarProps<T extends string = string> {
  items: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  /**
   * Tailwind gradient classes for the active-tab pill. Defaults to CBB's brand
   * gradient so existing callers stay pixel-identical. Per-app callers can
   * override once the suite settles on a shared identity (Pass 3 §C).
   */
  activeGradient?: string;
}

export function TabBar<T extends string = string>({
  items,
  activeTab,
  onTabChange,
  activeGradient = 'from-[#1a73e8] to-[#ea4335]',
}: TabBarProps<T>) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={cn(
      'sticky top-16 z-40 transition-shadow duration-200',
      isScrolled && 'shadow-md shadow-black/30'
    )}>
      <div className="bg-slate-900 py-4">
        <div className="flex justify-center">
          <div className="flex gap-2 p-1 bg-slate-800 rounded-xl w-fit">
            {items.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'relative px-6 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                  activeTab === tab.id ? 'text-white' : 'text-slate-300 hover:text-white'
                )}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className={cn('absolute inset-0 rounded-lg bg-gradient-to-r', activeGradient)}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
