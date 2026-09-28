// Period statistics and predictions. Pure functions: a period is
// { id, start, end } with "YYYY-MM-DD" keys (end is null while ongoing), and
// "today" is always passed in, so everything here is easy to test.
import { addDays, diffDays, formatRange, isValidKey } from "./dates.js";

export const DEFAULT_SETTINGS = { cycleLength: 28, periodLength: 5 };

// Only the most recent cycles feed the averages, so predictions follow real
// changes (e.g. after stopping the pill) instead of years-old history.
const RECENT = 6;

// An open period older than this was probably never marked as ended.
const STALE_OPEN_DAYS = 10;

export function sortPeriods(periods) {
  return [...periods].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function periodDays(period) {
  return diffDays(period.start, period.end) + 1;
}

// Uses the median rather than the mean so one forgotten or unusual month
// doesn't drag every prediction along with it.
export function computeStats(periods, settings = DEFAULT_SETTINGS) {
  const sorted = sortPeriods(periods);
  const cycleLengths = [];
  for (let i = 1; i < sorted.length; i++) {
    cycleLengths.push(diffDays(sorted[i - 1].start, sorted[i].start));
  }
  const periodLengths = sorted.filter(p => p.end).map(periodDays);

  const recentCycles = cycleLengths.slice(-RECENT);
  const recentPeriods = periodLengths.slice(-RECENT);
  const cycleLength = recentCycles.length ? Math.round(median(recentCycles)) : settings.cycleLength;
  const periodLength = recentPeriods.length ? Math.round(median(recentPeriods)) : settings.periodLength;

  // Typical distance from the usual cycle length: the "± days" on predictions.
  let variation = null;
  if (recentCycles.length >= 2) {
    const deviation = recentCycles.reduce((sum, len) => sum + Math.abs(len - cycleLength), 0) / recentCycles.length;
    variation = Math.max(1, Math.round(deviation));
  }

  return {
    cycleLength,
    periodLength,
    variation,
    cycleCount: recentCycles.length,
    periodCount: recentPeriods.length,
    shortestCycle: recentCycles.length ? Math.min(...recentCycles) : null,
    longestCycle: recentCycles.length ? Math.max(...recentCycles) : null
  };
}

export function predictPeriods(periods, stats, today, count) {
  const last = sortPeriods(periods).pop();
  if (!last) return [];

  const length = Math.max(1, Math.min(stats.periodLength, stats.cycleLength - 1));
  let start = addDays(last.start, stats.cycleLength);
  // When late, the next period could come any day, so anchor on today
  // (tomorrow if a period is still marked as ongoing today).
  const earliest = last.end && last.end < today ? today : addDays(today, 1);
  if (start < earliest) start = earliest;

  const predictions = [];
  for (let i = 0; i < count; i++) {
    predictions.push({ start, end: addDays(start, length - 1) });
    start = addDays(start, stats.cycleLength);
  }
  return predictions;
}

// Everything the Today screen needs.
export function getStatus(periods, settings, today) {
  const sorted = sortPeriods(periods);
  const stats = computeStats(sorted, settings);
  const last = sorted[sorted.length - 1];
  if (!last) return { phase: "empty", stats, predictions: [] };

  const cycleDay = diffDays(last.start, today) + 1;
  const base = {
    stats,
    last,
    cycleDay,
    nextStart: addDays(last.start, stats.cycleLength),
    predictions: predictPeriods(sorted, stats, today, 3)
  };

  if (!last.end) {
    return {
      ...base,
      phase: "period",
      periodDay: cycleDay,
      expectedEnd: addDays(last.start, stats.periodLength - 1),
      stale: cycleDay > Math.max(STALE_OPEN_DAYS, stats.periodLength * 2)
    };
  }

  const daysUntil = diffDays(today, base.nextStart);
  if (daysUntil < 0) return { ...base, phase: "late", daysLate: -daysUntil };
  return { ...base, phase: "waiting", daysUntil };
}

export function findPeriodOn(periods, day, today) {
  return periods.find(p => p.start <= day && day <= (p.end || today)) || null;
}

// Returns an error message, or null when the period can be saved.
export function validatePeriod(candidate, periods, today) {
  const { start, end } = candidate;
  if (!isValidKey(start)) return "Choose a start date.";
  if (start > today) return "A period can't start in the future.";
  if (end !== null) {
    if (!isValidKey(end)) return "Choose an end date.";
    if (end < start) return "The end date must be on or after the start date.";
    if (end > today) return "The end date can't be in the future.";
  }

  const others = periods.filter(p => p.id !== candidate.id);
  if (end === null && others.some(p => p.start > start)) {
    return "Only your most recent period can be ongoing. Add an end date.";
  }
  const candidateEnd = end || today;
  for (const other of others) {
    const otherEnd = other.end || today;
    if (start <= otherEnd && other.start <= candidateEnd) {
      return `This overlaps the period ${formatRange(other.start, otherEnd)}.`;
    }
  }
  return null;
}

// Maps each day to "period" (logged) or "predicted" for the calendar.
export function buildDayMap(periods, settings, today, predictionCount = 13) {
  const map = new Map();
  const fill = (start, end, kind) => {
    for (let day = start; day <= end; day = addDays(day, 1)) {
      if (!map.has(day)) map.set(day, kind);
    }
  };

  for (const p of periods) fill(p.start, p.end || today, "period");

  const status = getStatus(periods, settings, today);
  if (status.phase === "period" && !status.stale && status.expectedEnd > today) {
    fill(addDays(today, 1), status.expectedEnd, "predicted");
  }
  for (const p of predictPeriods(periods, status.stats, today, predictionCount)) {
    fill(p.start, p.end, "predicted");
  }
  return map;
}
