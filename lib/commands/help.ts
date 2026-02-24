'use client';

import { commandRegistry } from './registry';
import { usePreferencesStore } from '@/lib/store/usePreferencesStore';

export function registerHelpCommands() {
  commandRegistry.register({
    id: 'help-keyboard',
    label: 'Show Keyboard Shortcuts',
    description: 'Display keyboard shortcuts hint',
    category: 'help',
    keywords: ['keyboard', 'shortcuts', 'help', 'keys', 'hints'],
    action: () => {
      usePreferencesStore.getState().setShowKeyboardHints(true);
    },
  });
}
