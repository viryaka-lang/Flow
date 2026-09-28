import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, todayKey } from "../js/dates.js";
import { buildDayMap, computeStats, getStatus, predictPeriods, validatePeriod } from "../js/cycle.js";
import { extractLegacy, normalizePeriods } from "../js/store.js";

const settings = { cycleLength: 28, periodLength: 5 };
const p = (id, start, end) => ({ id, start, end });

test("uses settings until two periods are logged", () => {
  const stats = computeStats([p("a", "2026-01-01", "2026-01-04")], settings);
  assert.equal(stats.cycleLength, 28);
  assert.equal(stats.periodLength, 4);
  assert.equal(stats.cycleCount, 0);
  assert.equal(stats.variation, null);
});

test("learns cycle and period length from history (median)", () => {
  const periods = [
    p("a", "2026-01-01", "2026-01-05"), // 30-day cycle
    p("b", "2026-01-31", "2026-02-03"), // 31
    p("c", "2026-03-03", "2026-03-06"), // 58: a forgotten month
    p("d", "2026-04-30", "2026-05-03"), // 30
    p("e", "2026-05-30", "2026-06-02")
  ];
  const stats = computeStats(periods, settings);
  assert.equal(stats.cycleLength, 31); // median of 30, 31, 58, 30 = 30.5
  assert.equal(stats.periodLength, 4);
  assert.equal(stats.shortestCycle, 30);
  assert.equal(stats.longestCycle, 58);
});

test("predicts the next periods from the last start", () => {
  const periods = [p("a", "2026-01-01", "2026-01-05"), p("b", "2026-01-29", "2026-02-02")];
  const stats = computeStats(periods, settings);
  assert.deepEqual(predictPeriods(periods, stats, "2026-02-10", 2), [
    { start: "2026-02-26", end: "2026-03-02" },
    { start: "2026-03-26", end: "2026-03-30" }
  ]);
});

test("late period: next prediction anchors on today", () => {
  const periods = [p("a", "2026-01-01", "2026-01-05")];
  const status = getStatus(periods, settings, "2026-02-03");
  assert.equal(status.phase, "late");
  assert.equal(status.daysLate, 5);
  assert.equal(status.predictions[0].start, "2026-02-03");
});

test("status while waiting and during a period", () => {
  const closed = [p("a", "2026-01-01", "2026-01-05")];
  const waiting = getStatus(closed, settings, "2026-01-20");
  assert.equal(waiting.phase, "waiting");
  assert.equal(waiting.daysUntil, 9);
  assert.equal(waiting.cycleDay, 20);

  const open = getStatus([p("a", "2026-01-01", null)], settings, "2026-01-03");
  assert.equal(open.phase, "period");
  assert.equal(open.periodDay, 3);
  assert.equal(open.expectedEnd, "2026-01-05");
  assert.equal(open.stale, false);
  assert.equal(getStatus([p("a", "2026-01-01", null)], settings, "2026-01-20").stale, true);
});

test("validation rejects overlaps, future dates and old open periods", () => {
  const today = "2026-03-01";
  const periods = [p("a", "2026-01-01", "2026-01-05"), p("b", "2026-01-29", "2026-02-02")];
  assert.match(validatePeriod(p("x", "2026-01-04", "2026-01-08"), periods, today), /overlaps/);
  assert.match(validatePeriod(p("x", "2026-03-02", null), periods, today), /future/);
  assert.match(validatePeriod(p("x", "2026-02-10", "2026-03-05"), periods, today), /future/);
  assert.match(validatePeriod(p("x", "2026-01-10", null), periods, today), /most recent/);
  assert.match(validatePeriod(p("x", "2026-02-10", "2026-02-09"), periods, today), /on or after/);
  assert.equal(validatePeriod(p("x", "2026-02-26", null), periods, today), null);
  // Editing a period doesn't conflict with itself.
  assert.equal(validatePeriod(p("b", "2026-01-28", "2026-02-03"), periods, today), null);
});

test("calendar map marks logged and predicted days", () => {
  const map = buildDayMap([p("a", "2026-01-01", null)], settings, "2026-01-02");
  assert.equal(map.get("2026-01-01"), "period");
  assert.equal(map.get("2026-01-02"), "period");
  assert.equal(map.get("2026-01-03"), "predicted"); // rest of the current period
  assert.equal(map.get("2026-01-06"), undefined);
  assert.equal(map.get("2026-01-29"), "predicted"); // next period
});

test("normalizePeriods drops overlaps and closes earlier open periods", () => {
  const result = normalizePeriods([
    { start: "2026-01-01", end: null },
    { start: "2026-01-29", end: "2026-02-02" },
    { start: "2026-01-30", end: "2026-02-05" },
    { start: "not a date" }
  ]);
  assert.deepEqual(result.map(({ start, end }) => [start, end]), [
    ["2026-01-01", "2026-01-28"],
    ["2026-01-29", "2026-02-02"]
  ]);
});

test("legacy import skips FlowSync demo data but keeps the user's own logs", () => {
  const seededAt = "2026-01-01T10:00:00.000Z";
  const later = "2026-03-01T10:00:00.000Z";
  const today = todayKey();
  const legacy = {
    settings: [{ id: "global", activeProfileId: "prof_sarah_regular" }],
    profiles: [{ id: "prof_sarah_regular", createdAt: seededAt }],
    cycles: [{ id: "cyc_sarah_1", profileId: "prof_sarah_regular", startDate: "2025-12-01", periodLength: 5 }],
    dailyLogs: [
      { profileId: "prof_sarah_regular", date: "2025-12-01", flow: "heavy", updatedAt: seededAt },
      { profileId: "prof_sarah_regular", date: "2026-02-10", flow: "medium", updatedAt: later },
      { profileId: "prof_sarah_regular", date: "2026-02-11", flow: "medium", updatedAt: later },
      { profileId: "prof_sarah_regular", date: "2026-02-13", flow: "light", updatedAt: later },
      { profileId: "prof_sarah_regular", date: "2026-02-14", flow: "none", updatedAt: later },
      // Pre-filled days that run past today mean the period is still going.
      { profileId: "prof_sarah_regular", date: addDays(today, -1), flow: "medium", updatedAt: later },
      { profileId: "prof_sarah_regular", date: today, flow: "medium", updatedAt: later },
      { profileId: "prof_sarah_regular", date: addDays(today, 1), flow: "light", updatedAt: later }
    ]
  };
  const result = extractLegacy(legacy);
  assert.deepEqual(result.periods.map(({ start, end }) => [start, end]), [
    ["2026-02-10", "2026-02-13"],
    [addDays(today, -1), null]
  ]);
});

test("legacy import returns null when only demo data exists", () => {
  const seededAt = "2026-01-01T10:00:00.000Z";
  assert.equal(extractLegacy({
    settings: [{ id: "global", activeProfileId: "prof_sarah_regular" }],
    profiles: [{ id: "prof_sarah_regular", createdAt: seededAt }],
    cycles: [{ id: "cyc_sarah_0", profileId: "prof_sarah_regular", startDate: "2025-12-01", periodLength: 5 }],
    dailyLogs: [{ profileId: "prof_sarah_regular", date: "2025-12-01", flow: "heavy", updatedAt: seededAt }]
  }), null);
});
