// Reference implementation — copied unmodified into each project's api/_lib/seasonGuard.js
// Tests live alongside this file at seasonGuard.test.mjs.

function currentMMDDUTC() {
  const n = new Date();
  const mm = String(n.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(n.getUTCDate()).padStart(2, "0");
  return mm + dd;
}

// SEASON_*_MMDD are compared as strings against a bare "MMDD" (e.g. "0817"), so
// a value entered as "08-26" does NOT merely fail — it silently inverts the
// window. "-" (0x2D) sorts below every digit, so "0817" > "08-26" and a guard
// meant to open on Aug 26 reports in-season all year.
//
// Normalize to 4 digits and reject anything that isn't a real MM/DD, so a typo
// degrades to the documented unconfigured behaviour (fail open, always run)
// instead of a window that looks configured and is wrong.
function normalizeMMDD(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const mm = Number(digits.slice(0, 2));
  const dd = Number(digits.slice(2));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return digits;
}

function isInSeason() {
  const rawStart = process.env.SEASON_START_MMDD;
  const rawEnd = process.env.SEASON_END_MMDD;
  if (!rawStart || !rawEnd) return true; // fail-open when unconfigured

  const start = normalizeMMDD(rawStart);
  const end = normalizeMMDD(rawEnd);
  if (!start || !end) {
    console.warn(
      `[seasonGuard] Ignoring malformed season window ` +
        `(SEASON_START_MMDD=${rawStart}, SEASON_END_MMDD=${rawEnd}); expected MMDD. Running anyway.`,
    );
    return true;
  }

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
export { isInSeason, isForced, normalizeMMDD };

export async function requireInSeason(req, res, { slug, logTable }) {
  if (isInSeason() || isForced(req)) return false;
  await logSkip(logTable, slug);
  res.status(200).json({ skipped: true, reason: "offseason", slug });
  return true;
}
