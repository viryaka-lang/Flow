// Persistence: one small JSON document in localStorage, kept on this device.
import { DEFAULT_SETTINGS, sortPeriods } from "./cycle.js";
import { addDays, diffDays, isValidKey, todayKey } from "./dates.js";

const STORAGE_KEY = "flow.v2";

export function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeSettings(settings = {}) {
  return {
    cycleLength: clampInt(settings.cycleLength, 15, 90, DEFAULT_SETTINGS.cycleLength),
    periodLength: clampInt(settings.periodLength, 1, 15, DEFAULT_SETTINGS.periodLength)
  };
}

// Drops anything malformed or overlapping, so an edited backup file can't
// break predictions.
export function normalizePeriods(periods) {
  const today = todayKey();
  const valid = (Array.isArray(periods) ? periods : [])
    .filter(p => p && isValidKey(p.start) && p.start <= today)
    .map(p => ({
      id: typeof p.id === "string" && p.id ? p.id : newId(),
      start: p.start,
      end: isValidKey(p.end) && p.end >= p.start ? (p.end > today ? today : p.end) : null
    }));

  const result = [];
  for (const p of sortPeriods(valid)) {
    const prev = result[result.length - 1];
    // Only the latest period may be open; close earlier ones the day before the next.
    if (prev && !prev.end && p.start > prev.start) prev.end = addDays(p.start, -1);
    if (prev && p.start <= (prev.end || today)) continue;
    result.push(p);
  }
  return result;
}

export function emptyState() {
  return { version: 2, periods: [], settings: { ...DEFAULT_SETTINGS } };
}

// Returns null when nothing has been saved yet.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { version: 2, periods: normalizePeriods(parsed.periods), settings: normalizeSettings(parsed.settings) };
  } catch (err) {
    console.warn("[Flow] Could not read saved data:", err);
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  return {
    app: "flow",
    version: 2,
    exportedAt: new Date().toISOString(),
    periods: state.periods.map(({ start, end }) => ({ start, end })),
    settings: state.settings
  };
}

// Accepts a Flow backup or a backup from the old FlowSync version.
export function importState(json) {
  if (json && Array.isArray(json.periods)) {
    return { version: 2, periods: normalizePeriods(json.periods), settings: normalizeSettings(json.settings) };
  }
  if (json && Array.isArray(json.profiles)) {
    const legacy = extractLegacy({
      profiles: json.profiles,
      cycles: json.cycles || [],
      dailyLogs: json.dailyLogs || [],
      settings: json.settings ? [json.settings] : []
    });
    if (legacy) return legacy;
  }
  throw new Error("This file isn't a Flow backup.");
}

// --- Migration from the old FlowSync app (IndexedDB "flowsync_pwa_db") ---

// FlowSync inserted these demo profiles on first launch; their data isn't real.
const DEMO_PROFILE_IDS = new Set(["prof_sarah_regular", "prof_elena_ttc", "prof_maya_irregular"]);
const DEMO_CYCLE_ID = /^cyc_(sarah_\d+|elena_curr|maya_curr)$/;

// Turns the active FlowSync profile's logs into { start, end } periods.
// Returns null when there is nothing real to import.
export function extractLegacy({ profiles = [], cycles = [], dailyLogs = [], settings = [] }) {
  const global = settings.find(s => s && s.id === "global") || {};
  const profile = profiles.find(p => p.id === global.activeProfileId) || profiles[0];
  if (!profile) return null;

  // On a demo profile, only keep what the user changed after it was created.
  const isDemo = DEMO_PROFILE_IDS.has(profile.id);
  const seededAt = Date.parse(profile.createdAt) || 0;
  const editedByUser = log => !isDemo || (Date.parse(log.updatedAt) || 0) > seededAt + 2 * 60 * 1000;

  const today = todayKey();
  const days = new Set();
  let hadFutureDays = false;
  const addDay = day => {
    if (!isValidKey(day)) return;
    if (day > today) hadFutureDays = true;
    else days.add(day);
  };

  for (const log of dailyLogs) {
    if (log.profileId === profile.id && log.flow && log.flow !== "none" && editedByUser(log)) addDay(log.date);
  }
  for (const cycle of cycles) {
    if (cycle.profileId !== profile.id || DEMO_CYCLE_ID.test(cycle.id) || !isValidKey(cycle.startDate)) continue;
    const length = clampInt(cycle.periodLength, 1, 15, 5);
    for (let i = 0; i < length; i++) addDay(addDays(cycle.startDate, i));
  }
  if (!days.size) return null;

  // Group bleeding days into periods, allowing a single unlogged day inside one.
  const periods = [];
  for (const day of [...days].sort()) {
    const current = periods[periods.length - 1];
    if (current && diffDays(current.end, day) <= 2) current.end = day;
    else periods.push({ id: newId(), start: day, end: day });
  }
  // FlowSync pre-filled days ahead of today; that period is still going.
  const last = periods[periods.length - 1];
  if (hadFutureDays && last.end === today) last.end = null;

  return {
    version: 2,
    periods: normalizePeriods(periods),
    settings: isDemo ? { ...DEFAULT_SETTINGS } : normalizeSettings({
      cycleLength: profile.avgCycleLength,
      periodLength: profile.avgPeriodLength
    })
  };
}

function readLegacyDatabase() {
  return new Promise(resolve => {
    if (!("indexedDB" in window)) return resolve(null);
    let request;
    try {
      request = indexedDB.open("flowsync_pwa_db");
    } catch {
      return resolve(null);
    }
    // The old database doesn't exist: cancel instead of creating an empty one.
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const stores = ["profiles", "cycles", "dailyLogs", "settings"].filter(n => db.objectStoreNames.contains(n));
      if (!stores.length) {
        db.close();
        return resolve(null);
      }
      const out = {};
      const tx = db.transaction(stores, "readonly");
      for (const name of stores) {
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => { out[name] = req.result; };
      }
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => { db.close(); resolve(null); };
    };
  });
}

function readLegacyLocalStorage() {
  try {
    const read = key => JSON.parse(localStorage.getItem(`flowsync_${key}`) || "null");
    const profiles = read("profiles");
    if (!Array.isArray(profiles) || !profiles.length) return null;
    const settings = read("settings");
    return { profiles, cycles: read("cycles") || [], dailyLogs: read("dailyLogs") || [], settings: settings ? [settings] : [] };
  } catch {
    return null;
  }
}

// The old data is only read, never deleted.
export async function migrateLegacy() {
  try {
    const legacy = (await readLegacyDatabase()) || readLegacyLocalStorage();
    return legacy ? extractLegacy(legacy) : null;
  } catch (err) {
    console.warn("[Flow] Could not import FlowSync data:", err);
    return null;
  }
}
