export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string[];
  category: 'navigation' | 'search' | 'filter' | 'theme' | 'help';
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export interface CommandGroup {
  heading: string;
  commands: Command[];
}
