// Persistence: one small JSON document in localStorage, kept on this device.
// Shape: { version: 3, activeProfileId, profiles: [{ id, name, settings, periods }] }
import { DEFAULT_SETTINGS, sortPeriods } from "./cycle.js";
import { addDays, diffDays, isValidKey, todayKey } from "./dates.js";

const STORAGE_KEY = "flow.v2";
export const MAX_NAME_LENGTH = 40;

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

export function cleanName(name, fallback = "Me") {
  const trimmed = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || fallback;
}

export function newProfile(name = "Me", settings = DEFAULT_SETTINGS, periods = []) {
  return { id: newId(), name: cleanName(name), settings: normalizeSettings(settings), periods: normalizePeriods(periods) };
}

export function emptyState() {
  const profile = newProfile();
  return { version: 3, activeProfileId: profile.id, profiles: [profile] };
}

// Accepts the current format and the earlier single-person one
// ({ periods, settings }), and repairs anything malformed.
export function normalizeState(raw) {
  const source = Array.isArray(raw?.profiles)
    ? raw.profiles
    : [{ name: "Me", periods: raw?.periods, settings: raw?.settings }];
  const profiles = source
    .filter(p => p && typeof p === "object")
    .map((p, i) => ({
      id: typeof p.id === "string" && p.id ? p.id : newId(),
      name: cleanName(p.name, `Person ${i + 1}`),
      settings: normalizeSettings(p.settings),
      periods: normalizePeriods(p.periods)
    }));
  if (!profiles.length) return emptyState();
  const active = profiles.find(p => p.id === raw?.activeProfileId) || profiles[0];
  return { version: 3, activeProfileId: active.id, profiles };
}

// Returns null when nothing has been saved yet.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : null;
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
    version: 3,
    exportedAt: new Date().toISOString(),
    activeProfileId: state.activeProfileId,
    profiles: state.profiles.map(p => ({
      id: p.id,
      name: p.name,
      settings: p.settings,
      periods: p.periods.map(({ start, end }) => ({ start, end }))
    }))
  };
}

// Accepts a Flow backup (any version) or a backup from the old FlowSync app.
export function importState(json) {
  if (json && (json.app === "flow" || Array.isArray(json.periods))) return normalizeState(json);
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
const DEMO_PROFILES = {
  prof_sarah_regular: "Sarah Miller",
  prof_elena_ttc: "Elena Rostova",
  prof_maya_irregular: "Maya Lin"
};
const DEMO_CYCLE_ID = /^cyc_(sarah_\d+|elena_curr|maya_curr)$/;

// Turns one FlowSync profile's logs into { start, end } periods.
function legacyPeriods(profile, cycles, dailyLogs) {
  // On a demo profile, only keep what the user changed after it was created.
  const isDemo = profile.id in DEMO_PROFILES;
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

  // Group bleeding days into periods, allowing a single unlogged day inside one.
  const periods = [];
  for (const day of [...days].sort()) {
    const current = periods[periods.length - 1];
    if (current && diffDays(current.end, day) <= 2) current.end = day;
    else periods.push({ id: newId(), start: day, end: day });
  }
  // FlowSync pre-filled days ahead of today; that period is still going.
  const last = periods[periods.length - 1];
  if (last && hadFutureDays && last.end === today) last.end = null;
  return periods;
}

// Converts FlowSync data into Flow state. Demo profiles are only kept if the
// user logged something on them. Returns null when there is nothing real.
export function extractLegacy({ profiles = [], cycles = [], dailyLogs = [], settings = [] }) {
  const global = settings.find(s => s && s.id === "global") || {};
  const imported = [];
  let activeProfileId = null;

  for (const old of profiles) {
    if (!old || typeof old.id !== "string") continue;
    const isDemo = old.id in DEMO_PROFILES;
    const periods = legacyPeriods(old, cycles, dailyLogs);
    if (isDemo && !periods.length) continue;

    // A demo profile the user logged on under its made-up name is really theirs.
    const name = isDemo && old.name === DEMO_PROFILES[old.id] ? "Me" : cleanName(old.name);
    const settings = isDemo
      ? DEFAULT_SETTINGS
      : { cycleLength: old.avgCycleLength, periodLength: old.avgPeriodLength };
    const profile = newProfile(name, settings, periods);
    imported.push(profile);
    if (old.id === global.activeProfileId) activeProfileId = profile.id;
  }

  if (!imported.length) return null;
  return { version: 3, activeProfileId: activeProfileId || imported[0].id, profiles: imported };
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
