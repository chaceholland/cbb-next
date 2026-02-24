'use client';

import { useEffect, useState } from 'react';
import { usePreferencesStore } from '@/lib/store/usePreferencesStore';

export function KeyboardHints() {
  const showKeyboardHints = usePreferencesStore((state) => state.showKeyboardHints);
  const dismissKeyboardHints = usePreferencesStore((state) => state.dismissKeyboardHints);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server or if already dismissed
  if (!mounted || !showKeyboardHints) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-800 dark:bg-blue-900/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
              ⌨️ Keyboard Shortcuts
            </h3>
            <div className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 shadow-sm dark:bg-blue-800 dark:text-blue-100">
                  Cmd+K
                </kbd>
                <span>Open command palette</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 shadow-sm dark:bg-blue-800 dark:text-blue-100">
                  1
                </kbd>
                <kbd className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 shadow-sm dark:bg-blue-800 dark:text-blue-100">
                  2
                </kbd>
                <kbd className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 shadow-sm dark:bg-blue-800 dark:text-blue-100">
                  3
                </kbd>
                <span>Switch tabs</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 shadow-sm dark:bg-blue-800 dark:text-blue-100">
                  /
                </kbd>
                <span>Focus search</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 shadow-sm dark:bg-blue-800 dark:text-blue-100">
                  Esc
                </kbd>
                <span>Close modals</span>
              </div>
            </div>
          </div>

          <button
            onClick={dismissKeyboardHints}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            aria-label="Dismiss keyboard hints"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          onClick={dismissKeyboardHints}
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Got it, don't show again
        </button>
      </div>
    </div>
  );
}
