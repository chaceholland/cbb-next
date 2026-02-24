# CBB Pitcher Tracker - Comprehensive Improvements Design
**Date:** 2026-02-23
**Approach:** Themed Sprints (5 sprints over 6-8 weeks)

---

## Overview

This document outlines a comprehensive improvement plan for the CBB Pitcher Tracker, organized into themed sprints that deliver complete feature sets across User Experience, Data & Analytics, Functionality, and Data Quality.

---

## Technical Foundation

### Current Stack
- Next.js 16.1.6 with App Router
- Supabase (PostgreSQL + Auth + Storage)
- TailwindCSS + Framer Motion
- TypeScript

### New Infrastructure Additions
- **Command System**: Centralized command palette (cmdk library)
- **State Management**: Zustand for global state (preferences, filters, command history)
- **Notifications**: Browser Notification API + optional Supabase Realtime for live updates
- **Caching**: React Query for server state management and optimistic updates
- **Analytics Tracking**: Simple event tracking for feature usage
- **Background Jobs**: Supabase Edge Functions for scheduled tasks (data refresh)

### Database Schema Additions
```sql
-- User preferences (stored in localStorage initially, can migrate to Supabase later)
user_preferences: theme, default_view, favorite_conferences, etc.

-- New tables for stats tracking:
pitcher_stats: pitcher_id, season, games, innings, era, strikeouts, walks, earned_runs
game_reminders: user_id, game_id, remind_at, sent
user_notes: user_id, entity_type, entity_id, note_text, created_at
```

### File Structure Pattern
```
app/
├── (features)/
│   ├── command-palette/      # New: Command system
│   ├── notifications/         # New: Reminders & alerts
│   └── stats/                # New: Stats engine
├── schedule/                  # Existing
├── rosters/                   # Existing
└── analytics/                 # Existing

components/
├── ui/                       # Shadcn-style primitives
├── command/                  # Command palette components
└── stats/                    # Stats widgets

lib/
├── stats/                    # Stats calculation engine
├── notifications/            # Notification helpers
└── commands/                 # Command definitions
```

---

## Sprint 1: UX Week (5-7 days)

**Goal:** Make the tracker feel polished, fast, and professional with modern UX patterns.

### Feature 1: Command Palette (⌘K / Ctrl+K)

**What it does:**
- Universal search and navigation hub
- Accessible from anywhere with keyboard shortcut
- Fuzzy search across teams, pitchers, games, and actions

**Commands included:**
- **Navigation**: "Go to Schedule", "Go to Rosters", "Go to Analytics"
- **Quick Actions**: "Toggle Dark Mode", "Export Schedule", "Clear Filters"
- **Search**: Live results for teams (→ opens team roster), pitchers (→ opens pitcher modal), games (→ opens game detail)
- **Filters**: "Show SEC games only", "Show favorites only", "Show Week 5"
- **Recent**: Last 5 searches/actions for quick repeat

**Implementation:**
- Use `cmdk` library (same as Linear, Raycast)
- Integrate with existing routing and state
- Store recent commands in localStorage (max 10)

---

### Feature 2: Enhanced Keyboard Shortcuts

**New shortcuts:**
- `/` - Focus search input (already exists, keep it)
- `⌘K` / `Ctrl+K` - Open command palette
- `Escape` - Close modals/palette (already exists)
- `⌘E` / `Ctrl+E` - Export current view
- `⌘D` / `Ctrl+D` - Toggle dark mode
- `1, 2, 3` - Switch tabs (Schedule, Rosters, Analytics)
- `Space` - Expand/collapse selected week (on schedule)
- `↑/↓` - Navigate games/teams (when focused)

**Display:**
- Keyboard shortcuts hint bar (dismissible tooltip on first visit)
- Show shortcuts in command palette
- Shortcuts displayed in tooltips on hover

---

### Feature 3: Loading States & Empty States

**Loading improvements:**
- Skeleton loaders matching actual content layout (not just spinners)
- Progressive loading: Show cached data immediately, update when fresh data arrives
- Loading indicators for individual sections (not blocking entire page)

**Empty states:**
- No games found: Friendly message + "Clear filters" button
- No favorites: "Star your first pitcher!" with tutorial
- No search results: "No matches found. Try a different search" + suggestions
- First visit: Welcome message with quick tour option

---

### Feature 4: Pitcher Comparison Tool

**What it does:**
- Select 2-3 pitchers and view side-by-side comparison
- Compare bio data + stats (when stats are added in Sprint 2)
- Accessible from roster view or command palette

**UI:**
- "Compare" button appears when 2-3 pitchers are selected (checkboxes on cards)
- Opens modal or side panel with comparison table
- Fields compared: Headshot, Name, Team, Position, Year, Height, Weight, Hometown, Bats/Throws
- Later (Sprint 2): Add stats columns (ERA, K/9, Games, etc.)

**Interaction:**
- Click pitcher cards to select/deselect
- Max 3 pitchers at once
- Clear selection button
- Share comparison via URL (encode pitcher IDs)

---

### Feature 5: Filter & Search Memory

**What it does:**
- Remember last used filters per view (Schedule, Rosters, Analytics)
- Remember search queries (last 5)
- Quick restore of previous filter state

**Storage:**
- localStorage: `cbb-schedule-last-filters`, `cbb-roster-last-filters`
- Restore on page load
- "Clear all filters" also clears history

**UI:**
- "Recent filters" dropdown showing last 3 filter combinations
- One-click restore
- Small tag showing "Restored from last visit" (dismissible)

---

### Feature 6: Dark Mode

**Implementation:**
- Toggle in navigation bar (sun/moon icon)
- Preference stored in localStorage: `cbb-theme` (light/dark/system)
- System preference detection (prefers-color-scheme)
- Smooth transition animation (0.2s)

**Design:**
- Dark mode palette: slate-900 bg, slate-800 cards, slate-700 borders
- Maintain brand colors (blue/orange gradients)
- Reduce eye strain (softer whites to slate-50)

---

### Feature 7: Sticky Headers

**What it does:**
- Week headers stick to top when scrolling on schedule view
- Filter bar sticks to top on all views
- Tab bar sticks below hero on scroll

**Behavior:**
- Smooth scroll-based reveal
- Z-index management (modals > sticky > content)
- Shadow appears when stuck (visual separation)

---

### Feature 8: Mobile Optimizations

**Improvements:**
- Bottom tab bar for mobile (easier thumb access)
- Swipe gestures: Swipe left/right to switch tabs
- Compact game cards on mobile (smaller fonts, tighter spacing)
- Touch-friendly targets (min 44px tap areas)
- Collapsible filter panels on mobile (slide-up drawer)
- Improved modal behavior (full-screen on mobile)

---

## Sprint 2: Stats Week (7-10 days)

**Goal:** Add meaningful statistics that transform the tracker from a roster tool into a performance analysis platform.

### Feature 1: Pitcher Stats Engine

**Data Source:**
- Calculate stats from existing `cbb_pitcher_participation` table
- Fields available: `pitcher_id`, `game_id`, `innings_pitched`, `earned_runs`, `strikeouts`, `walks`, `hits_allowed`

**Calculated Stats:**
- **Basic**: Games (G), Innings Pitched (IP), Earned Runs (ER), Strikeouts (K), Walks (BB), Hits (H)
- **Ratios**: ERA = (ER × 9) / IP, K/9 = (K × 9) / IP, BB/9 = (BB × 9) / IP, WHIP = (BB + H) / IP
- **Win/Loss**: Track W-L record if we have game outcomes matched to pitcher participation
- **Aggregation**: Season totals, last 5 games, last 30 days

**Storage:**
- Create `pitcher_season_stats` table (aggregated, updated nightly)
- Real-time calculation for "recent form" (last N games)

**Display:**
- Pitcher modal: Stats tab with season totals + recent form
- Roster view: Add stats overlay on hover/click
- Analytics view: Leaderboards (top 10 in each stat)

---

### Feature 2: Team Records & Standings

**What it does:**
- Calculate team W-L records from completed games in `cbb_games`
- Conference standings with win percentage
- Home vs Away splits
- Win streaks (current streak indicator)

**Display:**
- Schedule view: Show team records in game cards (e.g., "Alabama 15-3")
- Analytics view: Conference standings table (sortable)
- Team roster header: Show record prominently

**Calculation:**
- Filter games where `completed = true` and team is home or away
- Count wins/losses based on scores
- Group by conference for standings
- Update on every game completion

---

### Feature 3: Top Performers Widget

**What it does:**
- Dashboard widget showing leaders across key stats
- Refreshes daily or on-demand

**Categories:**
- Most Games Pitched (availability/workhorse)
- Most Innings Pitched (workload leader)
- Most Strikeouts (dominance)
- Lowest ERA (min 20 IP - effectiveness)
- Best K/9 (strikeout rate)
- Best WHIP (efficiency)

**Display:**
- Home page (new): Featured performers section
- Analytics view: Leaderboard tables
- Filterable by conference, position (RHP/LHP), class year

---

### Feature 4: Performance Charts

**What it does:**
- Visual representation of pitcher performance over time
- Line charts showing trends

**Chart Types:**
- ERA by week (season progression)
- Strikeouts per game (trend line)
- Innings pitched per outing (workload tracking)
- Win probability based on recent form (if applicable)

**Implementation:**
- Use Recharts or Chart.js
- Interactive tooltips showing game details
- Zoom/pan for long seasons
- Export chart as image

**Display:**
- Pitcher modal: Performance tab with charts
- Analytics view: Team performance trends

---

### Feature 5: Pitcher Usage Tracking

**What it does:**
- Track pitcher rest days between appearances
- Identify potential overuse (e.g., 3+ games in 5 days)
- Estimate pitch counts if available

**Metrics:**
- Days since last appearance
- Games in last 7 days
- Average rest days this season
- Alert if < 2 days rest (injury risk indicator)

**Display:**
- Roster view: Badge showing "Rested" / "Recent" / "Heavy use"
- Schedule view: Show rest days for pitchers in upcoming games
- Analytics view: Team usage heatmap (who's being overworked)

---

### Feature 6: Head-to-Head Matchup Analysis

**What it does:**
- Compare pitcher performance against specific opponents
- Show historical matchups (if data exists)

**Data:**
- Filter `cbb_pitcher_participation` by opponent team
- Aggregate stats against each opponent
- Highlight best/worst matchups

**Display:**
- Game detail modal: Show pitcher stats vs opponent
- Pitcher modal: "Matchup history" section
- Schedule view: "Pitcher X has 2.1 ERA vs this opponent"

---

### Feature 7: Team Depth Charts

**What it does:**
- Classify pitchers as starters, relievers, or closers
- Show rotation order (if determinable)
- Identify bullpen depth

**Classification Logic:**
- Starter: Avg IP per appearance > 4.0
- Reliever: Avg IP per appearance 1.0-4.0
- Closer: Appears in 9th inning or save situations (if inning data available)
- Unknown: Insufficient data

**Display:**
- Team roster view: Group pitchers by role
- Drag-and-drop to manually adjust (save to localStorage)
- Analytics view: Conference depth comparison (avg starters per team)

---

### Feature 8: Stats API Layer

**Implementation:**
- Create `lib/stats/engine.ts` with pure functions
- Functions: `calculateERA()`, `calculateWHIP()`, `getLeaders()`, `getPlayerStats()`, etc.
- Caching layer (React Query) to avoid recalculating
- Background job (Supabase Edge Function) to pre-compute and store aggregates nightly

**Testing:**
- Unit tests for all stat calculations
- Verify against known results (compare with ESPN data if available)

---

## Sprint 3: Engagement Week (7-10 days)

**Goal:** Build features that keep users coming back and make the tracker part of their game day routine.

### Feature 1: Game Reminders

**What it does:**
- Users can set reminders for upcoming games
- Browser notification fires 1 hour before game time
- Optional: 24 hours before for planning

**Implementation:**
- Browser Notification API (requires permission)
- Store reminders in localStorage: `cbb-game-reminders`
- Background service worker checks every minute for pending reminders
- Fallback: In-app notification banner if browser notifications denied

**UI:**
- "Bell" icon on game cards (hollow = not set, filled = reminder active)
- Click to toggle reminder
- Settings: Choose reminder timing (1hr, 4hr, 24hr before)
- Batch actions: "Remind me for all favorite team games this week"

---

### Feature 2: Calendar Integration

**What it does:**
- Export games to user's calendar (iCal, Google Calendar, Outlook)
- Single game export or bulk export (all favorite team games)

**Implementation:**
- Generate `.ics` file (iCalendar format)
- Include: Game time, teams, venue, link back to tracker
- Support recurring exports (update when schedule changes)

---

### Feature 3: Personal Notes

**What it does:**
- Users can add private notes to pitchers and games
- Rich text editor (bold, italic, lists, links)
- Searchable notes

**Storage:**
- localStorage: `cbb-user-notes` (array of note objects)
- Schema: `{ id, entity_type: 'pitcher'|'game', entity_id, note_text, created_at, updated_at }`

---

### Feature 4: Watch Queue

**What it does:**
- Priority queue of games user wants to watch
- Drag-and-drop ordering
- Quick "Add to Queue" button on game cards

---

### Feature 5: Activity Feed

**What it does:**
- Show recent activity and updates relevant to user
- Personalized based on favorites and tracked teams

---

### Feature 6: Share Features

**What it does:**
- Share favorite lists via URL
- Share comparison results
- Share custom filters/views

---

### Feature 7: Quick Actions Bar

**What it does:**
- Persistent bottom bar (mobile) or sidebar (desktop) with quick actions
- Context-aware based on current view

---

### Feature 8: Onboarding & Tips

**What it does:**
- First-time user experience
- Interactive tutorial highlighting key features
- Contextual tips throughout app

---

## Sprint 4: Data Week (5-7 days)

**Goal:** Build tools and automation to maintain high data quality with minimal manual effort.

### Feature 1: Admin Data Panel
- Dedicated admin interface for bulk data operations
- Batch editing capabilities
- Import/Export CSV
- Preview and rollback changes

### Feature 2: Automated Data Refresh
- Daily background job to fetch updated game data from ESPN
- Supabase Edge Function scheduled via cron
- Update scores, participation, and new games
- Error handling and monitoring dashboard

### Feature 3: Data Validation Engine
- Define validation rules for data fields
- Real-time validation on data entry
- Batch validation scan
- Auto-fix suggestions

### Feature 4: Data Completeness Dashboard
- Visual dashboard showing data quality metrics
- Per-team and per-pitcher completeness scores
- "Needs Attention" list for teams below 70% completeness
- Trend charts and export reports

### Feature 5: Change History / Audit Log
- Track all data changes with timestamp
- PostgreSQL triggers on all data tables
- Timeline view and diff viewer
- Rollback capability

### Feature 6: Automated Issue Detection
- Background job scanning for common data issues
- Detection rules: duplicates, outliers, inconsistencies
- Auto-create data quality issues
- Weekly digest email

### Feature 7: Data Export & Backup
- Full database export in JSON, CSV, SQL, Excel formats
- Scheduled automatic backups
- Restore from backup with confirmation

### Feature 8: Smart Data Suggestions
- Use existing data patterns to suggest values for missing fields
- Rule-based predictions with confidence scores
- Bulk apply/reject suggestions

---

## Sprint 5: Premium Week (10-14 days)

**Goal:** Build transformational features that make this the definitive college baseball pitcher tracking platform.

### Feature 1: Real-Time Live Scores
- Display live scores for in-progress games
- ESPN API polling (30 second intervals) or Supabase Realtime
- Visual indicators: "🔴 LIVE" badge, score animations
- Sound notification option for favorite teams

### Feature 2: Live Game Tracker
- Pitch-by-pitch updates during games
- ESPN GameCast API integration
- Current count, base runners, play-by-play feed
- Inning-by-inning box score

### Feature 3: Progressive Web App (PWA)
- Install as native-like app on mobile/desktop
- Service worker for offline caching
- Push notifications (better than browser)
- Background sync for data refresh

### Feature 4: Advanced Stats
- Sabermetric calculations: FIP, K/BB, BABIP
- Add to pitcher_season_stats table
- "Advanced Stats" tab in pitcher modal
- Leaderboards for advanced metrics

### Feature 5: Predictive Analytics
- Game win probability based on pitching matchups
- Pitcher rest-of-season projections
- Matchup ratings (1-10 scale)
- Simple ML models or Elo-based system

### Feature 6: Performance Heatmaps
- Visual heatmaps by opponent, venue, day, time
- D3.js or Recharts implementation
- Interactive tooltips, export as image
- Show hot/cold streaks and patterns

### Feature 7: Multi-User Accounts & Sync
- Supabase Auth (email, OAuth)
- Sync favorites, notes, preferences across devices
- Profile pages with privacy settings
- Migrate localStorage to database on login

### Feature 8: Social Features
- Follow other users, share favorite lists
- Community leaderboards and discovery
- Public profiles: `/@username`
- Trending pitchers, top curators

---

## Testing, Deployment, and Success Metrics

### Testing Strategy

**Unit Tests:**
- Stats calculation functions (`lib/stats/engine.ts`)
- Validation rules engine
- Data transformation utilities
- Target: 80%+ coverage on critical business logic

**Integration Tests:**
- Supabase queries and mutations
- API polling and data sync
- Authentication flows
- Edge Functions (automated refresh)

**E2E Tests (Playwright):**
- Critical user flows: Search pitcher → View stats → Add favorite
- Command palette functionality
- Game reminder flow
- Data export
- Target: Core paths covered

**Manual QA:**
- Cross-browser testing (Chrome, Safari, Firefox, Edge)
- Mobile responsive testing (iOS Safari, Android Chrome)
- Accessibility audit (keyboard nav, screen readers)
- Performance testing (Lighthouse scores)

### Deployment Strategy

**Hosting:**
- Vercel (Next.js)
- Supabase (Database, Auth, Edge Functions, Storage)

**Environments:**
- **Development**: Local dev server + Supabase dev project
- **Staging**: Vercel preview deploys + Supabase staging project
- **Production**: Vercel production + Supabase production project

**Deployment Process:**
1. Create feature branch
2. Develop with local Supabase
3. Open PR → triggers Vercel preview deploy
4. Review and QA on preview
5. Merge to main → auto-deploy to production
6. Run smoke tests on production
7. Monitor errors (Sentry or Vercel Analytics)

**Database Migrations:**
- Use Supabase migrations (`supabase/migrations/`)
- Test migrations on staging first
- Run migrations before code deploy
- Keep rollback scripts ready

**Feature Flags (Optional):**
- Use environment variables for gradual rollout
- Example: `ENABLE_LIVE_SCORES=true` (enable per sprint)
- Progressive enhancement: New features degrade gracefully

### Success Metrics

**Sprint 1 (UX Week):**
- ✅ Command palette used by 30%+ of returning users
- ✅ Dark mode adoption: 20%+ of users
- ✅ Comparison tool: 100+ comparisons in first week
- ✅ Mobile bounce rate decreases by 15%
- ✅ Average session duration increases by 25%

**Sprint 2 (Stats Week):**
- ✅ Stats views: 500+ pitcher stat views per day
- ✅ Leaderboard engagement: 40%+ of users view leaderboards
- ✅ Performance charts: 200+ chart interactions per day
- ✅ Team records displayed on 90%+ of game cards
- ✅ Users spend 2+ minutes on pitcher modals (up from <1 min)

**Sprint 3 (Engagement Week):**
- ✅ Reminders set: 50+ game reminders per week
- ✅ Notes created: 100+ notes in first month
- ✅ Watch queue usage: 30%+ of users create queue
- ✅ Calendar exports: 20+ per week
- ✅ Return rate: 40%+ of users return within 7 days (up from 20%)

**Sprint 4 (Data Week):**
- ✅ Data completeness score increases from 60% to 85%+
- ✅ Automated refresh runs successfully 95%+ of time
- ✅ Data issues detected: 90%+ flagged automatically
- ✅ Admin panel used for 50+ bulk edits per month
- ✅ Zero critical data corruption incidents

**Sprint 5 (Premium Week):**
- ✅ Live score views: 200+ during game days
- ✅ PWA installs: 100+ in first month
- ✅ User accounts created: 500+ in first month
- ✅ Social features: 50+ public lists shared
- ✅ Advanced stats views: 300+ per week
- ✅ Daily active users (DAU) increases by 3x

**Overall Product Metrics:**
- 📈 Monthly active users: 5,000+ (from current baseline)
- 📈 Average session duration: 8+ minutes (from 3-4 min)
- 📈 Return user rate: 50%+ within 30 days
- 📈 Mobile traffic: 60%+ of total (optimized experience)
- 📈 User satisfaction: 4.5/5 stars (via in-app feedback)
- 📈 Page load time: <2 seconds (P75)
- 📈 Lighthouse score: 90+ (Performance, Accessibility, Best Practices, SEO)

---

## Risk Assessment and Mitigation

### Technical Risks

**Risk: ESPN API rate limiting or changes**
- Mitigation: Cache aggressively, implement exponential backoff, have manual data entry fallback

**Risk: Supabase costs scale unexpectedly**
- Mitigation: Monitor usage, implement pagination, cache computed stats, optimize queries

**Risk: Real-time features strain server resources**
- Mitigation: Limit concurrent connections, use polling instead of WebSocket initially, implement circuit breakers

**Risk: PWA complexity delays delivery**
- Mitigation: Start with basic PWA (manifest + service worker), add offline features incrementally

### Product Risks

**Risk: Features too complex for target users**
- Mitigation: User testing after each sprint, progressive disclosure, optional advanced features

**Risk: Data quality issues persist despite automation**
- Mitigation: Combine automated + manual review, incentivize community contributions, regular audits

**Risk: Low adoption of social features**
- Mitigation: Make profiles/sharing optional, focus on individual value first, add social as enhancement

### Timeline Risks

**Risk: Sprints take longer than estimated**
- Mitigation: Buffer time between sprints, prioritize ruthlessly, move non-critical features to future

**Risk: Dependencies block progress**
- Mitigation: Parallel development where possible, stub external APIs, feature flags for gradual rollout

---

## Post-Launch Iteration Plan

After completing all 5 sprints, prioritize based on usage data:

**High Priority (Next 30 days):**
- Bug fixes from user feedback
- Performance optimizations
- Mobile UX refinements
- Critical missing features identified during use

**Medium Priority (Next 90 days):**
- Additional stats and analytics
- More data automation
- Enhanced social features
- Integration with other platforms (Twitter, Discord)

**Long-term (6+ months):**
- Historical data (previous seasons)
- Mobile native app (React Native)
- Premium subscription tier
- API for third-party developers
- MLB Draft tracking integration

---

## Conclusion

This comprehensive improvement plan transforms the CBB Pitcher Tracker from a functional roster tool into the premier platform for college baseball pitcher analytics and tracking. The themed sprint approach ensures:

1. **Steady Progress**: Visible improvements every week
2. **Complete Features**: Each sprint delivers fully functional feature sets
3. **Flexibility**: Can pause between sprints to gather feedback and adjust priorities
4. **Balance**: Addresses UX, data, engagement, quality, and premium features

**Total Timeline:** 6-8 weeks of focused development
**Total Features:** 40+ new features across 5 sprints
**Expected Outcome:** 3x increase in DAU, 50%+ return rate, industry-leading college baseball tracker

---

**Design Status:** ✅ Complete and approved
**Next Step:** Create implementation plan for Sprint 1
