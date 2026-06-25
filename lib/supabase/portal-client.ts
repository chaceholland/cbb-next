// Pass 4 Feature #1 — second Supabase client for project 2 (CFB Portal).
// Used by /api/hub/summary to surface the latest portal_changes alongside
// the main-project trackers. Read-only.
//
// Falls back to undefined if the envs aren't set, so the hub still renders
// without portal data in environments that haven't been wired yet.

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

const PORTAL_URL =
  process.env.PORTAL_SUPABASE_URL ?? process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL;
const PORTAL_KEY =
  process.env.PORTAL_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

export function createPortalClient(): SupabaseClient | null {
  if (cached) return cached;
  if (!PORTAL_URL || !PORTAL_KEY) return null;
  cached = createSupabaseClient(PORTAL_URL, PORTAL_KEY);
  return cached;
}

export function portalAvailable(): boolean {
  return Boolean(PORTAL_URL && PORTAL_KEY);
}
