# College Baseball (CBB) Pitcher Tracker — cbb-next

_Project instructions for Claude Code. Global rules: `~/.claude/CLAUDE.md`. Deep reference: `~/claude-shared/memory/`._

**Accounts (canonical — do not deviate):** GitHub **`chaceholland`** · commit & push as `Chace Holland <chace_holland@yahoo.com>` · Vercel team **`chace-holland-4133's projects`**. Never commit as gmail / `mchaceholland-hub`, and never set a local `user.email` override. Verify: `git config user.email` + `gh auth status`. (Full detail: `~/.claude/CLAUDE.md`.)

**Purpose:** D1 college-baseball pitcher participation tracker. **This (`cbb-next`) is the current Next.js app** — `~/Desktop/CBB` is the retired older version. Repo: `chaceholland/cbb-next`.

**Stack:** Next.js 16.1.6 + React 19, Tailwind v4. Vercel + Cron. Supabase P1 `dtnozcqkuzhjmjvsfjqk`.

**Data:** `cbb_pitchers` (has `espn_id` bridge), `cbb_pitcher_participation`, `cbb_games` (~12.7k rows).

**Cron (`vercel.json`):** `/api/update` @ 06:00. **API/scripts:** `app/api/`, `scripts/`.

**Conventions & gotchas:**
- Rosters/headshots scraped from each school's **SIDEARM** site (ESPN lacks them) — use the **athlete-scraper** skill. Jersey numbers from SIDEARM/WMT (`extract_jerseys.py`).
- Mem: `reference_cbb_schedule_pitcher_matching` (" - P " name infix; synthetic `espn_id`; charcode React-key collisions; unoptimized headshots bypass `next.config`), `reference_cbb_games_team_id_scramble` (fixed 06-01), `reference_cbb_jersey_backfill`, `project_cbb_tailwind_v4_fix` (missing PostCSS config once broke all CSS — keep `postcss.config` present).
- `service_role` server-side env only; client `sb_publishable_*`; auto-deploy on verified fix.
