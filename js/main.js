// Flow: log when periods start and end, and see when the next ones are due.
// Named main.js (not app.js) so an old FlowSync service worker can't serve its cached app.js.
import { addDays, diffDays, formatDate, formatMonth, formatRange, plural, todayKey } from "./dates.js";
import { buildDayMap, findPeriodOn, getStatus, periodDays, sortPeriods, validatePeriod } from "./cycle.js";
import {
  MAX_NAME_LENGTH, cleanName, emptyState, exportState, importState, loadState, migrateLegacy, newId, newProfile,
  normalizeSettings, saveState
} from "./store.js";

let data = emptyState();
let tab = "today";
let calendarMonth = todayKey().slice(0, 8) + "01";
let undoState = null;
let toastTimer = null;
let pendingDate = null; // callback for the date-picker sheet

const $ = selector => document.querySelector(selector);

const escapeHtml = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// The person whose periods are shown; everything below works on them.
const activeProfile = () => data.profiles.find(p => p.id === data.activeProfileId) || data.profiles[0];
const periodsOf = () => activeProfile().periods;
const settingsOf = () => activeProfile().settings;

function withActiveProfile(changes) {
  const id = activeProfile().id;
  return { ...data, profiles: data.profiles.map(p => (p.id === id ? { ...p, ...changes } : p)) };
}

// --- State changes -----------------------------------------------------------

// Saves a new state; undoable changes keep the previous one for the toast's Undo.
function update(next, message, undoable = true) {
  undoState = undoable ? data : null;
  data = next;
  saveState(data);
  closeSheet();
  render();
  if (message) toast(message, undoable);
}

function commit(periods, message) {
  update(withActiveProfile({ periods: sortPeriods(periods) }), message);
}

function tryCommit(candidate, periods, message) {
  const error = validatePeriod(candidate, periodsOf(), todayKey());
  if (error) return toast(error);
  commit(periods, message);
}

function startPeriod(day) {
  const today = todayKey();
  const periods = periodsOf();
  if (day > today) return toast("A period can't start in the future.");

  const existing = findPeriodOn(periods, day, today);
  if (existing) return toast(`That day is already part of the period ${formatRange(existing.start, existing.end || today)}.`);

  const sorted = sortPeriods(periods);
  const last = sorted[sorted.length - 1];

  // Earlier than the latest period: it's a past period, so ask for its end too.
  if (last && day < last.start) {
    const next = sorted.find(p => p.start > day);
    const guess = addDays(day, settingsOf().periodLength - 1);
    const end = [guess, addDays(next.start, -1), today].sort()[0];
    return openEditor({ id: null, start: day, end });
  }

  // Bleeding again a day or two after marking the end: same period continues.
  if (last && last.end && diffDays(last.end, day) <= 2) {
    return commit(periods.map(p => (p.id === last.id ? { ...p, end: null } : p)), "Continued your last period");
  }

  const period = { id: newId(), start: day, end: null };
  tryCommit(period, [...periods, period], `Period started ${formatDate(day)}`);
}

function endPeriod(periodId, day) {
  const period = periodsOf().find(p => p.id === periodId);
  if (!period) return;
  const updated = { ...period, end: day };
  tryCommit(updated, periodsOf().map(p => (p.id === periodId ? updated : p)), `Period ended ${formatDate(day)}`);
}

function moveStart(periodId, day) {
  const period = periodsOf().find(p => p.id === periodId);
  if (!period) return;
  const updated = { ...period, start: day };
  tryCommit(updated, periodsOf().map(p => (p.id === periodId ? updated : p)), `Start moved to ${formatDate(day)}`);
}

function deletePeriod(periodId) {
  commit(periodsOf().filter(p => p.id !== periodId), "Period deleted");
}

function undo() {
  if (!undoState) return;
  data = undoState;
  undoState = null;
  saveState(data);
  render();
  toast("Undone");
}

// --- Sheets (bottom dialogs) ----------------------------------------------------

function openSheet(html) {
  $("#sheet-body").innerHTML = html;
  $("#sheet").classList.add("open");
  $("#sheet").setAttribute("aria-hidden", "false");
}

function closeSheet() {
  $("#sheet").classList.remove("open");
  $("#sheet").setAttribute("aria-hidden", "true");
  pendingDate = null;
}

function sheetHeader(title, subtitle = "") {
  return `
    <div class="sheet-head">
      <div>
        <h2>${title}</h2>
        ${subtitle ? `<p class="muted">${subtitle}</p>` : ""}
      </div>
      <button class="icon-btn" data-action="close-sheet" aria-label="Close">✕</button>
    </div>`;
}

function openDatePicker({ title, value, min = "", confirmLabel, onConfirm }) {
  pendingDate = onConfirm;
  openSheet(`
    ${sheetHeader(title)}
    <label class="field">
      <span>Date</span>
      <input id="date-input" type="date" value="${value}" max="${todayKey()}" ${min ? `min="${min}"` : ""} required>
    </label>
    <button class="btn primary block" data-action="confirm-date">${confirmLabel}</button>
  `);
}

function openEditor(period) {
  const today = todayKey();
  const isNew = !period.id;
  const ongoing = !isNew && !period.end;
  openSheet(`
    ${sheetHeader(isNew ? "Add a period" : "Edit period")}
    <form id="editor" data-id="${period.id || ""}">
      <label class="field">
        <span>First day</span>
        <input name="start" type="date" value="${period.start || ""}" max="${today}" required>
      </label>
      <label class="field">
        <span>Last day</span>
        <input name="end" type="date" value="${period.end || ""}" max="${today}" ${ongoing ? "disabled" : ""}>
      </label>
      <label class="check">
        <input name="ongoing" type="checkbox" ${ongoing ? "checked" : ""}>
        <span>Still going</span>
      </label>
      <p id="editor-error" class="error" role="alert"></p>
      <button class="btn primary block" type="submit">${isNew ? "Add period" : "Save"}</button>
      ${isNew ? "" : `<button class="btn danger-text block" type="button" data-action="delete" data-id="${period.id}">Delete this period</button>`}
    </form>
  `);
}

function saveEditor(form) {
  const id = form.dataset.id || null;
  const ongoing = form.ongoing.checked;
  const candidate = { id: id || newId(), start: form.start.value, end: ongoing ? null : form.end.value || null };
  if (!ongoing && !candidate.end) return showEditorError("Choose the last day, or tick “Still going”.");

  const error = validatePeriod(candidate, periodsOf(), todayKey());
  if (error) return showEditorError(error);

  const periods = id ? periodsOf().map(p => (p.id === id ? candidate : p)) : [...periodsOf(), candidate];
  commit(periods, id ? "Period updated" : "Period added");
}

function showEditorError(message) {
  $("#editor-error").textContent = message;
}

// --- People -------------------------------------------------------------------------

function renderProfileRows() {
  return data.profiles.map(p => {
    const count = p.periods.length;
    const active = p.id === activeProfile().id;
    return `
      <li>
        <button class="row-btn" data-action="switch-profile" data-id="${p.id}" ${active ? `aria-current="true"` : ""}>
          <span>
            <strong>${escapeHtml(p.name)}</strong>
            <span class="muted">${count ? plural(count, "period") : "No periods yet"}</span>
          </span>
          <span class="muted">${active ? "Showing ✓" : "Show"}</span>
        </button>
        <button class="btn small" data-action="edit-profile" data-id="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">Edit</button>
      </li>`;
  }).join("");
}

function openProfiles() {
  openSheet(`
    ${sheetHeader("People", "Each person has their own periods and predictions.")}
    <ul class="rows people">${renderProfileRows()}</ul>
    <button class="btn block" data-action="add-profile">+ Add person</button>
  `);
}

function openProfileEditor(profile) {
  const isNew = !profile;
  openSheet(`
    ${sheetHeader(isNew ? "Add person" : "Edit person")}
    <form id="profile-form" data-id="${isNew ? "" : profile.id}">
      <label class="field">
        <span>Name</span>
        <input name="person-name" type="text" maxlength="${MAX_NAME_LENGTH}" value="${isNew ? "" : escapeHtml(profile.name)}" placeholder="e.g. Me, Mia" autocomplete="off" required>
      </label>
      <button class="btn primary block" type="submit">${isNew ? "Add person" : "Save"}</button>
      ${!isNew && data.profiles.length > 1
        ? `<button class="btn danger-text block" type="button" data-action="delete-profile" data-id="${profile.id}">Delete ${escapeHtml(profile.name)} and their periods</button>`
        : ""}
    </form>
  `);
  $("#profile-form").elements["person-name"].focus();
}

function saveProfileForm(form) {
  const input = form.elements["person-name"];
  const name = cleanName(input.value, "");
  if (!name) return input.focus();
  const id = form.dataset.id;
  if (id) {
    update({ ...data, profiles: data.profiles.map(p => (p.id === id ? { ...p, name } : p)) }, "Saved", false);
  } else {
    const profile = newProfile(name);
    update({ ...data, activeProfileId: profile.id, profiles: [...data.profiles, profile] }, `Added ${name}`, false);
  }
}

function switchProfile(id) {
  if (id === activeProfile().id) return closeSheet();
  const next = { ...data, activeProfileId: id };
  update(next, `Showing ${next.profiles.find(p => p.id === id).name}`, false);
}

function deleteProfile(id) {
  const profile = data.profiles.find(p => p.id === id);
  if (!profile || data.profiles.length < 2) return;
  if (!confirm(`Delete ${profile.name} and all their periods?`)) return;
  const profiles = data.profiles.filter(p => p.id !== id);
  const activeProfileId = id === data.activeProfileId ? profiles[0].id : data.activeProfileId;
  update({ ...data, activeProfileId, profiles }, `Deleted ${profile.name}`);
}

function openDaySheet(day) {
  const today = todayKey();
  const period = findPeriodOn(periodsOf(), day, today);
  const kind = buildDayMap(periodsOf(), settingsOf(), today).get(day);
  let body;

  if (period) {
    const end = period.end || today;
    body = `
      <p class="muted">Day ${diffDays(period.start, day) + 1} of the period ${formatRange(period.start, end)}${period.end ? "" : " (still going)"}.</p>
      <div class="stack">
        ${day !== period.start ? `<button class="btn" data-action="move-start" data-id="${period.id}" data-day="${day}">Period started this day</button>` : ""}
        ${day !== period.end ? `<button class="btn" data-action="end" data-id="${period.id}" data-day="${day}">Period ended this day</button>` : ""}
        <button class="btn" data-action="edit" data-id="${period.id}">Edit dates…</button>
        <button class="btn danger-text" data-action="delete" data-id="${period.id}">Delete this period</button>
      </div>`;
  } else if (day > today) {
    body = `<p class="muted">${kind === "predicted" ? "A period is predicted around this day." : "Nothing predicted for this day."}</p>`;
  } else {
    // A period that started shortly before this day can be extended to it.
    const before = sortPeriods(periodsOf()).filter(p => p.start < day).pop();
    const extendable = before && before.end && diffDays(before.start, day) < 15;
    body = `
      <p class="muted">No period logged on this day.</p>
      <div class="stack">
        <button class="btn primary" data-action="start" data-day="${day}">Period started this day</button>
        ${extendable ? `<button class="btn" data-action="end" data-id="${before.id}" data-day="${day}">Period ended this day <small>(extends ${formatRange(before.start, before.end)})</small></button>` : ""}
      </div>`;
  }
  openSheet(`${sheetHeader(formatDate(day))}${body}`);
}

// --- Views ------------------------------------------------------------------------

function renderToday() {
  const today = todayKey();
  const status = getStatus(periodsOf(), settingsOf(), today);
  const { stats } = status;
  const pm = stats.variation ? `<span class="pm">± ${plural(stats.variation, "day")}</span>` : "";
  // With several people, say whose data this is.
  const who = data.profiles.length > 1 ? `${escapeHtml(activeProfile().name)} · ` : "";
  let hero;

  if (status.phase === "empty") {
    hero = `
      <section class="card hero">
        <p class="eyebrow">${who}Welcome</p>
        <h1>When did your last period start?</h1>
        <p class="muted">Log it once and Flow will predict your next periods. Each period you log makes predictions more accurate.</p>
        <button class="btn primary block" data-action="start" data-day="${today}">It started today</button>
        <button class="btn block" data-action="start-other">It started on another day…</button>
      </section>`;
  } else if (status.phase === "period") {
    const endGuess = status.expectedEnd < today ? status.expectedEnd : today;
    hero = `
      <section class="card hero period">
        <p class="eyebrow">${who}On period</p>
        <h1>Day ${status.periodDay}</h1>
        <p class="muted">Started ${formatDate(status.last.start)}.
          ${status.stale
            ? ""
            : status.expectedEnd >= today
              ? `Usually lasts about ${plural(stats.periodLength, "day")}, so it may end around ${formatDate(status.expectedEnd)}.`
              : `Longer than your usual ${plural(stats.periodLength, "day")}.`}
        </p>
        ${status.stale ? `<p class="notice">Still going after ${plural(status.periodDay, "day")}? If it already ended, set the last day so your predictions stay accurate.</p>` : ""}
        <button class="btn primary block" data-action="end" data-id="${status.last.id}" data-day="${today}">Period ended today</button>
        <button class="btn block" data-action="end-other" data-id="${status.last.id}" data-day="${endGuess}">It ended on another day…</button>
      </section>`;
  } else if (status.phase === "late") {
    hero = `
      <section class="card hero late">
        <p class="eyebrow">${who}Next period</p>
        <h1>${plural(status.daysLate, "day")} late</h1>
        <p class="muted">Expected ${formatDate(status.nextStart)} · cycle day ${status.cycleDay}</p>
        <button class="btn primary block" data-action="start" data-day="${today}">Period started today</button>
        <button class="btn block" data-action="start-other">It started on another day…</button>
      </section>`;
  } else {
    hero = `
      <section class="card hero">
        <p class="eyebrow">${who}Next period</p>
        <h1>${status.daysUntil === 0 ? "Expected today" : status.daysUntil === 1 ? "Tomorrow" : `In ${status.daysUntil} days`}</h1>
        <p class="muted">${formatDate(status.nextStart)} ${pm} · cycle day ${status.cycleDay}</p>
        <button class="btn primary block" data-action="start" data-day="${today}">Period started today</button>
        <button class="btn block" data-action="start-other">It started on another day…</button>
      </section>`;
  }

  if (status.phase === "empty") return hero;

  const upcoming = status.predictions.map(p => {
    const days = diffDays(today, p.start);
    return `
      <li>
        <span>${formatRange(p.start, p.end)}</span>
        <span class="muted">${days <= 0 ? "any day now" : days === 1 ? "tomorrow" : `in ${days} days`}</span>
      </li>`;
  }).join("");

  const basis = stats.cycleCount === 0
    ? `Using a ${stats.cycleLength}-day cycle from Settings until you've logged two periods.`
    : `Based on your last ${plural(stats.cycleCount, "cycle")}.`;

  return `
    ${hero}
    <section class="card">
      <h3>Upcoming periods</h3>
      <ul class="rows">${upcoming}</ul>
      <p class="hint">${basis}${stats.variation ? ` Your cycles usually vary by about ${plural(stats.variation, "day")}.` : ""}</p>
    </section>
    <section class="card">
      <h3>Your cycle</h3>
      <div class="stats">
        <div><strong>${stats.cycleLength}</strong><span>day cycle</span></div>
        <div><strong>${stats.periodLength}</strong><span>day period</span></div>
        <div><strong>${stats.cycleCount ? `${stats.shortestCycle}–${stats.longestCycle}` : "–"}</strong><span>range (days)</span></div>
      </div>
    </section>`;
}

function renderCalendar() {
  const today = todayKey();
  const dayMap = buildDayMap(periodsOf(), settingsOf(), today);
  const first = calendarMonth;
  const [year, month] = first.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Weeks start on Monday.
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  let cells = "<span></span>".repeat(offset);
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${first.slice(0, 8)}${String(d).padStart(2, "0")}`;
    const kind = dayMap.get(day);
    const classes = ["day", kind || "", day === today ? "today" : ""].join(" ").trim();
    cells += `<button class="${classes}" data-action="day" data-day="${day}" aria-label="${formatDate(day)}${kind ? `, ${kind === "period" ? "period" : "predicted period"}` : ""}">${d}</button>`;
  }

  return `
    <section class="card">
      <div class="month-head">
        <button class="icon-btn" data-action="month" data-step="-1" aria-label="Previous month">‹</button>
        <h2>${formatMonth(first)}</h2>
        <button class="icon-btn" data-action="month" data-step="1" aria-label="Next month">›</button>
      </div>
      <div class="weekdays"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
      <div class="grid">${cells}</div>
      <div class="legend">
        <span><i class="swatch period"></i>Period</span>
        <span><i class="swatch predicted"></i>Predicted</span>
        <span><i class="swatch today"></i>Today</span>
      </div>
      ${first === today.slice(0, 8) + "01" ? "" : `<button class="btn block" data-action="month" data-step="0">Back to today</button>`}
    </section>
    <p class="hint center">Tap a day to mark when a period started or ended.</p>`;
}

function renderHistory() {
  const today = todayKey();
  const sorted = sortPeriods(periodsOf());
  const rows = sorted.map((p, i) => {
    const next = sorted[i + 1];
    const length = p.end ? plural(periodDays(p), "day") : `day ${diffDays(p.start, today) + 1}, still going`;
    const cycle = next
      ? `${diffDays(p.start, next.start)}-day cycle`
      : `current cycle, day ${diffDays(p.start, today) + 1}`;
    return `
      <li>
        <button class="row-btn" data-action="edit" data-id="${p.id}">
          <span>
            <strong>${formatRange(p.start, p.end || today)}</strong>
            <span class="muted">${length}</span>
          </span>
          <span class="muted">${cycle} ›</span>
        </button>
      </li>`;
  }).reverse().join("");

  return `
    <section class="card">
      <div class="card-head">
        <h3>Logged periods</h3>
        <button class="btn small" data-action="add">+ Add</button>
      </div>
      ${rows
        ? `<ul class="rows">${rows}</ul>`
        : `<p class="muted">No periods yet. Add your last few periods, and predictions will be personalised straight away.</p>`}
    </section>`;
}

function renderSettings() {
  const { cycleLength, periodLength } = settingsOf();
  return `
    <section class="card">
      <div class="card-head">
        <h3>People</h3>
        <button class="btn small" data-action="add-profile">+ Add</button>
      </div>
      <ul class="rows people">${renderProfileRows()}</ul>
    </section>
    <section class="card">
      <h3>Typical lengths${data.profiles.length > 1 ? ` for ${escapeHtml(activeProfile().name)}` : ""}</h3>
      <p class="hint">Used for predictions until you've logged enough periods. After that, Flow learns them from your history.</p>
      <div class="two">
        <label class="field">
          <span>Cycle length (days)</span>
          <input id="set-cycle" type="number" inputmode="numeric" min="15" max="90" value="${cycleLength}">
        </label>
        <label class="field">
          <span>Period length (days)</span>
          <input id="set-period" type="number" inputmode="numeric" min="1" max="15" value="${periodLength}">
        </label>
      </div>
    </section>
    <section class="card">
      <h3>Your data</h3>
      <p class="hint">Everything stays on this device. Export a backup now and then, or to move to a new phone.</p>
      <div class="two">
        <button class="btn" data-action="export">Export backup</button>
        <label class="btn">Import backup<input id="import-file" type="file" accept="application/json,.json" hidden></label>
      </div>
      <button class="btn danger-text block" data-action="erase">Erase all data</button>
    </section>`;
}

const views = { today: renderToday, calendar: renderCalendar, history: renderHistory, settings: renderSettings };

function render() {
  $("#view").innerHTML = views[tab]();
  $("#profile-name").textContent = activeProfile().name;
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.setAttribute("aria-current", btn.dataset.tab === tab ? "page" : "false");
  });
}

// --- Toast ------------------------------------------------------------------------

function toast(message, withUndo = false) {
  const el = $("#toast");
  el.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = message;
  el.append(text);
  if (withUndo && undoState) {
    const btn = document.createElement("button");
    btn.textContent = "Undo";
    btn.dataset.action = "undo";
    el.append(btn);
  }
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), withUndo ? 5000 : 3000);
}

// --- Events -----------------------------------------------------------------------

const actions = {
  "tab": el => { tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  "close-sheet": () => closeSheet(),
  "undo": () => { $("#toast").classList.remove("show"); undo(); },
  "start": el => startPeriod(el.dataset.day),
  "start-other": () => openDatePicker({
    title: "When did it start?",
    value: todayKey(),
    confirmLabel: "Save start date",
    onConfirm: day => startPeriod(day)
  }),
  "end": el => endPeriod(el.dataset.id, el.dataset.day),
  "end-other": el => {
    const period = periodsOf().find(p => p.id === el.dataset.id);
    openDatePicker({
      title: "When did it end?",
      value: el.dataset.day,
      min: period.start,
      confirmLabel: "Save end date",
      onConfirm: day => endPeriod(el.dataset.id, day)
    });
  },
  "move-start": el => moveStart(el.dataset.id, el.dataset.day),
  "confirm-date": () => {
    const value = $("#date-input").value;
    if (!value) return toast("Choose a date.");
    const callback = pendingDate;
    if (callback) callback(value);
  },
  "day": el => openDaySheet(el.dataset.day),
  "month": el => {
    const step = Number(el.dataset.step);
    if (step === 0) {
      calendarMonth = todayKey().slice(0, 8) + "01";
    } else {
      const [y, m] = calendarMonth.split("-").map(Number);
      const date = new Date(y, m - 1 + step, 1);
      calendarMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    }
    render();
  },
  "add": () => openEditor({ id: null, start: "", end: "" }),
  "edit": el => openEditor(periodsOf().find(p => p.id === el.dataset.id)),
  "delete": el => {
    if (confirm("Delete this period?")) deletePeriod(el.dataset.id);
  },
  "export": () => {
    const blob = new Blob([JSON.stringify(exportState(data), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `flow-backup-${todayKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  },
  "erase": () => {
    if (!confirm("Erase all people, periods and settings from this device? This can't be undone unless you have a backup.")) return;
    update(emptyState(), "All data erased", false);
  },
  "profiles": () => openProfiles(),
  "switch-profile": el => switchProfile(el.dataset.id),
  "add-profile": () => openProfileEditor(null),
  "edit-profile": el => openProfileEditor(data.profiles.find(p => p.id === el.dataset.id)),
  "delete-profile": el => deleteProfile(el.dataset.id)
};

const countPeriods = state => state.profiles.reduce((sum, p) => sum + p.periods.length, 0);

function setupEvents() {
  document.addEventListener("click", event => {
    const el = event.target.closest("[data-action]");
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
    else if (event.target.id === "sheet") closeSheet();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSheet();
  });

  document.addEventListener("submit", event => {
    event.preventDefault();
    if (event.target.id === "editor") saveEditor(event.target);
    else if (event.target.id === "profile-form") saveProfileForm(event.target);
  });

  document.addEventListener("change", async event => {
    const target = event.target;
    if (target.name === "ongoing") {
      target.form.end.disabled = target.checked;
    } else if (target.id === "set-cycle" || target.id === "set-period") {
      const settings = normalizeSettings({ cycleLength: $("#set-cycle").value, periodLength: $("#set-period").value });
      update(withActiveProfile({ settings }), "Saved", false);
    } else if (target.id === "import-file" && target.files[0]) {
      try {
        const imported = importState(JSON.parse(await target.files[0].text()));
        const summary = `${plural(imported.profiles.length, "person")} and ${plural(countPeriods(imported), "period")}`
          .replace("persons", "people");
        if (!confirm(`Replace all current data with ${summary} from this backup?`)) return;
        update(imported, "Backup imported");
      } catch (err) {
        toast(err.message.startsWith("This file") ? err.message : "That file couldn't be read.");
      } finally {
        target.value = "";
      }
    }
  });

  // Keep "today" correct when the app is reopened on a later day.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
}

async function init() {
  setupEvents();
  const saved = loadState();
  if (saved) {
    data = saved;
  } else {
    render();
    const migrated = await migrateLegacy();
    data = migrated || emptyState();
    saveState(data);
    if (migrated) toast(`Imported ${plural(countPeriods(migrated), "period")} from the previous version`);
  }
  render();

  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(err => console.warn("[Flow] Service worker:", err));
  }
}

init();
