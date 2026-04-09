-- 2026-04-09: add espn_id column to cbb_pitchers for joining with
-- cbb_pitcher_participation (which uses ESPN numeric IDs, not the
-- synthetic {team_id}-P{n} IDs written by the roster scraper).
--
-- Run this in the Supabase SQL editor (or any psql client with service
-- role credentials) BEFORE running tools/backfill-espn-ids.cjs.
--
-- Safe to re-run: IF NOT EXISTS guards both the column and the index.
-- Rollback: drop index cbb_pitchers_espn_id_uq; alter table cbb_pitchers drop column espn_id;

-- Safety snapshot (optional but recommended — comment out if not wanted)
create table if not exists cbb_pitchers_backup_2026_04_09 as
  select * from cbb_pitchers;

alter table cbb_pitchers
  add column if not exists espn_id text;

create unique index if not exists cbb_pitchers_espn_id_uq
  on cbb_pitchers (espn_id)
  where espn_id is not null;

comment on column cbb_pitchers.espn_id is
  'ESPN numeric pitcher ID, populated by tools/backfill-espn-ids.cjs. '
  'Used to join against cbb_pitcher_participation.pitcher_id (which is '
  'an ESPN id, not the synthetic {team_id}-P{n} scheme on this table).';
