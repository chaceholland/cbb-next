// Shared alert helper — Pass 2 draft.
// Drop into <repo>/api/_lib/alert.js (or app/api/_lib/alert.js for Next.js routers).
// Side-effect free import (no top-level fetch). Soft-disabled if NTFY_TOPIC is unset,
// so wiring it up does not change behavior until the env var is set in Vercel.

const NTFY_TOPIC = process.env.NTFY_TOPIC;            // e.g. chace-nfl-tracker
const SLACK_HOOK = process.env.SLACK_WEBHOOK_URL;     // optional
const APP_NAME  = process.env.APP_NAME ?? "tracker";

const TAG_BY_LEVEL = { info: "white_check_mark", warn: "warning", error: "rotating_light" };
const PRI_BY_LEVEL = { info: "3", warn: "4", error: "5" };

export async function alert(level, totals) {
  if (!NTFY_TOPIC) return;  // no-op until configured
  const title = `[${level.toUpperCase()}] ${APP_NAME} update`;
  const body = typeof totals === "string" ? totals : JSON.stringify(totals, null, 2);
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        Title: title,
        Tags: TAG_BY_LEVEL[level] ?? "information_source",
        Priority: PRI_BY_LEVEL[level] ?? "3",
      },
      body,
    });
  } catch (e) {
    console.warn(`[alert] ntfy publish failed: ${e?.message ?? e}`);
  }
  if (SLACK_HOOK) {
    try {
      await fetch(SLACK_HOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*${title}*\n\`\`\`${body}\`\`\`` }),
      });
    } catch (e) {
      console.warn(`[alert] slack publish failed: ${e?.message ?? e}`);
    }
  }
}

export function shouldAlertWarn(totals) {
  // Generic policy. Override per-app if needed.
  const failed = Number(totals.errors?.length ?? totals.failed ?? 0);
  const attempted = Number(totals.gamesScraped ?? totals.attempted ?? 0);
  const ok = Number(totals.participationRecords ?? totals.ok ?? 0);
  if (failed > 0) return true;
  if (attempted >= 5 && ok === 0) return true;
  return false;
}
