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
  '69': '41',    // UConn Huskies
  '73': '55',    // Jacksonville State Gamecocks
  '76': '58',    // South Florida Bulls
  '100': '159',  // Dartmouth Big Green
  '105': '179',  // St. Bonaventure Bonnies
  '122': '242',  // Rice Owls
  '141': '299',  // Long Beach State Beach
  '155': '2005', // Air Force Falcons
  '157': '2050', // Ball State Cardinals
  '165': '2239', // Cal State Fullerton Titans
  '169': '2309', // Kent State Golden Flashes
  '177': '2393', // Middle Tennessee Blue Raiders
  '180': '2429', // Charlotte 49ers
  '181': '2430', // UNC Greensboro Spartans
  '185': '2463', // Cal State Northridge Matadors
  '186': '2466', // Northwestern State Demons
  '187': '2492', // Pepperdine Waves
  '192': '2572', // Southern Miss Golden Eagles
  '206': '2724', // Wichita State Shockers
  '207': '2737', // Winthrop Eagles
  '267': '2539', // San Francisco Dons
  '274': '2535', // Samford Bulldogs
  '287': '2250', // Gonzaga Bulldogs
  '289': '2729', // William & Mary Tribe
  '296': '2454', // North Florida Ospreys
  '303': '2210', // Elon Phoenix
  '307': '338',  // Kennesaw State Owls
  '310': '2449', // North Dakota State Bison
  '312': '2752', // Xavier Musketeers
  '313': '2083', // Bucknell Bison
  '316': '2006', // Akron Zips
  '318': '2011', // Alabama State Hornets
  '320': '2032', // Arkansas State Red Wolves
  '327': '2934', // Cal State Bakersfield Roadrunners
  '337': '2166', // Davidson Wildcats
  '353': '50',   // Florida A&M Rattlers
  '354': '2230', // Fordham Rams
  '360': '2253', // Grand Canyon Lopes
  '363': '108',  // Harvard Crimson
  '364': '2364', // High Point Panthers
  '371': '2916', // Incarnate Word Cardinals
  '377': '2329', // Lehigh Mountain Hawks
  '378': '288',  // Lipscomb Bisons
  '380': '2344', // Longwood Lancers
  '384': '276',  // Marshall Thundering Herd
  '393': '116',  // Mount St. Mary's Mountaineers
  '394': '93',   // Murray State Racers
  '400': '2450', // Norfolk State Spartans
  '401': '2448', // North Carolina A&T Aggies
  '408': '2459', // Northern Illinois Huskies
  '410': '2410', // Northern Kentucky Norse
  '412': '2473', // Oakland Golden Grizzlies
  '416': '2501', // Portland Pilots
  '421': '2515', // Radford Highlanders
  '422': '227',  // Rhode Island Rams
  '425': '2603', // Saint Joseph's Hawks
  '429': '2565', // SIU Edwardsville Cougars
  '438': '2617', // Stephen F. Austin Lumberjacks
  '441': '2635', // Tennessee Tech Golden Eagles
  '442': '2630', // UT Martin Skyhawks
  '443': '357',  // Texas A&M-Corpus Christi Islanders
  '445': '2649', // Toledo Rockets
  '447': '5',    // UAB Blazers
  '450': '2378', // UMBC Retrievers
  '453': '2908', // South Carolina Upstate Spartans
  '458': '222',  // Villanova Wildcats
  '459': '2678', // VMI Keydets
  '460': '2681', // Wagner Seahawks
  '462': '2710', // Western Illinois Leathernecks
  '463': '2711', // Western Michigan Broncos
  '926': '2815', // Lindenwood Lions
  '932': '292',  // UT Rio Grande Valley Vaqueros
  '1103': '2453', // North Alabama Lions
  '1105': '2856', // California Baptist Lancers
  '1143': '91',   // Bellarmine Knights
  '1145': '2627', // Tarleton State Texans
  '1146': '3101', // Utah Tech Trailblazers
  '1147': '28',   // UC San Diego Tritons
  '1148': '2771', // Merrimack Warriors
  '1189': '263',  // Loras College Duhawks
  '1245': '284',  // Stonehill Skyhawks
  '129698': '2385', // Mercyhurst Lakers
  '129701': '2042', // Augustana College (Il) Vikings
  '129702': '2044', // Aurora Spartans
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
