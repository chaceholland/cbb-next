// Tests for the shared season guard. Run: npm test  (node --test, no deps)
//
// The regression that motivated these: SEASON_*_MMDD are compared as strings
// against a bare "MMDD", so a dashed value ("08-26") silently inverted the
// window instead of failing, leaving crons "in season" year-round.

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

const { isInSeason, isForced, normalizeMMDD } = await import("./seasonGuard.js");

// Freeze "today" so the window assertions are deterministic.
const RealDate = Date;
function freezeUTC(iso) {
  const fixed = new RealDate(iso);
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      return args.length ? new RealDate(...args) : fixed;
    }
    static now() {
      return fixed.getTime();
    }
  };
}
function unfreeze() {
  globalThis.Date = RealDate;
}

function withWindow(start, end, fn) {
  const prev = [process.env.SEASON_START_MMDD, process.env.SEASON_END_MMDD];
  if (start === undefined) delete process.env.SEASON_START_MMDD;
  else process.env.SEASON_START_MMDD = start;
  if (end === undefined) delete process.env.SEASON_END_MMDD;
  else process.env.SEASON_END_MMDD = end;
  try {
    return fn();
  } finally {
    if (prev[0] === undefined) delete process.env.SEASON_START_MMDD;
    else process.env.SEASON_START_MMDD = prev[0];
    if (prev[1] === undefined) delete process.env.SEASON_END_MMDD;
    else process.env.SEASON_END_MMDD = prev[1];
  }
}

describe("normalizeMMDD", () => {
  test("passes through valid MMDD", () => {
    assert.equal(normalizeMMDD("0826"), "0826");
    assert.equal(normalizeMMDD("0131"), "0131");
  });

  test("strips separators — the bug that started this", () => {
    assert.equal(normalizeMMDD("08-26"), "0826");
    assert.equal(normalizeMMDD("08/26"), "0826");
    assert.equal(normalizeMMDD(" 0826 "), "0826");
  });

  test("rejects nonsense rather than guessing", () => {
    assert.equal(normalizeMMDD("826"), null);
    assert.equal(normalizeMMDD("1326"), null); // month 13
    assert.equal(normalizeMMDD("0800"), null); // day 0
    assert.equal(normalizeMMDD("abcd"), null);
    assert.equal(normalizeMMDD(""), null);
    assert.equal(normalizeMMDD(null), null);
  });
});

describe("isInSeason", () => {
  after(unfreeze);

  test("fails open when unconfigured", () => {
    freezeUTC("2026-06-15T12:00:00Z");
    withWindow(undefined, undefined, () => assert.equal(isInSeason(), true));
  });

  test("wraparound window: CFB 0820-0131", () => {
    // Mid-August, before kickoff → offseason.
    freezeUTC("2026-08-17T12:00:00Z");
    withWindow("0820", "0131", () => assert.equal(isInSeason(), false));

    // Opening day → in season.
    freezeUTC("2026-08-20T12:00:00Z");
    withWindow("0820", "0131", () => assert.equal(isInSeason(), true));

    // Week 0 → in season.
    freezeUTC("2026-08-29T12:00:00Z");
    withWindow("0820", "0131", () => assert.equal(isInSeason(), true));

    // CFP final in late January → still in season.
    freezeUTC("2027-01-26T12:00:00Z");
    withWindow("0820", "0131", () => assert.equal(isInSeason(), true));

    // February → offseason.
    freezeUTC("2027-02-10T12:00:00Z");
    withWindow("0820", "0131", () => assert.equal(isInSeason(), false));
  });

  test("0115 end date would cut off a late-January CFP final", () => {
    freezeUTC("2027-01-26T12:00:00Z");
    withWindow("0820", "0115", () => assert.equal(isInSeason(), false));
    withWindow("0820", "0131", () => assert.equal(isInSeason(), true));
  });

  test("non-wrapping window stays bounded", () => {
    freezeUTC("2026-05-01T12:00:00Z");
    withWindow("0301", "0630", () => assert.equal(isInSeason(), true));
    freezeUTC("2026-08-01T12:00:00Z");
    withWindow("0301", "0630", () => assert.equal(isInSeason(), false));
  });

  test("REGRESSION: dashed values must not invert the window", () => {
    // Aug 17 is outside 08-26..01-31. Before normalization this returned true
    // because "-" sorts below every digit, so the guard never skipped.
    freezeUTC("2026-08-17T12:00:00Z");
    withWindow("08-26", "01-31", () => assert.equal(isInSeason(), false));
    freezeUTC("2026-08-27T12:00:00Z");
    withWindow("08-26", "01-31", () => assert.equal(isInSeason(), true));
  });

  test("malformed values fail open instead of pretending to be configured", () => {
    freezeUTC("2026-06-15T12:00:00Z");
    withWindow("garbage", "0131", () => assert.equal(isInSeason(), true));
  });
});

describe("isForced", () => {
  const prev = process.env.CRON_FORCE_SECRET;
  before(() => {
    process.env.CRON_FORCE_SECRET = "s3cret";
  });
  after(() => {
    if (prev === undefined) delete process.env.CRON_FORCE_SECRET;
    else process.env.CRON_FORCE_SECRET = prev;
  });

  test("matches the configured secret", () => {
    assert.equal(isForced({ query: { force: "s3cret" } }), true);
  });

  test("rejects wrong, missing, and malformed input", () => {
    assert.equal(isForced({ query: { force: "nope" } }), false);
    assert.equal(isForced({ query: {} }), false);
    assert.equal(isForced({}), false);
    assert.equal(isForced(undefined), false);
  });

  test("cannot be forced when no secret is set", () => {
    delete process.env.CRON_FORCE_SECRET;
    assert.equal(isForced({ query: { force: "anything" } }), false);
    process.env.CRON_FORCE_SECRET = "s3cret";
  });
});
