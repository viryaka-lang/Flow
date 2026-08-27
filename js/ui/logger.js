// FlowSync Full-Featured Daily Symptom & Biometric Logger
import { Icons } from "../icons.js";
import { PWAController } from "./pwa.js";

export class LoggerSheet {
  constructor(app) {
    this.app = app;
    this.activeDate = null;
    this.currentLog = {};
  }

  open(dateStr) {
    this.activeDate = dateStr;
    const existing = this.app.dailyLogs.find(l => l.date === dateStr);
    
    this.currentLog = existing ? JSON.parse(JSON.stringify(existing)) : {
      profileId: this.app.activeProfile.id,
      date: dateStr,
      flow: "none",
      flowColor: "brightRed",
      symptoms: [],
      moods: [],
      cervicalMucus: "none",
      bbt: null,
      bbtTime: "07:00",
      bbtDisturbed: false,
      opk: "none",
      hpt: "none",
      intimacy: { protected: false, unprotected: false, highDrive: false, orgasm: false },
      medications: { pillTaken: false, painkiller: false, iron: false, magnesium: false },
      water: 0,
      sleepHours: 7.5,
      notes: ""
    };

    this.render();
    const sheet = document.getElementById("logger-sheet");
    if (sheet) sheet.classList.add("open");
    PWAController.vibrate([20]);
  }

  close() {
    const sheet = document.getElementById("logger-sheet");
    if (sheet) sheet.classList.remove("open");
  }

  async save() {
    this.currentLog.profileId = this.app.activeProfile.id;
    this.currentLog.date = this.activeDate;

    // Check if period flow changed and maybe update cycle starts
    if (this.currentLog.flow && this.currentLog.flow !== "none") {
      // Flow recorded
    }

    await this.app.db.saveDailyLog(this.currentLog);
    await this.app.loadData();
    this.close();
    PWAController.showToast("Daily log saved!");
  }

  toggleSymptom(name) {
    if (!this.currentLog.symptoms) this.currentLog.symptoms = [];
    const idx = this.currentLog.symptoms.findIndex(s => (typeof s === "string" ? s : s.name) === name);
    if (idx >= 0) {
      this.currentLog.symptoms.splice(idx, 1);
    } else {
      this.currentLog.symptoms.push({ name, severity: "mild" });
    }
    this.render();
    PWAController.vibrate([15]);
  }

  toggleMood(name) {
    if (!this.currentLog.moods) this.currentLog.moods = [];
    const idx = this.currentLog.moods.indexOf(name);
    if (idx >= 0) {
      this.currentLog.moods.splice(idx, 1);
    } else {
      this.currentLog.moods.push(name);
    }
    this.render();
    PWAController.vibrate([15]);
  }

  render() {
    const sheetContent = document.getElementById("logger-sheet-body");
    if (!sheetContent) return;

    const symptomsList = [
      "Cramps", "Bloating", "Headache", "Acne", "Breast Tenderness",
      "Backache", "Fatigue", "Nausea", "Cravings", "Insomnia",
      "Hot Flashes", "Joint Pain", "Chills", "Dizziness", "Constipation", "Diarrhea"
    ];

    const moodsList = [
      "Happy", "Energetic", "Calm", "Frisky / High Libido",
      "Sensitive", "Irritable", "Anxious", "Sad", "Brain Fog", "Stressed"
    ];

    const isSymptomActive = (name) => {
      return (this.currentLog.symptoms || []).some(s => (typeof s === "string" ? s : s.name) === name);
    };

    const isMoodActive = (name) => {
      return (this.currentLog.moods || []).includes(name);
    };

    sheetContent.innerHTML = `
      <div class="p-4 space-y-6 pb-20">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 class="text-base font-extrabold text-white">Daily Log Check-in</h2>
            <p class="text-xs text-primary font-bold">${this.activeDate}</p>
          </div>
          <button onclick="window.app.loggerSheet.close()" class="p-1.5 rounded-full hover:bg-white/10 text-slate-400">
            ${Icons.x("w-5 h-5")}
          </button>
        </div>

        <!-- 1. Menstrual Flow -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            ${Icons.droplet("w-4 h-4 text-primary")}
            <span>Period Flow Intensity</span>
          </label>
          
          <div class="grid grid-cols-5 gap-1.5">
            ${["none", "spotting", "light", "medium", "heavy"].map(f => `
              <button onclick="window.app.loggerSheet.currentLog.flow = '${f}'; window.app.loggerSheet.render();"
                class="py-2.5 px-1 rounded-xl text-xs font-bold capitalize transition-all text-center border ${
                  this.currentLog.flow === f 
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/30" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }">
                ${f === "none" ? "None" : f === "spotting" ? "Spot" : f}
              </button>
            `).join("")}
          </div>
        </div>

        <!-- 2. Physical Symptoms -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            ${Icons.activity("w-4 h-4 text-amber-400")}
            <span>Physical Symptoms</span>
          </label>

          <div class="flex flex-wrap gap-1.5">
            ${symptomsList.map(sym => `
              <button onclick="window.app.loggerSheet.toggleSymptom('${sym}')"
                class="tag-chip ${isSymptomActive(sym) ? "active" : ""}">
                ${sym}
              </button>
            `).join("")}
          </div>
        </div>

        <!-- 3. Moods & Emotions -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            ${Icons.sparkles("w-4 h-4 text-purple-400")}
            <span>Mood & Emotions</span>
          </label>

          <div class="flex flex-wrap gap-1.5">
            ${moodsList.map(m => `
              <button onclick="window.app.loggerSheet.toggleMood('${m}')"
                class="tag-chip ${isMoodActive(m) ? "active" : ""}">
                ${m}
              </button>
            `).join("")}
          </div>
        </div>

        <!-- 4. Basal Body Temperature (BBT) & Cervical Mucus -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300 flex items-center gap-1">
              ${Icons.thermometer("w-4 h-4 text-cyan-400")}
              <span>BBT (°${this.app.settings.tempUnit || "C"})</span>
            </label>
            <input type="number" step="0.01" placeholder="36.50" 
              value="${this.currentLog.bbt || ""}"
              oninput="window.app.loggerSheet.currentLog.bbt = this.value ? parseFloat(this.value) : null"
              class="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white font-bold text-sm focus:border-primary outline-none" />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300 flex items-center gap-1">
              <span>💧 Fluid / Mucus</span>
            </label>
            <select onchange="window.app.loggerSheet.currentLog.cervicalMucus = this.value"
              class="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:border-primary outline-none">
              <option value="none" ${this.currentLog.cervicalMucus === "none" ? "selected" : ""}>None / Dry</option>
              <option value="sticky" ${this.currentLog.cervicalMucus === "sticky" ? "selected" : ""}>Sticky</option>
              <option value="creamy" ${this.currentLog.cervicalMucus === "creamy" ? "selected" : ""}>Creamy</option>
              <option value="watery" ${this.currentLog.cervicalMucus === "watery" ? "selected" : ""}>Watery</option>
              <option value="eggWhite" ${this.currentLog.cervicalMucus === "eggWhite" ? "selected" : ""}>Egg-White (Fertile)</option>
            </select>
          </div>
        </div>

        <!-- 5. Ovulation (OPK) & Pregnancy (HPT) Tests -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300">Ovulation Test (OPK)</label>
            <select onchange="window.app.loggerSheet.currentLog.opk = this.value"
              class="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:border-primary outline-none">
              <option value="none" ${this.currentLog.opk === "none" ? "selected" : ""}>Not Tested</option>
              <option value="negative" ${this.currentLog.opk === "negative" ? "selected" : ""}>Negative</option>
              <option value="low" ${this.currentLog.opk === "low" ? "selected" : ""}>Low</option>
              <option value="high" ${this.currentLog.opk === "high" ? "selected" : ""}>High</option>
              <option value="peak" ${this.currentLog.opk === "peak" ? "selected" : ""}>Peak Surge (⭐)</option>
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300">Pregnancy Test (HPT)</label>
            <select onchange="window.app.loggerSheet.currentLog.hpt = this.value"
              class="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:border-primary outline-none">
              <option value="none" ${this.currentLog.hpt === "none" ? "selected" : ""}>Not Tested</option>
              <option value="negative" ${this.currentLog.hpt === "negative" ? "selected" : ""}>Negative</option>
              <option value="faint" ${this.currentLog.hpt === "faint" ? "selected" : ""}>Faint Positive</option>
              <option value="positive" ${this.currentLog.hpt === "positive" ? "selected" : ""}>Positive (+)</option>
            </select>
          </div>
        </div>

        <!-- 6. Water Hydration Counter & Sleep -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
            <span class="text-xs font-bold text-slate-300 flex items-center gap-1">💧 Water Intake</span>
            <div class="flex items-center justify-between">
              <button onclick="window.app.loggerSheet.currentLog.water = Math.max(0, (window.app.loggerSheet.currentLog.water || 0) - 1); window.app.loggerSheet.render();"
                class="w-8 h-8 rounded-full bg-white/10 font-bold text-white flex items-center justify-center">-</button>
              <span class="text-base font-extrabold text-cyan-400">${this.currentLog.water || 0} glasses</span>
              <button onclick="window.app.loggerSheet.currentLog.water = (window.app.loggerSheet.currentLog.water || 0) + 1; window.app.loggerSheet.render();"
                class="w-8 h-8 rounded-full bg-cyan-500 text-white font-bold flex items-center justify-center">+</button>
            </div>
          </div>

          <div class="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
            <span class="text-xs font-bold text-slate-300 flex items-center gap-1">😴 Sleep Hours</span>
            <div class="flex items-center gap-2">
              <input type="range" min="3" max="12" step="0.5" value="${this.currentLog.sleepHours || 7.5}"
                oninput="window.app.loggerSheet.currentLog.sleepHours = parseFloat(this.value); document.getElementById('sleep-val').innerText = this.value + 'h';"
                class="w-full accent-primary" />
              <span id="sleep-val" class="text-xs font-bold text-white w-10">${this.currentLog.sleepHours || 7.5}h</span>
            </div>
          </div>
        </div>

        <!-- 7. Personal Journal & Notes -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-slate-300 flex items-center gap-1">
            ${Icons.fileText("w-4 h-4 text-slate-400")}
            <span>Personal Journal Notes</span>
          </label>
          <textarea rows="2" placeholder="Write any personal notes, spotting details, or symptoms..."
            oninput="window.app.loggerSheet.currentLog.notes = this.value"
            class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-primary outline-none resize-none">${this.currentLog.notes || ""}</textarea>
        </div>

        <!-- Save Button Fixed in Bottom Sheet -->
        <button onclick="window.app.loggerSheet.save()"
          class="w-full py-3.5 rounded-xl bg-primary text-white font-extrabold text-sm shadow-xl shadow-primary/30 hover:opacity-95 transition-all">
          Save Daily Check-in
        </button>

      </div>
    `;
  }
}
