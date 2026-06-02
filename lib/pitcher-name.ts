// Canonical pitcher-name helpers. These were previously copy-pasted across
// ScheduleView, GameCard, and FavoritesView and drifted out of sync — a weaker
// copy in Favorites/ScheduleView silently dropped favorited-pitcher games the
// Schedule tab showed. Import from here; do NOT redefine locally.
//
// Why names are messy: the participation scraper embeds a position token inside
// the name ("Aidan - P King") and emits "Last, First" boxscore order, while
// cbb_pitchers stores clean "First Last".

/** Strip the " - P "/" - 1B " position infix and collapse whitespace. Use for DISPLAY. */
export const cleanPitcherName = (s: string | null | undefined): string =>
  (s || "")
    .replace(/\s+-\s+[A-Z0-9]{1,3}\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Order-insensitive identity key for matching a pitcher across sources. Strips
 * the position infix, drops punctuation, and SORTS the name tokens so
 * "Aidan King", "Aidan - P King" and "King, Aidan" all collapse to one value.
 * Use for favorite detection, dedup, and participation↔roster matching.
 */
export const matchKey = (s: string | null | undefined): string =>
  cleanPitcherName(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join("");

/**
 * Headshot-map lookup key: keeps token ORDER and spaces (no sort, no infix
 * strip). Distinct from matchKey — used only to key the name→headshot map.
 */
export const headshotKey = (s: string | null | undefined): string =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
