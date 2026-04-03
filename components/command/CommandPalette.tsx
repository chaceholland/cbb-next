'use client';

import { useEffect, useState } from 'react';
import {
  CommandRoot,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from 'cmdk';
import { useCommand } from './CommandProvider';
import { commandRegistry } from '@/lib/commands/registry';
import { useKeyboard } from '@/lib/hooks/useKeyboard';

export function CommandPalette() {
  const { isOpen, close, toggle } = useCommand();
  const [search, setSearch] = useState('');
  const [filteredCommands, setFilteredCommands] = useState(commandRegistry.getAll());

  useKeyboard([
    {
      key: 'k',
      metaKey: true,
      action: (e) => {
        e.preventDefault();
        toggle();
      },
    },
  ]);

  useEffect(() => {
    if (search) {
      setFilteredCommands(commandRegistry.search(search));
    } else {
      setFilteredCommands(commandRegistry.getAll());
    }
  }, [search]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={close}>
      <div
        className="fixed left-1/2 top-[20%] w-full max-w-2xl -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 shadow-xl shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <CommandRoot className="w-full" shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="w-full border-b border-slate-700 bg-transparent px-4 py-3 text-sm text-slate-100 outline-none"
          />
          <CommandList className="max-h-96 overflow-y-auto p-2">
            <CommandEmpty className="py-6 text-center text-sm text-slate-400">
              No results found.
            </CommandEmpty>

            {commandRegistry.groupByCategory().map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.commands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => {
                      cmd.action();
                      close();
                      setSearch('');
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 aria-selected:bg-slate-700"
                  >
                    {cmd.icon && <span className="text-slate-400">{cmd.icon}</span>}
                    <div className="flex-1">
                      <div className="font-medium">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-xs text-slate-400">
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <div className="flex gap-1">
                        {cmd.shortcut.map((key) => (
                          <kbd
                            key={key}
                            className="rounded border border-slate-600 bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandRoot>
      </div>
    </div>
  );
}
