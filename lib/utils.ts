import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getConferenceColor(conference: string | null): { primary: string; secondary: string } {
  const map: Record<string, { primary: string; secondary: string }> = {
    'SEC': { primary: '#1a3a6b', secondary: '#c8a84b' },
    'ACC': { primary: '#1d428a', secondary: '#c9aa6e' },
    'Big 12': { primary: '#003366', secondary: '#cc0000' },
    'Big Ten': { primary: '#002147', secondary: '#cc0000' },
    'Pac-12': { primary: '#0033a0', secondary: '#c4b582' },
  };
  const conf = conference || '';
  for (const key of Object.keys(map)) {
    if (conf.includes(key)) return map[key];
  }
  return { primary: '#1a73e8', secondary: '#ea4335' };
}

export function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Mapping for ESPN team IDs where the API ID differs from the logo URL ID
const ESPN_LOGO_ID_MAP: Record<string, string> = {
  '354': '2230', // Fordham Rams
};

export function getEspnLogoUrl(teamId: string): string {
  const logoId = ESPN_LOGO_ID_MAP[teamId] || teamId;
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${logoId}.png`;
}

export function formatGameTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return '';
  }
}
