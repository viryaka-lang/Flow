// Calendar-date helpers. Every date in the app is a local "YYYY-MM-DD" key,
// which sorts correctly as a plain string and has no time-zone surprises.

const DAY_MS = 24 * 60 * 60 * 1000;

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

export function isValidKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toKey(parseKey(value)) === value;
}

export function addDays(key, days) {
  const date = parseKey(key);
  date.setDate(date.getDate() + days);
  return toKey(date);
}

// Whole days from `from` to `to` (positive when `to` is later).
export function diffDays(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

// "Mon 22 Sep"
export function formatDate(key) {
  return weekdayFmt.format(parseKey(key));
}

// "22 Sep", or "22 Sep 2025" outside the current year
export function formatDay(key) {
  const date = parseKey(key);
  return (date.getFullYear() === new Date().getFullYear() ? dayFmt : dayYearFmt).format(date);
}

export function formatRange(start, end) {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
}

export function formatMonth(key) {
  return monthFmt.format(parseKey(key));
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
