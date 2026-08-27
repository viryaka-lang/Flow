// FlowSync Main Application Coordinator & Router
import { db } from "./db.js";
import { Icons } from "./icons.js";
import { CycleEngine } from "./engine.js";
import { DashboardView } from "./ui/dashboard.js";
import { CalendarView } from "./ui/calendar.js";
import { LoggerSheet } from "./ui/logger.js";
import { AnalyticsView } from "./ui/analytics.js";
import { ProfilesView } from "./ui/profiles.js";
import { DoctorReportModal } from "./ui/reports.js";
import { SettingsView } from "./ui/settings.js";
import { PWAController } from "./ui/pwa.js";

export class FlowApp {
  constructor() {
    this.db = db;
    this.profiles = [];
    this.activeProfile = {
      id: "prof_default",
      name: "Sarah Miller",
      avatar: "🌸",
      color: "#FF5E7E",
      age: 27,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      lutealPhaseLength: 14,
      goal: "track",
      birthControl: "None"
    };
    this.cycles = [];
    this.dailyLogs = [];
    this.settings = {
      id: "global",
      theme: "rose",
      tempUnit: "C",
      stealthMode: false
    };
    this.currentTab = "dashboard";
    this.stealthMode = false;

    // PIN lock state
    this.isPinLocked = false;
    this.enteredPin = "";

    // Sub-views
    this.pwaController = PWAController;
    this.dashboardView = new DashboardView(this);
    this.calendarView = new CalendarView(this);
    this.loggerSheet = new LoggerSheet(this);
    this.analyticsView = new AnalyticsView(this);
    this.profilesView = new ProfilesView(this);
    this.doctorReport = new DoctorReportModal(this);
    this.settingsView = new SettingsView(this);
  }

  async init() {
    console.log("[FlowSync] Initializing PWA App...");
    try {
      this.pwaController.init();
      // Render initial view immediately so user never sees a blank screen
      this.render();

      await this.db.init();
      await this.loadData();

      // Check PIN Lock
      if (this.settings.pinCode) {
        this.isPinLocked = true;
      }

      // Set theme
      if (this.settings.theme) {
        document.body.setAttribute("data-theme", this.settings.theme);
      }
      this.stealthMode = !!this.settings.stealthMode;

      this.render();
      this.setupListeners();
      console.log("[FlowSync] Ready with active profile:", this.activeProfile?.name);
    } catch (err) {
      console.error("[FlowSync] Initialization error:", err);
      // Fallback render
      this.render();
    }
  }

  async loadData() {
    try {
      this.settings = await this.db.getSettings();
      this.profiles = await this.db.getProfiles();

      if (this.profiles && this.profiles.length > 0) {
        const activeId = this.settings.activeProfileId || this.profiles[0].id;
        this.activeProfile = this.profiles.find(p => p.id === activeId) || this.profiles[0];
        this.cycles = await this.db.getCycles(this.activeProfile.id);
        this.dailyLogs = await this.db.getDailyLogs(this.activeProfile.id);
      }
    } catch (err) {
      console.warn("[FlowSync] Data load warning:", err);
    }
  }

  async setActiveProfile(profileId) {
    this.settings.activeProfileId = profileId;
    await this.db.saveSettings(this.settings);
    await this.loadData();
    this.render();
  }

  navigate(tab) {
    this.currentTab = tab;
    this.render();
    this.pwaController.vibrate([15]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  openLogger(dateStr = null) {
    const targetDate = dateStr || CycleEngine.toDateStr(new Date());
    this.loggerSheet.open(targetDate);
  }

  openProfileModal(profile = null) {
    this.profilesView.openProfileModal(profile);
  }

  openDoctorReport() {
    this.doctorReport.open();
  }

  async setPeriodStartDate(dateStr) {
    if (!this.activeProfile) return;
    
    // Find if a cycle exists on or near this date
    let existingCycle = this.cycles.find(c => c.startDate === dateStr);
    if (!existingCycle) {
      const latestCycle = CycleEngine.getActiveCycle(this.cycles);
      if (latestCycle && !latestCycle.endDate && Math.abs(CycleEngine.diffDays(latestCycle.startDate, dateStr)) < 20) {
        latestCycle.startDate = dateStr;
        await this.db.saveCycle(latestCycle);
      } else {
        const newCycle = {
          profileId: this.activeProfile.id,
          startDate: dateStr,
          endDate: null,
          periodLength: this.activeProfile.avgPeriodLength || 5,
          notes: "Period start date"
        };
        await this.db.saveCycle(newCycle);
      }
    }

    // Mark period flow in dailyLogs
    let log = await this.db.getDailyLog(this.activeProfile.id, dateStr);
    if (!log) {
      log = {
        profileId: this.activeProfile.id,
        date: dateStr,
        flow: "medium",
        symptoms: [],
        moods: [],
        water: 0
      };
    } else {
      log.flow = "medium";
    }
    await this.db.saveDailyLog(log);

    // Auto populate remaining period days if not logged
    const periodDays = this.activeProfile.avgPeriodLength || 5;
    for (let i = 1; i < periodDays; i++) {
      const nextDate = CycleEngine.toDateStr(CycleEngine.addDays(CycleEngine.parseDate(dateStr), i));
      let nextLog = await this.db.getDailyLog(this.activeProfile.id, nextDate);
      if (!nextLog || !nextLog.flow || nextLog.flow === "none") {
        const flowLvl = (i < 3) ? "medium" : "light";
        await this.db.saveDailyLog({
          profileId: this.activeProfile.id,
          date: nextDate,
          flow: flowLvl,
          symptoms: nextLog?.symptoms || [],
          moods: nextLog?.moods || [],
          water: nextLog?.water || 0
        });
      }
    }

    await this.loadData();
    this.render();
    this.pwaController.vibrate([25, 50, 25]);
    this.pwaController.showToast(`Period start date updated to ${dateStr}!`);
  }

  
  openPeriodStartModal(defaultDate = null) {
    const targetDate = defaultDate || CycleEngine.toDateStr(new Date());
    const modal = document.getElementById("period-start-modal");
    if (!modal) return;

    modal.innerHTML = `
      <div class="bottom-sheet-content">
        <div class="sheet-handle"></div>
        <div class="p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-10 text-white">
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">🩸</span>
              <h2 class="text-base font-extrabold">Set Period Start Date</h2>
            </div>
            <button onclick="document.getElementById('period-start-modal').classList.remove('open')" class="p-1 rounded-full text-slate-400">
              ${Icons.x("w-5 h-5")}
            </button>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300">When did your period start?</label>
            <input id="period-start-datepicker" type="date" value="${targetDate}"
              class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold text-sm focus:border-primary outline-none" />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300">Estimated Duration (Days)</label>
            <div class="grid grid-cols-5 gap-2">
              ${[3, 4, 5, 6, 7].map(num => `
                <button type="button" onclick="document.getElementById('period-duration-input').value = ${num}; this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('bg-primary', 'text-white')); this.classList.add('bg-primary', 'text-white');"
                  class="py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold ${num === (this.activeProfile?.avgPeriodLength || 5) ? "bg-primary text-white" : "text-slate-300"}">
                  ${num} Days
                </button>
              `).join("")}
            </div>
            <input id="period-duration-input" type="hidden" value="${this.activeProfile?.avgPeriodLength || 5}" />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300">Flow Intensity</label>
            <div class="grid grid-cols-4 gap-2">
              ${["spotting", "light", "medium", "heavy"].map(f => `
                <button type="button" onclick="document.getElementById('period-flow-input').value = '${f}'; this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('bg-primary', 'text-white')); this.classList.add('bg-primary', 'text-white');"
                  class="py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold capitalize ${f === "medium" ? "bg-primary text-white" : "text-slate-300"}">
                  ${f}
                </button>
              `).join("")}
            </div>
            <input id="period-flow-input" type="hidden" value="medium" />
          </div>

          <button onclick="window.app.applyPeriodStartDateFromModal()"
            class="w-full py-3.5 rounded-xl bg-primary text-white font-extrabold text-sm shadow-xl shadow-primary/30 hover:opacity-95 transition-all mt-2">
            Confirm & Update Cycle
          </button>
        </div>
      </div>
    `;
    modal.classList.add("open");
    this.pwaController.vibrate([20]);
  }

  async applyPeriodStartDateFromModal() {
    const dateInput = document.getElementById("period-start-datepicker");
    const durInput = document.getElementById("period-duration-input");
    const flowInput = document.getElementById("period-flow-input");

    if (!dateInput || !dateInput.value) {
      alert("Please select a valid date");
      return;
    }

    const dateStr = dateInput.value;
    const duration = parseInt(durInput?.value || "5") || 5;
    const flowLevel = flowInput?.value || "medium";

    await this.savePeriodRecord(dateStr, duration, flowLevel);
    const modal = document.getElementById("period-start-modal");
    if (modal) modal.classList.remove("open");
  }

  async savePeriodRecord(dateStr, duration = 5, flowLevel = "medium") {
    if (!this.activeProfile) return;

    // Find if a cycle exists with this exact start date
    let existingCycle = this.cycles.find(c => c.startDate === dateStr);
    if (!existingCycle) {
      const latestCycle = CycleEngine.getActiveCycle(this.cycles);
      if (latestCycle && !latestCycle.endDate && Math.abs(CycleEngine.diffDays(latestCycle.startDate, dateStr)) < 22) {
        latestCycle.startDate = dateStr;
        latestCycle.periodLength = duration;
        await this.db.saveCycle(latestCycle);
      } else {
        const newCycle = {
          profileId: this.activeProfile.id,
          startDate: dateStr,
          endDate: null,
          periodLength: duration,
          notes: "Recorded period"
        };
        await this.db.saveCycle(newCycle);
      }
    }

    // Populate daily period flow
    for (let i = 0; i < duration; i++) {
      const pDate = CycleEngine.toDateStr(CycleEngine.addDays(CycleEngine.parseDate(dateStr), i));
      let log = await this.db.getDailyLog(this.activeProfile.id, pDate);
      const intensity = (i === 0) ? flowLevel : (i < 3) ? "medium" : "light";
      if (!log) {
        log = {
          profileId: this.activeProfile.id,
          date: pDate,
          flow: intensity,
          symptoms: [],
          moods: []
        };
      } else {
        log.flow = intensity;
      }
      await this.db.saveDailyLog(log);
    }

    await this.loadData();
    this.render();
    this.pwaController.vibrate([30, 50, 30]);
    this.pwaController.showToast(`Period recorded starting ${dateStr}!`);
  }

  promptChangePeriodStartDate() {
    const currentStart = this.cycles[0]?.startDate || CycleEngine.toDateStr(new Date());
    const newDate = prompt("Enter new Period Start Date (YYYY-MM-DD):", currentStart);
    if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      this.setPeriodStartDate(newDate);
    } else if (newDate) {
      alert("Invalid date format. Please use YYYY-MM-DD (e.g. 2026-08-20)");
    }
  }


  async quickLogFlow(dateStr, flowLevel) {
    if (!this.activeProfile) return;
    let log = await this.db.getDailyLog(this.activeProfile.id, dateStr);
    if (!log) {
      log = {
        profileId: this.activeProfile.id,
        date: dateStr,
        flow: flowLevel,
        symptoms: [],
        moods: [],
        water: 0
      };
    } else {
      log.flow = flowLevel;
    }
    await this.db.saveDailyLog(log);
    await this.loadData();
    this.render();
    this.pwaController.showToast(`Logged ${flowLevel} flow`);
  }

  async incrementWater(dateStr) {
    if (!this.activeProfile) return;
    let log = await this.db.getDailyLog(this.activeProfile.id, dateStr);
    if (!log) {
      log = {
        profileId: this.activeProfile.id,
        date: dateStr,
        flow: "none",
        water: 1
      };
    } else {
      log.water = (log.water || 0) + 1;
    }
    await this.db.saveDailyLog(log);
    await this.loadData();
    this.render();
    this.pwaController.showToast(`Water logged: ${log.water} glasses!`);
  }

  // --- PIN Lock Handlers ---
  enterPinDigit(digit) {
    if (this.enteredPin.length < 4) {
      this.enteredPin += digit;
      this.renderPinScreen();
      this.pwaController.vibrate([15]);

      if (this.enteredPin.length === 4) {
        setTimeout(() => this.verifyPin(), 100);
      }
    }
  }

  deletePinDigit() {
    if (this.enteredPin.length > 0) {
      this.enteredPin = this.enteredPin.slice(0, -1);
      this.renderPinScreen();
      this.pwaController.vibrate([15]);
    }
  }

  verifyPin() {
    if (this.enteredPin === this.settings.pinCode) {
      this.isPinLocked = false;
      this.enteredPin = "";
      this.pwaController.vibrate([20, 50, 20]);
      this.render();
      this.pwaController.showToast("Welcome back!");
    } else {
      this.pwaController.vibrate([100, 50, 100]);
      alert("Incorrect PIN code. Please try again.");
      this.enteredPin = "";
      this.renderPinScreen();
    }
  }

  promptPinSetup() {
    const newPin = prompt("Enter 4-digit PIN code to lock FlowSync (or leave empty to disable):");
    if (newPin === null) return;
    if (newPin === "") {
      this.settingsView.setPin(null);
    } else if (/^\d{4}$/.test(newPin)) {
      this.settingsView.setPin(newPin);
    } else {
      alert("PIN must be exactly 4 numeric digits.");
    }
  }

  renderPinScreen() {
    const pinScreen = document.getElementById("pin-lock-screen");
    if (!pinScreen) return;

    if (!this.isPinLocked) {
      pinScreen.classList.remove("active");
      pinScreen.classList.add("hidden");
      pinScreen.style.display = "none";
      return;
    }
    pinScreen.classList.remove("hidden");
    pinScreen.classList.add("active");
    pinScreen.style.display = "flex";

    pinScreen.classList.remove("hidden");
    const dots = [0, 1, 2, 3].map(i => `
      <span class="pin-digit-dot ${i < this.enteredPin.length ? "filled" : ""}"></span>
    `).join("");

    pinScreen.innerHTML = `
      <div class="flex flex-col items-center justify-center p-6 space-y-8 max-w-sm w-full">
        <div class="text-center space-y-2">
          <div class="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary mx-auto mb-2 shadow-lg shadow-primary/20">
            ${Icons.lock("w-8 h-8")}
          </div>
          <h2 class="text-xl font-extrabold text-white">FlowSync Security Lock</h2>
          <p class="text-xs text-slate-400">Enter your 4-digit PIN to access private logs</p>
        </div>

        <div class="flex items-center gap-4">
          ${dots}
        </div>

        <!-- Keypad -->
        <div class="grid grid-cols-3 gap-4 w-full max-w-[260px]">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
            <button onclick="window.app.enterPinDigit('${num}')" class="pin-key-btn">${num}</button>
          `).join("")}
          <div class="w-16 h-16"></div>
          <button onclick="window.app.enterPinDigit('0')" class="pin-key-btn">0</button>
          <button onclick="window.app.deletePinDigit()" class="pin-key-btn text-slate-400 hover:text-white">Del</button>
        </div>
      </div>
    `;
  }

  render() {
    this.renderPinScreen();
    if (this.isPinLocked) return;

    // Header Title
    const headerTitle = document.getElementById("header-app-title");
    if (headerTitle) {
      headerTitle.innerText = this.stealthMode ? "Daily Habit Planner" : "FlowSync";
    }

    // Active Profile Indicator Pill in Header
    const profAvatarHeader = document.getElementById("header-profile-avatar");
    if (profAvatarHeader && this.activeProfile) {
      profAvatarHeader.innerText = this.activeProfile.avatar || "🌸";
    }

    // View Container Content
    const viewContainer = document.getElementById("view-container");
    if (viewContainer) {
      try {
        if (this.currentTab === "dashboard") {
          viewContainer.innerHTML = this.dashboardView.render();
        } else if (this.currentTab === "calendar") {
          viewContainer.innerHTML = this.calendarView.render();
        } else if (this.currentTab === "analytics") {
          viewContainer.innerHTML = this.analyticsView.render();
        } else if (this.currentTab === "profiles") {
          viewContainer.innerHTML = this.profilesView.render();
        } else if (this.currentTab === "settings") {
          viewContainer.innerHTML = this.settingsView.render();
        }
      } catch (err) {
        console.error("[FlowSync] View render error:", err);
      }
    }

    // Update Bottom Nav active state
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      const tab = btn.getAttribute("data-tab");
      if (tab === this.currentTab) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  setupListeners() {
    // Visibility change auto-lock
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.settings.pinCode) {
        this.isPinLocked = true;
        this.enteredPin = "";
      }
    });
  }
}

// Global App instantiation with immediate execution
window.app = new FlowApp();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.app.init();
  });
} else {
  // DOM already ready, run init immediately
  window.app.init();
}
