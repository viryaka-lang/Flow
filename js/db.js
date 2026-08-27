// FlowSync Multi-Profile Storage & IndexedDB Data Layer
const DB_NAME = "flowsync_pwa_db";
const DB_VERSION = 1;

class FlowDB {
  constructor() {
    this.db = null;
    this.useFallback = false;
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported, using LocalStorage fallback");
        this.useFallback = true;
        this.ensureFallbackStorage();
        resolve(true);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("profiles")) {
          const profileStore = db.createObjectStore("profiles", { keyPath: "id" });
          profileStore.createIndex("isDefault", "isDefault", { unique: false });
        }
        if (!db.objectStoreNames.contains("cycles")) {
          const cycleStore = db.createObjectStore("cycles", { keyPath: "id" });
          cycleStore.createIndex("profileId", "profileId", { unique: false });
          cycleStore.createIndex("startDate", "startDate", { unique: false });
        }
        if (!db.objectStoreNames.contains("dailyLogs")) {
          const logStore = db.createObjectStore("dailyLogs", { keyPath: "id" });
          logStore.createIndex("profileId", "profileId", { unique: false });
          logStore.createIndex("date", "date", { unique: false });
          logStore.createIndex("profile_date", ["profileId", "date"], { unique: true });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        await this.checkAndSeedDefaultData();
        resolve(true);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        this.useFallback = true;
        this.ensureFallbackStorage();
        this.checkAndSeedDefaultData().then(() => resolve(true));
      };
    });
  }

  ensureFallbackStorage() {
    if (!localStorage.getItem("flowsync_profiles")) localStorage.setItem("flowsync_profiles", "[]");
    if (!localStorage.getItem("flowsync_cycles")) localStorage.setItem("flowsync_cycles", "[]");
    if (!localStorage.getItem("flowsync_dailyLogs")) localStorage.setItem("flowsync_dailyLogs", "[]");
    if (!localStorage.getItem("flowsync_settings")) localStorage.setItem("flowsync_settings", "{}");
  }

  // --- Generic Store Operations ---
  async getAll(storeName) {
    if (this.useFallback) {
      return JSON.parse(localStorage.getItem(`flowsync_${storeName}`) || "[]");
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getById(storeName, id) {
    if (this.useFallback) {
      const list = JSON.parse(localStorage.getItem(`flowsync_${storeName}`) || "[]");
      return list.find(item => item.id === id) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    if (this.useFallback) {
      const list = JSON.parse(localStorage.getItem(`flowsync_${storeName}`) || "[]");
      const index = list.findIndex(x => x.id === item.id);
      if (index >= 0) list[index] = item;
      else list.push(item);
      localStorage.setItem(`flowsync_${storeName}`, JSON.stringify(list));
      return item;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, id) {
    if (this.useFallback) {
      let list = JSON.parse(localStorage.getItem(`flowsync_${storeName}`) || "[]");
      list = list.filter(item => item.id !== id);
      localStorage.setItem(`flowsync_${storeName}`, JSON.stringify(list));
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Profile Operations ---
  async getProfiles() {
    return await this.getAll("profiles");
  }

  async getProfile(id) {
    return await this.getById("profiles", id);
  }

  async saveProfile(profile) {
    if (!profile.id) profile.id = "prof_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    if (!profile.createdAt) profile.createdAt = new Date().toISOString();
    return await this.put("profiles", profile);
  }

  async deleteProfile(profileId) {
    // Delete profile and cascade delete its cycles & daily logs
    await this.delete("profiles", profileId);
    
    // Clean cycles
    const cycles = await this.getAll("cycles");
    for (const c of cycles) {
      if (c.profileId === profileId) await this.delete("cycles", c.id);
    }

    // Clean logs
    const logs = await this.getAll("dailyLogs");
    for (const l of logs) {
      if (l.profileId === profileId) await this.delete("dailyLogs", l.id);
    }
    return true;
  }

  // --- Cycle Operations ---
  async getCycles(profileId) {
    const allCycles = await this.getAll("cycles");
    return allCycles
      .filter(c => c.profileId === profileId)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  }

  async saveCycle(cycle) {
    if (!cycle.id) cycle.id = "cyc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    return await this.put("cycles", cycle);
  }

  async deleteCycle(id) {
    return await this.delete("cycles", id);
  }

  // --- Daily Log Operations ---
  async getDailyLogs(profileId, startDate = null, endDate = null) {
    const allLogs = await this.getAll("dailyLogs");
    return allLogs.filter(l => {
      if (l.profileId !== profileId) return false;
      if (startDate && l.date < startDate) return false;
      if (endDate && l.date > endDate) return false;
      return true;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async getDailyLog(profileId, date) {
    const id = `${profileId}_${date}`;
    const log = await this.getById("dailyLogs", id);
    return log || null;
  }

  async saveDailyLog(log) {
    if (!log.profileId || !log.date) throw new Error("ProfileId and Date are required");
    log.id = `${log.profileId}_${log.date}`;
    log.updatedAt = new Date().toISOString();
    return await this.put("dailyLogs", log);
  }

  async deleteDailyLog(profileId, date) {
    const id = `${profileId}_${date}`;
    return await this.delete("dailyLogs", id);
  }

  // --- Settings & Preferences ---
  async getSettings() {
    let settings = await this.getById("settings", "global");
    if (!settings) {
      settings = {
        id: "global",
        activeProfileId: null,
        pinCode: null,
        pinTimeout: "immediately", // 'immediately', '1min', '5min', 'never'
        stealthMode: false,
        theme: "rose", // 'rose', 'berry', 'lavender', 'mint', 'sunset'
        isDark: true,
        tempUnit: "C", // 'C' or 'F'
        weightUnit: "kg",
        reminders: {
          periodApproaching: true,
          ovulationAlert: true,
          pillReminder: true,
          pillTime: "21:00",
          dailyCheckin: true,
          dailyCheckinTime: "20:00"
        }
      };
      await this.put("settings", settings);
    }
    return settings;
  }

  async saveSettings(settings) {
    settings.id = "global";
    return await this.put("settings", settings);
  }

  // --- Backup & Restore ---
  async exportAllData() {
    const profiles = await this.getAll("profiles");
    const cycles = await this.getAll("cycles");
    const dailyLogs = await this.getAll("dailyLogs");
    const settings = await this.getSettings();

    return {
      version: "1.0",
      exportDate: new Date().toISOString(),
      appName: "FlowSync PWA",
      profiles,
      cycles,
      dailyLogs,
      settings
    };
  }

  async importAllData(data) {
    if (!data || !data.profiles || !Array.isArray(data.profiles)) {
      throw new Error("Invalid backup data format");
    }

    // Restore profiles
    for (const p of data.profiles) await this.put("profiles", p);
    if (data.cycles && Array.isArray(data.cycles)) {
      for (const c of data.cycles) await this.put("cycles", c);
    }
    if (data.dailyLogs && Array.isArray(data.dailyLogs)) {
      for (const l of data.dailyLogs) await this.put("dailyLogs", l);
    }
    if (data.settings) {
      await this.put("settings", data.settings);
    }
    return true;
  }

  // --- Seeding Real-World Sample Data for Instant Testing ---
  async checkAndSeedDefaultData() {
    const profiles = await this.getProfiles();
    if (profiles.length === 0) {
      await this.seedSampleData();
    }
  }

  async seedSampleData() {
    console.log("Seeding rich multi-profile sample data...");

    // Helper for date formatting
    const formatDate = (d) => d.toISOString().split("T")[0];
    const addDays = (d, days) => {
      const res = new Date(d);
      res.setDate(res.getDate() + days);
      return res;
    };

    const now = new Date();
    
    // ----------------------------------------------------
    // Profile 1: Sarah Miller (Regular 28-day cycle, Cycle Tracking)
    // ----------------------------------------------------
    const sarahId = "prof_sarah_regular";
    const sarah = {
      id: sarahId,
      name: "Sarah Miller",
      avatar: "🌸",
      color: "#FF5E7E",
      age: 27,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      lutealPhaseLength: 14,
      goal: "track", // Track cycle
      birthControl: "None",
      isDefault: true,
      notes: "Regular 28-day cycle. Tracking general wellness, mood, and period health.",
      createdAt: new Date().toISOString()
    };
    await this.saveProfile(sarah);

    // Sarah's past 4 cycles (Current cycle started 12 days ago => today is Day 13)
    const sarahCycleStarts = [
      addDays(now, -12), // Cycle 1 (Current)
      addDays(now, -40), // Cycle 2 (28 days long)
      addDays(now, -68), // Cycle 3 (28 days long)
      addDays(now, -97)  // Cycle 4 (29 days long)
    ];

    for (let i = 0; i < sarahCycleStarts.length; i++) {
      const start = sarahCycleStarts[i];
      const length = (i === 3) ? 29 : 28;
      const end = (i === 0) ? null : addDays(start, length - 1);
      await this.saveCycle({
        id: `cyc_sarah_${i}`,
        profileId: sarahId,
        startDate: formatDate(start),
        endDate: end ? formatDate(end) : null,
        length: (i === 0) ? null : length,
        periodLength: 5,
        notes: i === 0 ? "Current ongoing cycle" : "Healthy regular flow"
      });

      // Populate daily period logs for these cycles
      for (let p = 0; p < 5; p++) {
        const pDate = addDays(start, p);
        if (pDate <= now) {
          const flowType = (p === 0) ? "medium" : (p === 1 || p === 2) ? "heavy" : (p === 3) ? "light" : "spotting";
          await this.saveDailyLog({
            profileId: sarahId,
            date: formatDate(pDate),
            flow: flowType,
            flowColor: "brightRed",
            symptoms: p < 2 ? [{ name: "Cramps", severity: "moderate" }, { name: "Fatigue", severity: "mild" }] : [],
            moods: p < 2 ? ["Sensitive", "Calm"] : ["Happy", "Energetic"],
            water: 8,
            sleepHours: 7.5,
            notes: p === 0 ? "Period started on time" : ""
          });
        }
      }
    }

    // Sarah's mid-cycle / today logs
    await this.saveDailyLog({
      profileId: sarahId,
      date: formatDate(addDays(now, -1)),
      flow: "none",
      symptoms: [{ name: "High Energy", severity: "mild" }],
      moods: ["Energetic", "Happy", "Frisky"],
      cervicalMucus: "eggWhite",
      water: 9,
      sleepHours: 8,
      intimacy: { protected: false, unprotected: true, highDrive: true, orgasm: true },
      notes: "Follicular peak energy, ready for ovulation window!"
    });

    await this.saveDailyLog({
      profileId: sarahId,
      date: formatDate(now),
      flow: "none",
      symptoms: [],
      moods: ["Energetic", "Frisky"],
      cervicalMucus: "eggWhite",
      water: 8,
      sleepHours: 8.2,
      notes: "Ovulation fertile peak today"
    });

    // ----------------------------------------------------
    // Profile 2: Elena Rostova (Trying to Conceive / TTC with BBT Curve)
    // ----------------------------------------------------
    const elenaId = "prof_elena_ttc";
    const elena = {
      id: elenaId,
      name: "Elena Rostova",
      avatar: "✨",
      color: "#8B5CF6",
      age: 31,
      avgCycleLength: 30,
      avgPeriodLength: 5,
      lutealPhaseLength: 14,
      goal: "ttc", // Trying to conceive
      birthControl: "None",
      isDefault: false,
      notes: "Actively tracking ovulation tests (OPK) and Basal Body Temperature (BBT) for conception.",
      createdAt: new Date().toISOString()
    };
    await this.saveProfile(elena);

    // Elena's cycle started 18 days ago => Ovulation happened ~Day 16, BBT shift is visible!
    const elenaCycleStart = addDays(now, -18);
    await this.saveCycle({
      id: "cyc_elena_curr",
      profileId: elenaId,
      startDate: formatDate(elenaCycleStart),
      endDate: null,
      periodLength: 5,
      notes: "TTC cycle with daily BBT logs"
    });

    // Populate Elena's daily BBT across cycle (Day 1..18)
    for (let day = 0; day <= 18; day++) {
      const logDate = addDays(elenaCycleStart, day);
      if (logDate > now) continue;

      // BBT curve: Follicular phase (36.35 - 36.50), Ovulation dip (36.28), Luteal shift (36.75 - 36.90)
      let bbt = 36.42;
      let opk = "negative";
      let mucus = "creamy";
      let flow = "none";
      let intim = null;

      if (day < 5) {
        flow = day === 0 ? "heavy" : day === 1 ? "heavy" : day === 2 ? "medium" : "light";
        bbt = +(36.40 + (Math.random() * 0.1 - 0.05)).toFixed(2);
      } else if (day >= 5 && day <= 13) {
        bbt = +(36.42 + (Math.random() * 0.08 - 0.04)).toFixed(2);
        mucus = day > 10 ? "watery" : "sticky";
        if (day >= 12) opk = "high";
      } else if (day === 14) {
        bbt = 36.30; // Ovulation dip
        opk = "peak";
        mucus = "eggWhite";
        intim = { unprotected: true, orgasm: true };
      } else if (day === 15) {
        bbt = 36.55; // Rise begins
        opk = "high";
        mucus = "eggWhite";
        intim = { unprotected: true };
      } else {
        // Luteal high plateau (Progesterone shift!)
        bbt = +(36.80 + (Math.random() * 0.08 - 0.04)).toFixed(2);
        mucus = "sticky";
      }

      await this.saveDailyLog({
        profileId: elenaId,
        date: formatDate(logDate),
        flow: flow,
        bbt: bbt,
        bbtTime: "06:30",
        opk: opk,
        cervicalMucus: mucus,
        moods: day >= 14 ? ["Calm", "Happy"] : ["Calm"],
        intimacy: intim,
        water: 8,
        sleepHours: 7.8,
        notes: day === 14 ? "Positive OPK surge & fertile egg-white mucus!" : ""
      });
    }

    // ----------------------------------------------------
    // Profile 3: Maya Lin (Irregular / 34-day cycle, Wellness & Symptom tracking)
    // ----------------------------------------------------
    const mayaId = "prof_maya_irregular";
    const maya = {
      id: mayaId,
      name: "Maya Lin",
      avatar: "🌿",
      color: "#10B981",
      age: 23,
      avgCycleLength: 35,
      avgPeriodLength: 4,
      lutealPhaseLength: 14,
      goal: "irregular", // Irregular tracking
      birthControl: "None",
      isDefault: false,
      notes: "Tracking irregular cycle variations, PMS symptoms, migraines and stress levels.",
      createdAt: new Date().toISOString()
    };
    await this.saveProfile(maya);

    const mayaCycleStart = addDays(now, -6);
    await this.saveCycle({
      id: "cyc_maya_curr",
      profileId: mayaId,
      startDate: formatDate(mayaCycleStart),
      endDate: null,
      periodLength: 4,
      notes: "Current cycle"
    });

    for (let p = 0; p < 4; p++) {
      const pDate = addDays(mayaCycleStart, p);
      await this.saveDailyLog({
        profileId: mayaId,
        date: formatDate(pDate),
        flow: p === 0 ? "medium" : p === 1 ? "heavy" : "light",
        symptoms: [{ name: "Headache", severity: "moderate" }, { name: "Bloating", severity: "mild" }],
        moods: ["Sensitive", "Brain Fog"],
        water: 7,
        sleepHours: 6.5
      });
    }

    // Set default active profile to Sarah Miller
    const settings = await this.getSettings();
    settings.activeProfileId = sarahId;
    await this.saveSettings(settings);

    console.log("Sample profiles and health history seeded successfully!");
  }
}

export const db = new FlowDB();