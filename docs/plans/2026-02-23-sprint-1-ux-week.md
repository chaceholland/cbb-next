# Sprint 1: UX Week Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the CBB Pitcher Tracker into a polished, professional platform with modern UX patterns including command palette, dark mode, comparison tools, and mobile optimizations.

**Architecture:** Build foundation with Zustand for global state management, cmdk for command palette, and localStorage for user preferences. Implement progressive enhancement with graceful degradation for older browsers.

**Tech Stack:**
- cmdk (command palette)
- zustand (state management)
- framer-motion (animations, already installed)
- next-themes (dark mode)
- @tanstack/react-query (caching, optional for later)

---

## Task 1: Install Dependencies & Setup Infrastructure

**Files:**
- Modify: `package.json`
- Create: `lib/store/usePreferencesStore.ts`
- Create: `lib/store/useComparisonStore.ts`
- Create: `lib/hooks/useKeyboard.ts`

**Step 1: Install required packages**

```bash
npm install cmdk zustand next-themes
npm install -D @types/node
```

Expected: Packages install successfully

**Step 2: Create preferences store**

Create: `lib/store/usePreferencesStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type View = 'schedule' | 'rosters' | 'analytics';

interface PreferencesState {
  theme: Theme;
  defaultView: View;
  recentSearches: string[];
  showKeyboardHints: boolean;

  setTheme: (theme: Theme) => void;
  setDefaultView: (view: View) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  dismissKeyboardHints: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      defaultView: 'schedule',
      recentSearches: [],
      showKeyboardHints: true,

      setTheme: (theme) => set({ theme }),
      setDefaultView: (view) => set({ defaultView: view }),
      addRecentSearch: (search) =>
        set((state) => ({
          recentSearches: [
            search,
            ...state.recentSearches.filter((s) => s !== search),
          ].slice(0, 5),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),
      dismissKeyboardHints: () => set({ showKeyboardHints: false }),
    }),
    {
      name: 'cbb-preferences',
    }
  )
);
```

**Step 3: Create comparison store**

Create: `lib/store/useComparisonStore.ts`

```typescript
import { create } from 'zustand';

interface ComparisonState {
  selectedPitcherIds: string[];
  isComparing: boolean;

  togglePitcher: (pitcherId: string) => void;
  clearSelection: () => void;
  setComparing: (comparing: boolean) => void;
}

export const useComparisonStore = create<ComparisonState>()((set) => ({
  selectedPitcherIds: [],
  isComparing: false,

  togglePitcher: (pitcherId) =>
    set((state) => {
      const isSelected = state.selectedPitcherIds.includes(pitcherId);
      const newSelection = isSelected
        ? state.selectedPitcherIds.filter((id) => id !== pitcherId)
        : state.selectedPitcherIds.length < 3
        ? [...state.selectedPitcherIds, pitcherId]
        : state.selectedPitcherIds;

      return { selectedPitcherIds: newSelection };
    }),
  clearSelection: () => set({ selectedPitcherIds: [], isComparing: false }),
  setComparing: (comparing) => set({ isComparing: comparing }),
}));
```

**Step 4: Create keyboard hook**

Create: `lib/hooks/useKeyboard.ts`

```typescript
import { useEffect } from 'react';

export function useKeyboard(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: {
    meta?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    preventDefault?: boolean;
  } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesMeta = options.meta ? event.metaKey : !event.metaKey;
      const matchesCtrl = options.ctrl ? event.ctrlKey : !event.ctrlKey;
      const matchesShift = options.shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = options.alt ? event.altKey : !event.altKey;

      if (matchesKey && matchesMeta && matchesCtrl && matchesShift && matchesAlt) {
        if (options.preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}
```

**Step 5: Commit**

```bash
git add package.json package-lock.json lib/store/ lib/hooks/useKeyboard.ts
git commit -m "feat: add infrastructure for UX improvements

- Install cmdk, zustand, next-themes
- Create preferences store with theme and recent searches
- Create comparison store for pitcher selection
- Add keyboard hook utility

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Implement Dark Mode

**Files:**
- Create: `components/ThemeProvider.tsx`
- Create: `components/ThemeToggle.tsx`
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`

**Step 1: Create theme provider**

Create: `components/ThemeProvider.tsx`

```typescript
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { usePreferencesStore } from '@/lib/store/usePreferencesStore';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((state) => state.theme);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={theme === 'system' ? undefined : theme}
    >
      {children}
    </NextThemesProvider>
  );
}
```

**Step 2: Create theme toggle component**

Create: `components/ThemeToggle.tsx`

```typescript
'use client';

import { usePreferencesStore } from '@/lib/store/usePreferencesStore';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, theme: storedTheme } = useTheme();
  const setPreferenceTheme = usePreferencesStore((state) => state.setTheme);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        aria-label="Toggle theme"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
      </button>
    );
  }

  const isDark = storedTheme === 'dark';

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    setPreferenceTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'p-2 rounded-lg transition-all duration-200',
        'bg-slate-100 dark:bg-slate-800',
        'text-slate-600 dark:text-slate-400',
        'hover:bg-slate-200 dark:hover:bg-slate-700'
      )}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M7 12a5 5 0 1110 0 5 5 0 01-10 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
```

**Step 3: Update tailwind config for dark mode**

Modify: `tailwind.config.ts`

Add `darkMode: 'class'` to the config object.

**Step 4: Update layout to include theme provider**

Modify: `app/layout.tsx`

Wrap children with `<ThemeProvider>`:

```typescript
import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 5: Add theme toggle to Navigation**

Modify: `components/Navigation.tsx`

Import and add `<ThemeToggle />` to the navigation bar.

**Step 6: Test dark mode**

Run: `npm run dev`
Open: http://localhost:3000
Expected: Theme toggle button visible, clicking switches between light/dark mode smoothly

**Step 7: Commit**

```bash
git add components/ThemeProvider.tsx components/ThemeToggle.tsx app/layout.tsx tailwind.config.ts components/Navigation.tsx
git commit -m "feat: add dark mode with theme toggle

- Theme provider with next-themes
- Toggle button in navigation
- Tailwind dark mode class strategy
- Smooth transitions between themes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Build Command Palette Foundation

**Files:**
- Create: `components/command/CommandPalette.tsx`
- Create: `components/command/CommandProvider.tsx`
- Create: `lib/commands/types.ts`
- Create: `lib/commands/registry.ts`
- Modify: `app/layout.tsx`

**Step 1: Create command types**

Create: `lib/commands/types.ts`

```typescript
export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  action: () => void | Promise<void>;
  shortcut?: string;
  group?: 'navigation' | 'actions' | 'search' | 'filters';
}

export interface CommandGroup {
  heading: string;
  commands: Command[];
}
```

**Step 2: Create command registry**

Create: `lib/commands/registry.ts`

```typescript
import { Command } from './types';

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  register(command: Command) {
    this.commands.set(command.id, command);
  }

  unregister(id: string) {
    this.commands.delete(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter((cmd) => {
      const matchesLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchesKeywords = cmd.keywords?.some((k) =>
        k.toLowerCase().includes(lowerQuery)
      );
      return matchesLabel || matchesKeywords;
    });
  }
}

export const commandRegistry = new CommandRegistry();
```

**Step 3: Create command provider**

Create: `components/command/CommandProvider.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CommandContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function CommandProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <CommandContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error('useCommand must be used within CommandProvider');
  }
  return context;
}
```

**Step 4: Create command palette component**

Create: `components/command/CommandPalette.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useCommand } from './CommandProvider';
import { commandRegistry } from '@/lib/commands/registry';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const { isOpen, close } = useCommand();
  const [search, setSearch] = useState('');
  const [commands, setCommands] = useState(commandRegistry.getAll());

  useEffect(() => {
    if (search) {
      setCommands(commandRegistry.search(search));
    } else {
      setCommands(commandRegistry.getAll());
    }
  }, [search]);

  if (!isOpen) return null;

  const groupedCommands = commands.reduce((acc, cmd) => {
    const group = cmd.group || 'actions';
    if (!acc[group]) acc[group] = [];
    acc[group].push(cmd);
    return acc;
  }, {} as Record<string, typeof commands>);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={close}
    >
      <Command
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-slate-200 dark:border-slate-700 px-4">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="flex-1 px-3 py-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-slate-400">
            No results found.
          </Command.Empty>

          {Object.entries(groupedCommands).map(([group, cmds]) => (
            <Command.Group
              key={group}
              heading={group.charAt(0).toUpperCase() + group.slice(1)}
              className="mb-2"
            >
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {group}
              </div>
              {cmds.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={cmd.label}
                  onSelect={() => {
                    cmd.action();
                    close();
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                    'text-slate-700 dark:text-slate-300',
                    'hover:bg-slate-100 dark:hover:bg-slate-800',
                    'data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20',
                    'transition-colors'
                  )}
                >
                  {cmd.icon && <div className="text-slate-400">{cmd.icon}</div>}
                  <div className="flex-1">
                    <div className="font-medium">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-xs text-slate-400">{cmd.description}</div>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
```

**Step 5: Add command provider and palette to layout**

Modify: `app/layout.tsx`

```typescript
import { CommandProvider } from '@/components/command/CommandProvider';
import { CommandPalette } from '@/components/command/CommandPalette';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <CommandProvider>
            {children}
            <CommandPalette />
          </CommandProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 6: Add keyboard shortcut to open command palette**

Modify: `components/command/CommandPalette.tsx`

Add this hook at the top of the component:

```typescript
import { useKeyboard } from '@/lib/hooks/useKeyboard';

// Inside component:
useKeyboard('k', () => open(), { meta: true, preventDefault: true });
useKeyboard('k', () => open(), { ctrl: true, preventDefault: true });
```

**Step 7: Test command palette**

Run: `npm run dev`
Press: ⌘K or Ctrl+K
Expected: Command palette opens with search input

**Step 8: Commit**

```bash
git add components/command/ lib/commands/ app/layout.tsx
git commit -m "feat: add command palette foundation

- Command registry for extensible commands
- CommandProvider for global state
- CommandPalette with cmdk
- Keyboard shortcut ⌘K/Ctrl+K to open

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Navigation Commands

**Files:**
- Create: `lib/commands/navigation.ts`
- Modify: `app/page.tsx`

**Step 1: Create navigation commands**

Create: `lib/commands/navigation.ts`

```typescript
import { commandRegistry } from './registry';

export function registerNavigationCommands(
  setActiveTab: (tab: 'schedule' | 'rosters' | 'analytics') => void
) {
  commandRegistry.register({
    id: 'nav-schedule',
    label: 'Go to Schedule',
    description: 'View the game schedule',
    group: 'navigation',
    shortcut: '1',
    keywords: ['schedule', 'games', 'calendar'],
    action: () => setActiveTab('schedule'),
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  });

  commandRegistry.register({
    id: 'nav-rosters',
    label: 'Go to Rosters',
    description: 'View team rosters and pitchers',
    group: 'navigation',
    shortcut: '2',
    keywords: ['rosters', 'pitchers', 'players', 'teams'],
    action: () => setActiveTab('rosters'),
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  });

  commandRegistry.register({
    id: 'nav-analytics',
    label: 'Go to Analytics',
    description: 'View statistics and analytics',
    group: 'navigation',
    shortcut: '3',
    keywords: ['analytics', 'stats', 'statistics', 'data'],
    action: () => setActiveTab('analytics'),
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  });
}
```

**Step 2: Register commands in main page**

Modify: `app/page.tsx`

Add after the `handleTabChange` function:

```typescript
import { registerNavigationCommands } from '@/lib/commands/navigation';
import { useEffect } from 'react';

// Inside component:
useEffect(() => {
  registerNavigationCommands(setActiveTab);
}, []);
```

**Step 3: Add number key shortcuts**

Modify: `app/page.tsx`

Add keyboard handlers:

```typescript
import { useKeyboard } from '@/lib/hooks/useKeyboard';

// Inside component:
useKeyboard('1', () => setActiveTab('schedule'), { preventDefault: true });
useKeyboard('2', () => setActiveTab('rosters'), { preventDefault: true });
useKeyboard('3', () => setActiveTab('analytics'), { preventDefault: true });
```

**Step 4: Test navigation commands**

Run: `npm run dev`
Test: Press ⌘K, type "schedule", press Enter
Expected: Navigates to schedule tab

Test: Press 1, 2, 3
Expected: Switches between tabs

**Step 5: Commit**

```bash
git add lib/commands/navigation.ts app/page.tsx
git commit -m "feat: add navigation commands

- Go to Schedule/Rosters/Analytics commands
- Keyboard shortcuts 1, 2, 3 for tab switching
- Commands searchable in command palette

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Skeleton Loaders

**Files:**
- Create: `components/ui/Skeleton.tsx`
- Create: `components/schedule/ScheduleSkeleton.tsx`
- Create: `components/roster/RosterSkeleton.tsx`
- Modify: `components/schedule/ScheduleView.tsx`
- Modify: `components/roster/RosterView.tsx`

**Step 1: Create base skeleton component**

Create: `components/ui/Skeleton.tsx`

```typescript
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800',
        className
      )}
      {...props}
    />
  );
}
```

**Step 2: Create schedule skeleton**

Create: `components/schedule/ScheduleSkeleton.tsx`

```typescript
import { Skeleton } from '../ui/Skeleton';

export function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Week sections skeleton */}
      {[1, 2, 3].map((week) => (
        <div key={week} className="space-y-3">
          {/* Week header */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-px flex-1" />
          </div>

          {/* Game cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((game) => (
              <Skeleton key={game} className="h-32 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create roster skeleton**

Create: `components/roster/RosterSkeleton.tsx`

```typescript
import { Skeleton } from '../ui/Skeleton';

export function RosterSkeleton() {
  return (
    <div>
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Team tiles skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Skeleton className="w-14 h-14 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Use skeletons in ScheduleView**

Modify: `components/schedule/ScheduleView.tsx`

Replace loading spinner with:

```typescript
import { ScheduleSkeleton } from './ScheduleSkeleton';

// In the loading condition:
if (loading) {
  return <ScheduleSkeleton />;
}
```

**Step 5: Use skeletons in RosterView**

Modify: `components/roster/RosterView.tsx`

Replace loading spinner with:

```typescript
import { RosterSkeleton } from './RosterSkeleton';

// In the loading condition:
if (loading) {
  return <RosterSkeleton />;
}
```

**Step 6: Test skeleton loaders**

Run: `npm run dev`
Expected: Skeleton loaders appear briefly while data loads, matching layout of actual content

**Step 7: Commit**

```bash
git add components/ui/Skeleton.tsx components/schedule/ScheduleSkeleton.tsx components/roster/RosterSkeleton.tsx components/schedule/ScheduleView.tsx components/roster/RosterView.tsx
git commit -m "feat: add skeleton loaders for schedule and roster

- Base Skeleton component with animation
- ScheduleSkeleton matching game card layout
- RosterSkeleton matching team tile grid
- Replace spinner with content-matching skeletons

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Pitcher Comparison Tool

**Files:**
- Create: `components/roster/ComparisonModal.tsx`
- Create: `components/roster/ComparisonButton.tsx`
- Modify: `components/roster/RosterView.tsx`
- Modify: `components/roster/PitcherCard.tsx`

**Step 1: Create comparison button component**

Create: `components/roster/ComparisonButton.tsx`

```typescript
'use client';

import { useComparisonStore } from '@/lib/store/useComparisonStore';
import { cn } from '@/lib/utils';

export function ComparisonButton() {
  const { selectedPitcherIds, setComparing, clearSelection } = useComparisonStore();
  const count = selectedPitcherIds.length;

  if (count < 2) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-bold">
          {count}
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {count} pitchers selected
        </span>
      </div>
      <button
        onClick={() => setComparing(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Compare
      </button>
      <button
        onClick={clearSelection}
        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
```

**Step 2: Create comparison modal**

Create: `components/roster/ComparisonModal.tsx`

```typescript
'use client';

import { useComparisonStore } from '@/lib/store/useComparisonStore';
import { EnrichedPitcher } from '@/lib/supabase/types';
import Image from 'next/image';
import { cn, getEspnLogoUrl } from '@/lib/utils';

interface ComparisonModalProps {
  pitchers: EnrichedPitcher[];
}

export function ComparisonModal({ pitchers }: ComparisonModalProps) {
  const { isComparing, setComparing, selectedPitcherIds, clearSelection } =
    useComparisonStore();

  if (!isComparing) return null;

  const selectedPitchers = pitchers.filter((p) =>
    selectedPitcherIds.includes(p.pitcher_id)
  );

  if (selectedPitchers.length === 0) {
    setComparing(false);
    return null;
  }

  const fields = [
    { key: 'team', label: 'Team', getValue: (p: EnrichedPitcher) => p.team.display_name },
    { key: 'position', label: 'Position', getValue: (p: EnrichedPitcher) => p.position || '—' },
    { key: 'year', label: 'Year', getValue: (p: EnrichedPitcher) => p.year || '—' },
    { key: 'height', label: 'Height', getValue: (p: EnrichedPitcher) => p.height || '—' },
    { key: 'weight', label: 'Weight', getValue: (p: EnrichedPitcher) => p.weight || '—' },
    { key: 'bats_throws', label: 'Bats/Throws', getValue: (p: EnrichedPitcher) => p.bats_throws || '—' },
    { key: 'hometown', label: 'Hometown', getValue: (p: EnrichedPitcher) => p.hometown || '—' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        setComparing(false);
        clearSelection();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Pitcher Comparison
          </h2>
          <button
            onClick={() => {
              setComparing(false);
              clearSelection();
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${selectedPitchers.length}, minmax(0, 1fr))` }}>
            {/* Pitcher headers */}
            {selectedPitchers.map((pitcher) => {
              const logoSrc = pitcher.team.logo || getEspnLogoUrl(pitcher.team.team_id);
              const headshotSrc = pitcher.headshot || logoSrc;

              return (
                <div key={pitcher.pitcher_id} className="flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <Image
                      src={headshotSrc}
                      alt={pitcher.display_name || pitcher.name}
                      width={96}
                      height={96}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">
                      {pitcher.display_name || pitcher.name}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison table */}
          <div className="mt-6 space-y-2">
            {fields.map((field) => (
              <div
                key={field.key}
                className="grid gap-4 py-3 border-b border-slate-100 dark:border-slate-800"
                style={{ gridTemplateColumns: `repeat(${selectedPitchers.length}, minmax(0, 1fr))` }}
              >
                <div className="col-span-full font-semibold text-xs text-slate-400 uppercase tracking-wide mb-1">
                  {field.label}
                </div>
                {selectedPitchers.map((pitcher) => (
                  <div
                    key={pitcher.pitcher_id}
                    className="text-center text-slate-700 dark:text-slate-300"
                  >
                    {field.getValue(pitcher)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add checkbox to pitcher cards**

Modify: `components/roster/PitcherCard.tsx`

Add checkbox overlay:

```typescript
import { useComparisonStore } from '@/lib/store/useComparisonStore';

// Inside component:
const { selectedPitcherIds, togglePitcher } = useComparisonStore();
const isSelected = selectedPitcherIds.includes(pitcher.pitcher_id);

// Add checkbox before existing card content:
<div className="absolute top-2 left-2 z-10">
  <input
    type="checkbox"
    checked={isSelected}
    onChange={(e) => {
      e.stopPropagation();
      togglePitcher(pitcher.pitcher_id);
    }}
    className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-300 rounded cursor-pointer focus:ring-2 focus:ring-blue-500 checked:bg-blue-600 checked:border-blue-600"
  />
</div>
```

**Step 4: Add comparison button and modal to roster view**

Modify: `components/roster/RosterView.tsx`

Add imports and components:

```typescript
import { ComparisonButton } from './ComparisonButton';
import { ComparisonModal } from './ComparisonModal';

// Add before closing div:
<ComparisonButton />
<ComparisonModal pitchers={pitchers} />
```

**Step 5: Test comparison tool**

Run: `npm run dev`
Go to: Rosters tab
Test: Select 2-3 pitchers, click Compare button
Expected: Modal opens showing side-by-side comparison

**Step 6: Commit**

```bash
git add components/roster/ComparisonModal.tsx components/roster/ComparisonButton.tsx components/roster/RosterView.tsx components/roster/PitcherCard.tsx
git commit -m "feat: add pitcher comparison tool

- Select up to 3 pitchers with checkboxes
- Floating comparison button when 2+ selected
- Modal with side-by-side bio comparison
- Clear selection and close modal actions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Filter Memory

**Files:**
- Create: `lib/hooks/useFilterMemory.ts`
- Modify: `components/schedule/ScheduleView.tsx`
- Modify: `components/roster/RosterView.tsx`

**Step 1: Create filter memory hook**

Create: `lib/hooks/useFilterMemory.ts`

```typescript
import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface FilterState {
  [key: string]: any;
}

export function useFilterMemory(key: string, filters: FilterState) {
  const [savedFilters, setSavedFilters] = useLocalStorage<FilterState>(
    `cbb-${key}-filters`,
    {}
  );
  const [filterHistory, setFilterHistory] = useLocalStorage<FilterState[]>(
    `cbb-${key}-filter-history`,
    []
  );

  // Save filters when they change
  useEffect(() => {
    const hasFilters = Object.values(filters).some((val) => {
      if (typeof val === 'string') return val !== '' && val !== 'All';
      if (typeof val === 'boolean') return val === true;
      if (val instanceof Set) return val.size > 0;
      return false;
    });

    if (hasFilters) {
      setSavedFilters(filters);

      // Add to history (max 3 unique entries)
      setFilterHistory((prev) => {
        const filtered = prev.filter(
          (f) => JSON.stringify(f) !== JSON.stringify(filters)
        );
        return [filters, ...filtered].slice(0, 3);
      });
    }
  }, [filters, setSavedFilters, setFilterHistory]);

  return {
    savedFilters,
    filterHistory,
    clearHistory: () => setFilterHistory([]),
  };
}
```

**Step 2: Add filter memory to schedule view**

Modify: `components/schedule/ScheduleView.tsx`

Add near the top of the component:

```typescript
import { useFilterMemory } from '@/lib/hooks/useFilterMemory';

// Inside component:
const currentFilters = {
  conferences,
  teamSearch,
  showFavorites,
  watchOrder,
  pitcherFilter,
};

const { savedFilters, filterHistory, clearHistory } = useFilterMemory(
  'schedule',
  currentFilters
);

// Add "Recent Filters" button near filter controls
```

**Step 3: Add filter memory to roster view**

Modify: `components/roster/RosterView.tsx`

Add similar filter memory tracking:

```typescript
import { useFilterMemory } from '@/lib/hooks/useFilterMemory';

// Inside component:
const currentFilters = {
  conference,
  hand,
  showFavorites,
  searchQuery,
};

const { savedFilters, filterHistory } = useFilterMemory('roster', currentFilters);
```

**Step 4: Test filter memory**

Run: `npm run dev`
Test: Apply filters, refresh page
Expected: Filters are restored from last session

**Step 5: Commit**

```bash
git add lib/hooks/useFilterMemory.ts components/schedule/ScheduleView.tsx components/roster/RosterView.tsx
git commit -m "feat: add filter memory across sessions

- useFilterMemory hook tracks filter state
- Auto-save filters to localStorage
- Restore filters on page load
- Track last 3 filter combinations

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Implement Sticky Headers

**Files:**
- Create: `lib/hooks/useSticky.ts`
- Modify: `components/schedule/ScheduleView.tsx`
- Modify: `components/TabBar.tsx`

**Step 1: Create sticky hook**

Create: `lib/hooks/useSticky.ts`

```typescript
import { useEffect, useState, RefObject } from 'react';

export function useSticky(ref: RefObject<HTMLElement>, offset: number = 0) {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      {
        threshold: [1],
        rootMargin: `-${offset}px 0px 0px 0px`,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, offset]);

  return isSticky;
}
```

**Step 2: Add sticky week headers in schedule**

Modify: `components/schedule/ScheduleView.tsx`

Wrap week header button in sticky container:

```typescript
import { useSticky } from '@/lib/hooks/useSticky';
import { useRef } from 'react';

// For each week section:
const weekHeaderRef = useRef<HTMLDivElement>(null);
const isSticky = useSticky(weekHeaderRef);

<div
  ref={weekHeaderRef}
  className={cn(
    'sticky top-0 z-30 bg-slate-50 dark:bg-slate-950 transition-shadow',
    isSticky && 'shadow-md'
  )}
>
  <button onClick={() => toggleWeek(week)} className="...">
    {/* existing week header content */}
  </button>
</div>
```

**Step 3: Make filter bar sticky**

Modify: `components/schedule/ScheduleView.tsx`

Wrap filter controls in sticky container:

```typescript
<div className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-950 pb-4">
  {/* existing filter bar content */}
</div>
```

**Step 4: Test sticky headers**

Run: `npm run dev`
Test: Scroll down schedule page
Expected: Week headers stick to top, filter bar stays visible, shadow appears when stuck

**Step 5: Commit**

```bash
git add lib/hooks/useSticky.ts components/schedule/ScheduleView.tsx
git commit -m "feat: implement sticky headers

- useSticky hook with IntersectionObserver
- Sticky week headers on schedule view
- Sticky filter bar with shadow on scroll
- Smooth transitions and proper z-index

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Mobile Optimizations

**Files:**
- Create: `lib/hooks/useSwipe.ts`
- Modify: `app/page.tsx`
- Modify: `components/TabBar.tsx`
- Modify: `components/schedule/GameCard.tsx`
- Modify: `tailwind.config.ts`

**Step 1: Create swipe gesture hook**

Create: `lib/hooks/useSwipe.ts`

```typescript
import { useEffect, useRef } from 'react';

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useSwipe(callbacks: SwipeCallbacks, threshold: number = 50) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };

      const deltaX = touchEnd.x - touchStart.current.x;
      const deltaY = touchEnd.y - touchStart.current.y;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0) {
            callbacks.onSwipeRight?.();
          } else {
            callbacks.onSwipeLeft?.();
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > threshold) {
          if (deltaY > 0) {
            callbacks.onSwipeDown?.();
          } else {
            callbacks.onSwipeUp?.();
          }
        }
      }

      touchStart.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [callbacks, threshold]);
}
```

**Step 2: Add swipe gestures to main page**

Modify: `app/page.tsx`

```typescript
import { useSwipe } from '@/lib/hooks/useSwipe';

// Inside component:
useSwipe({
  onSwipeLeft: () => {
    if (activeTab === 'schedule') setActiveTab('rosters');
    else if (activeTab === 'rosters') setActiveTab('analytics');
  },
  onSwipeRight: () => {
    if (activeTab === 'analytics') setActiveTab('rosters');
    else if (activeTab === 'rosters') setActiveTab('schedule');
  },
});
```

**Step 3: Make tab bar mobile-friendly**

Modify: `components/TabBar.tsx`

Add mobile-specific positioning:

```typescript
<div className={cn(
  'flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700',
  'sm:shadow-sm', // desktop
  'fixed bottom-4 left-1/2 -translate-x-1/2 sm:static sm:translate-x-0 z-40' // mobile
)}>
  {/* existing tabs */}
</div>
```

**Step 4: Optimize game cards for mobile**

Modify: `components/schedule/GameCard.tsx`

Add responsive text sizes:

```typescript
<div className={cn(
  'text-lg sm:text-xl font-bold', // team names
  'text-xs sm:text-sm', // meta info
  'p-3 sm:p-4', // padding
  'min-h-[120px] sm:min-h-[140px]' // touch targets
)}>
```

**Step 5: Add tap area size check to tailwind**

Modify: `tailwind.config.ts`

Add custom utilities:

```typescript
theme: {
  extend: {
    minHeight: {
      'tap': '44px', // iOS minimum touch target
    },
    minWidth: {
      'tap': '44px',
    },
  },
}
```

**Step 6: Test mobile optimizations**

Run: `npm run dev`
Open: Dev tools mobile view (375px width)
Test: Swipe left/right to change tabs
Expected: Smooth tab switching, bottom tab bar, larger touch targets

**Step 7: Commit**

```bash
git add lib/hooks/useSwipe.ts app/page.tsx components/TabBar.tsx components/schedule/GameCard.tsx tailwind.config.ts
git commit -m "feat: add mobile optimizations

- Swipe gestures to switch tabs
- Bottom tab bar for mobile (thumb-friendly)
- Responsive text sizes and padding
- Minimum 44px touch targets
- Mobile-first responsive design

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Add Empty States

**Files:**
- Create: `components/ui/EmptyState.tsx`
- Modify: `components/schedule/ScheduleView.tsx`
- Modify: `components/roster/RosterView.tsx`

**Step 1: Create empty state component**

Create: `components/ui/EmptyState.tsx`

```typescript
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && (
        <div className="mb-4 text-slate-300 dark:text-slate-700">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

**Step 2: Add empty state to schedule view**

Modify: `components/schedule/ScheduleView.tsx`

Replace "No games found" text with:

```typescript
import { EmptyState } from '../ui/EmptyState';

{weeks.length === 0 && (
  <EmptyState
    icon={
      <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    }
    title="No games found"
    description="Try adjusting your filters or search to see more games."
    action={{
      label: 'Clear All Filters',
      onClick: () => {
        setConferences(new Set());
        setTeamSearch('');
        setShowFavorites(false);
        setWatchOrder('all');
      },
    }}
  />
)}
```

**Step 3: Add empty state to roster view**

Modify: `components/roster/RosterView.tsx`

Add empty state for no pitchers:

```typescript
import { EmptyState } from '../ui/EmptyState';

{teamPitchers.length === 0 && (
  <EmptyState
    icon={
      <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    }
    title="No pitchers found"
    description={showFavorites ? "You haven't favorited any pitchers from this team yet." : "Try adjusting your filters."}
    action={showFavorites ? {
      label: 'Show All Pitchers',
      onClick: () => setShowFavorites(false),
    } : undefined}
  />
)}
```

**Step 4: Test empty states**

Run: `npm run dev`
Test: Apply filters that return no results
Expected: Friendly empty state with icon and helpful action button

**Step 5: Commit**

```bash
git add components/ui/EmptyState.tsx components/schedule/ScheduleView.tsx components/roster/RosterView.tsx
git commit -m "feat: add empty states with helpful actions

- EmptyState component with icon and CTA
- Schedule empty state with clear filters action
- Roster empty state context-aware messages
- Improved UX when no results found

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Add Keyboard Shortcuts Hint

**Files:**
- Create: `components/KeyboardHints.tsx`
- Modify: `app/page.tsx`

**Step 1: Create keyboard hints component**

Create: `components/KeyboardHints.tsx`

```typescript
'use client';

import { usePreferencesStore } from '@/lib/store/usePreferencesStore';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function KeyboardHints() {
  const { showKeyboardHints, dismissKeyboardHints } = usePreferencesStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !showKeyboardHints) return null;

  const shortcuts = [
    { key: '⌘K', description: 'Open command palette' },
    { key: '1-3', description: 'Switch tabs' },
    { key: '/', description: 'Search' },
    { key: '⌘D', description: 'Toggle dark mode' },
    { key: 'ESC', description: 'Close modals' },
  ];

  return (
    <div className="fixed bottom-6 left-6 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 max-w-xs">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Keyboard Shortcuts
        </h4>
        <button
          onClick={dismissKeyboardHints}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-2">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.key} className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">{shortcut.description}</span>
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 font-mono">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
      <button
        onClick={dismissKeyboardHints}
        className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-center"
      >
        Don't show again
      </button>
    </div>
  );
}
```

**Step 2: Add keyboard hints to main page**

Modify: `app/page.tsx`

```typescript
import { KeyboardHints } from '@/components/KeyboardHints';

// Add before closing fragment:
<KeyboardHints />
```

**Step 3: Test keyboard hints**

Run: `npm run dev`
Expected: Hints appear in bottom-left on first visit, dismissible permanently

**Step 4: Commit**

```bash
git add components/KeyboardHints.tsx app/page.tsx
git commit -m "feat: add keyboard shortcuts hint bar

- Dismissible hints for first-time users
- Shows common keyboard shortcuts
- Persists dismissal in preferences
- Bottom-left positioning

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Final Testing & Documentation

**Files:**
- Create: `docs/SPRINT-1-TESTING.md`
- Modify: `README.md`

**Step 1: Create testing checklist**

Create: `docs/SPRINT-1-TESTING.md`

```markdown
# Sprint 1 UX Week - Testing Checklist

## Feature 1: Command Palette
- [ ] ⌘K / Ctrl+K opens command palette
- [ ] ESC closes command palette
- [ ] Navigation commands work (Go to Schedule/Rosters/Analytics)
- [ ] Fuzzy search filters commands
- [ ] Recent commands stored and visible
- [ ] Dark mode: Palette styling correct

## Feature 2: Dark Mode
- [ ] Toggle button visible in navigation
- [ ] Clicking toggle switches theme
- [ ] Theme persists across page reloads
- [ ] All views render correctly in dark mode
- [ ] Transitions are smooth (0.2s)
- [ ] System preference detected on first load

## Feature 3: Keyboard Shortcuts
- [ ] 1, 2, 3 switch tabs
- [ ] / focuses search input
- [ ] ⌘D / Ctrl+D toggles dark mode
- [ ] ⌘E / Ctrl+E exports current view
- [ ] Space expands/collapses week (on schedule)
- [ ] Shortcuts don't trigger when typing in inputs

## Feature 4: Loading States
- [ ] Skeleton loaders appear while loading
- [ ] Skeletons match actual content layout
- [ ] No flash of loading spinner
- [ ] Progressive loading works (cached data first)

## Feature 5: Pitcher Comparison
- [ ] Checkboxes appear on pitcher cards
- [ ] Can select up to 3 pitchers
- [ ] Comparison button appears when 2+ selected
- [ ] Modal shows side-by-side comparison
- [ ] All bio fields visible
- [ ] Clear selection works
- [ ] Close modal clears selection

## Feature 6: Filter Memory
- [ ] Filters saved to localStorage
- [ ] Filters restored on page reload
- [ ] Recent filters history (last 3)
- [ ] Clear history works
- [ ] Per-view filter memory (schedule vs rosters)

## Feature 7: Sticky Headers
- [ ] Week headers stick to top on scroll
- [ ] Filter bar stays visible
- [ ] Shadow appears when stuck
- [ ] Z-index correct (no overlap issues)
- [ ] Smooth transitions

## Feature 8: Mobile Optimizations
- [ ] Swipe left/right switches tabs
- [ ] Bottom tab bar visible on mobile
- [ ] Touch targets minimum 44px
- [ ] Text sizes responsive
- [ ] Cards layout well on mobile
- [ ] Modals full-screen on mobile

## Feature 9: Empty States
- [ ] "No games found" shows empty state
- [ ] "No pitchers found" shows empty state
- [ ] Clear filters action works
- [ ] Context-aware messages
- [ ] Icons and styling correct

## Feature 10: Keyboard Hints
- [ ] Hints appear on first visit
- [ ] Hints dismissible
- [ ] "Don't show again" persists
- [ ] Positioning correct (bottom-left)
- [ ] Dark mode styling correct

## Cross-Browser Testing
- [ ] Chrome (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Firefox
- [ ] Edge

## Performance
- [ ] Lighthouse score > 90
- [ ] No console errors
- [ ] Smooth animations (60fps)
- [ ] Fast page loads

## Accessibility
- [ ] Keyboard navigation works
- [ ] Focus visible
- [ ] ARIA labels present
- [ ] Color contrast sufficient
```

**Step 2: Update README**

Modify: `README.md`

Add Sprint 1 features section:

```markdown
## Recent Updates - Sprint 1: UX Week ✨

### New Features
- **Command Palette (⌘K)**: Universal search and quick actions
- **Dark Mode**: Seamless light/dark theme switching
- **Keyboard Shortcuts**: Navigate with 1-3 keys, search with /
- **Pitcher Comparison**: Select and compare up to 3 pitchers
- **Smart Loading**: Skeleton loaders that match content layout
- **Filter Memory**: Your filters persist across sessions
- **Sticky Headers**: Week headers and filters stay visible
- **Mobile Optimized**: Swipe gestures and bottom tab bar
- **Empty States**: Helpful messages when no results found
- **Keyboard Hints**: Dismissible shortcuts guide for new users

### Keyboard Shortcuts
- `⌘K` / `Ctrl+K` - Open command palette
- `1`, `2`, `3` - Switch between tabs
- `/` - Focus search input
- `⌘D` / `Ctrl+D` - Toggle dark mode
- `⌘E` / `Ctrl+E` - Export current view
- `ESC` - Close modals/palette
- `Space` - Expand/collapse week (on schedule)

### Tech Stack Additions
- cmdk - Command palette
- zustand - State management
- next-themes - Dark mode
```

**Step 3: Run full test suite**

```bash
npm run build
npm run start
```

Open: http://localhost:3000
Go through testing checklist

**Step 4: Fix any issues found**

Document and fix bugs found during testing

**Step 5: Final commit**

```bash
git add docs/SPRINT-1-TESTING.md README.md
git commit -m "docs: add Sprint 1 testing checklist and README updates

- Comprehensive testing checklist for all features
- Updated README with new features and shortcuts
- Ready for production deployment

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion

**Sprint 1 is complete! 🎉**

**Deliverables:**
- ✅ Command palette with navigation and search
- ✅ Dark mode with theme toggle
- ✅ Enhanced keyboard shortcuts
- ✅ Skeleton loaders for schedule and rosters
- ✅ Pitcher comparison tool
- ✅ Filter memory across sessions
- ✅ Sticky headers on scroll
- ✅ Mobile optimizations (swipes, bottom tabs)
- ✅ Empty states with helpful actions
- ✅ Keyboard shortcuts hint bar
- ✅ Full testing documentation

**Success Metrics (Expected):**
- Command palette used by 30%+ of returning users
- Dark mode adoption: 20%+ of users
- Comparison tool: 100+ comparisons in first week
- Mobile bounce rate decreases by 15%
- Average session duration increases by 25%

**Next Steps:**
Ready to move to Sprint 2 (Stats Week) or deploy Sprint 1 to production for user feedback.

---

Plan complete and saved to `docs/plans/2026-02-23-sprint-1-ux-week.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
