// Reference implementation — copied unmodified into each project's api/_lib/seasonGuard.js
// Tests live alongside this file at seasonGuard.test.mjs.

function currentMMDDUTC() {
  const n = new Date();
  const mm = String(n.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(n.getUTCDate()).padStart(2, "0");
  return mm + dd;
}

function isInSeason() {
  const start = process.env.SEASON_START_MMDD;
  const end = process.env.SEASON_END_MMDD;
  if (!start || !end) return true; // fail-open when unconfigured
  const today = currentMMDDUTC();
  if (start <= end) return today >= start && today <= end;
  // wraparound (e.g. NFL 0901–0215)
  return today >= start || today <= end;
}

function isForced(req) {
  const secret = process.env.CRON_FORCE_SECRET;
  if (!secret) return false;
  const q = (req && req.query && req.query.force) || "";
  return q === secret;
}

async function logSkip(logTable, projectSlug) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !logTable) return;
  try {
    await fetch(`${url}/rest/v1/${logTable}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "skipped_offseason",
        project: projectSlug,
      }),
    });
  } catch (_) {
    // Never fail the handler because logging failed.
  }
}

/**
 * Call at the top of a cron handler:
 *   if (await requireInSeason(req, res, { slug:'nfl', logTable:'nfl_sync_log' })) return;
 *
 * Returns true when the guard tripped and the response was sent (caller should return).
 * Returns false when the handler should continue.
 */
export async function requireInSeason(req, res, { slug, logTable }) {
  if (isInSeason() || isForced(req)) return false;
  await logSkip(logTable, slug);
  res.status(200).json({ skipped: true, reason: "offseason", slug });
  return true;
}
