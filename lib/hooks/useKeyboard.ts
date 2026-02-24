import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  preventDefault?: boolean;
  action: (event: KeyboardEvent) => void;
}

export function useKeyboard(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        // Use strict modifier matching (undefined = false)
        const modifiersMatch =
          (shortcut.ctrlKey ?? false) === e.ctrlKey &&
          (shortcut.metaKey ?? false) === e.metaKey &&
          (shortcut.shiftKey ?? false) === e.shiftKey;

        if (e.key === shortcut.key && modifiersMatch) {
          // Respect preventDefault option (default true)
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action(e);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
