// Minimum innings pitched required for valid rate stats (1 out)
const MIN_INNINGS_PITCHED = 1 / 3;

// Parse innings pitched from string format (e.g., "5.2" = 5 2/3 innings)
export function parseInningsPitched(ip: string): number {
  if (!ip || typeof ip !== 'string') return 0;

  const parts = ip.split('.');
  if (parts.length > 2) return 0; // Invalid format like "5.2.1"

  const wholeInnings = parseInt(parts[0] || '0', 10);
  const outs = parseInt(parts[1] || '0', 10);

  if (isNaN(wholeInnings) || isNaN(outs) || wholeInnings < 0 || outs < 0 || outs > 2) {
    return 0;
  }

  return wholeInnings + (outs / 3);
}

// ERA = (Earned Runs × 9) / Innings Pitched
export function calculateERA(earnedRuns: number, inningsPitched: number): number {
  if (inningsPitched < MIN_INNINGS_PITCHED) return 0;
  return (earnedRuns * 9) / inningsPitched;
}

// WHIP = (Walks + Hits) / Innings Pitched
export function calculateWHIP(walks: number, hits: number, inningsPitched: number): number {
  if (inningsPitched < MIN_INNINGS_PITCHED) return 0;
  return (walks + hits) / inningsPitched;
}

// K/9 = (Strikeouts × 9) / Innings Pitched
export function calculateKPer9(strikeouts: number, inningsPitched: number): number {
  if (inningsPitched < MIN_INNINGS_PITCHED) return 0;
  return (strikeouts * 9) / inningsPitched;
}

// BB/9 = (Walks × 9) / Innings Pitched
export function calculateBBPer9(walks: number, inningsPitched: number): number {
  if (inningsPitched < MIN_INNINGS_PITCHED) return 0;
  return (walks * 9) / inningsPitched;
}

// K/BB = Strikeouts / Walks
export function calculateKBBRatio(strikeouts: number, walks: number): number {
  if (walks === 0) return strikeouts > 0 ? Infinity : 0;
  return strikeouts / walks;
}

// Format stat for display
export function formatStat(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}
