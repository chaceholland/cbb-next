# Sprint 2 (Stats Week) - Testing Checklist

## Stats Calculation Engine

### Innings Pitched Parsing
- [ ] "5.0" → 5.00 innings
- [ ] "5.1" → 5.33 innings (5 1/3)
- [ ] "5.2" → 5.67 innings (5 2/3)
- [ ] Invalid inputs return 0

### ERA Calculation
- [ ] ERA = (ER × 9) / IP
- [ ] Returns 0 when IP < 0.33
- [ ] Example: 5 ER in 15 IP → 3.00 ERA

### WHIP Calculation
- [ ] WHIP = (BB + H) / IP
- [ ] Returns 0 when IP < 0.33
- [ ] Example: 5 BB, 10 H in 15 IP → 1.00 WHIP

### K/9 Calculation
- [ ] K/9 = (K × 9) / IP
- [ ] Example: 20 K in 15 IP → 12.00 K/9

### K/BB Ratio
- [ ] Returns Infinity when walks = 0 and strikeouts > 0
- [ ] Returns 0 when both = 0
- [ ] Example: 20 K, 5 BB → 4.00 K/BB

## Leaderboards

### Sorting
- [ ] ERA: Lower is better (ascending)
- [ ] WHIP: Lower is better (ascending)
- [ ] K: Higher is better (descending)
- [ ] IP: Higher is better (descending)
- [ ] K/9: Higher is better (descending)
- [ ] K/BB: Higher is better (descending)

### Minimum IP Qualifications
- [ ] ERA: 20 IP minimum
- [ ] WHIP: 20 IP minimum
- [ ] K: 0 IP minimum
- [ ] IP: 0 IP minimum
- [ ] K/9: 10 IP minimum
- [ ] K/BB: 10 IP minimum

### Display
- [ ] Shows top 10 pitchers in each category
- [ ] Category tabs work correctly
- [ ] Rank displays with # prefix
- [ ] Values formatted correctly

## Team Records

### Calculation
- [ ] W-L counts correct from cbb_games
- [ ] Win percentage = wins / total games
- [ ] Home/away splits calculated correctly
- [ ] Conference records calculated (currently 0-0 due to TODO)

### Streak Detection
- [ ] Looks at last 10 games
- [ ] Counts consecutive wins or losses
- [ ] Displays as "W3", "L2", etc.
- [ ] Empty when no games played

### Schedule View Integration
- [ ] Records appear next to team names
- [ ] Shows for both home and away teams
- [ ] Updates when new games completed

## Conference Standings

### Display
- [ ] Teams sorted by win percentage
- [ ] Shows rank, team, W-L, Win%, Conf record, Streak
- [ ] Conference selector works
- [ ] Empty state for conferences with no teams
- [ ] Loading state during fetch

## Performance Charts

### ERA Trend Chart
- [ ] Shows cumulative season ERA per game
- [ ] X-axis shows dates
- [ ] Y-axis shows ERA values
- [ ] Tooltip shows opponent name
- [ ] Blue line color

### K/9 Trend Chart
- [ ] Shows cumulative season K/9 per game
- [ ] X-axis shows dates
- [ ] Y-axis shows K/9 values
- [ ] Tooltip shows opponent name
- [ ] Green line color

## Pitcher Modal Stats Tab

### Tab Functionality
- [ ] Bio tab shows existing info
- [ ] Stats tab loads on click (lazy loading)
- [ ] Tab switcher works correctly
- [ ] Resets to Bio when modal closes

### Stats Display
- [ ] Season stats card shows all metrics
- [ ] Last 5 games card shows recent form
- [ ] ERA chart renders correctly
- [ ] K/9 chart renders correctly
- [ ] Loading state shown while fetching
- [ ] Empty state when no stats available

## Analytics View Integration

### Leaderboards Section
- [ ] Loads all pitcher stats
- [ ] Displays Leaderboards component
- [ ] Loading state during fetch
- [ ] All category tabs work
- [ ] Stats calculations accurate

## Dark Mode

### Components
- [ ] PitcherStatsCard dark mode colors
- [ ] StatsTable dark mode colors
- [ ] Leaderboards dark mode colors
- [ ] PerformanceChart tooltips readable in dark mode
- [ ] PitcherModal Stats tab dark mode colors
- [ ] ConferenceStandings dark mode colors

## Build & Deployment

- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No React warnings
- [ ] Production bundle size reasonable
