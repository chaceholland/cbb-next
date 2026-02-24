import { Command, CommandGroup } from './types';

class CommandRegistry {
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

  getById(id: string): Command | undefined {
    return this.commands.get(id);
  }

  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some((k) =>
        k.toLowerCase().includes(lowerQuery)
      );
      return labelMatch || descMatch || keywordMatch;
    });
  }

  getByCategory(category: Command['category']): Command[] {
    return this.getAll().filter((cmd) => cmd.category === category);
  }

  groupByCategory(): CommandGroup[] {
    const categories: Record<string, Command[]> = {};

    this.getAll().forEach((cmd) => {
      if (!categories[cmd.category]) {
        categories[cmd.category] = [];
      }
      categories[cmd.category].push(cmd);
    });

    return Object.entries(categories).map(([category, commands]) => ({
      heading: category.charAt(0).toUpperCase() + category.slice(1),
      commands,
    }));
  }
}

export const commandRegistry = new CommandRegistry();
