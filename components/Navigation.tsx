'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavigationProps {
  onSearch?: (query: string) => void;
  favoritesCount?: number;
  onFavoritesClick?: () => void;
}

export function Navigation({
  onSearch,
  favoritesCount = 0,
  onFavoritesClick,
}: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        'backdrop-blur-xl bg-white/80 dark:bg-slate-900/80',
        isScrolled && 'shadow-lg shadow-slate-900/10 dark:shadow-slate-950/30'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main navigation bar */}
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">⚾</span>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#1a73e8] to-[#ea4335] bg-clip-text text-transparent">
              CBB Pitcher Tracker
            </h1>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Search Input */}
            <div className="w-64 lg:w-80">
              <input
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search pitchers..."
                className={cn(
                  'w-full px-4 py-2 rounded-lg text-sm',
                  'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600',
                  'text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
                  'transition-all duration-200'
                )}
              />
            </div>

            {/* Favorites Button */}
            <button
              onClick={onFavoritesClick}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white',
                'hover:opacity-90 transition-opacity duration-200',
                'shadow-md shadow-blue-500/20'
              )}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>Favorites</span>
              {favoritesCount > 0 && (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full border border-white/30">
                  {favoritesCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            <button
              onClick={onFavoritesClick}
              className={cn(
                'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white',
                'hover:opacity-90 transition-opacity duration-200'
              )}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {favoritesCount > 0 && (
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {favoritesCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3">
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search pitchers..."
            className={cn(
              'w-full px-4 py-2 rounded-lg text-sm',
              'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600',
              'text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500'
            )}
          />
        </div>
      </div>
    </nav>
  );
}
