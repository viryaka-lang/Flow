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
