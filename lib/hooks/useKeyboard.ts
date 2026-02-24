import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
}

export function useKeyboard(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const modifiersMatch =
          (shortcut.ctrlKey === undefined || shortcut.ctrlKey === e.ctrlKey) &&
          (shortcut.metaKey === undefined || shortcut.metaKey === e.metaKey) &&
          (shortcut.shiftKey === undefined || shortcut.shiftKey === e.shiftKey);

        if (e.key === shortcut.key && modifiersMatch) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
