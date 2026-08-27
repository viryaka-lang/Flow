// FlowSync Settings, Privacy PIN Lock, Themes & Data Backup
import { Icons } from "../icons.js";
import { PWAController } from "./pwa.js";

export class SettingsView {
  constructor(app) {
    this.app = app;
  }

  async setTheme(themeName) {
    this.app.settings.theme = themeName;
    document.body.setAttribute("data-theme", themeName);
    await this.app.db.saveSettings(this.app.settings);
    this.app.render();
    PWAController.showToast(`Theme updated to ${themeName}`);
  }

  async toggleStealthMode() {
    this.app.stealthMode = !this.app.stealthMode;
    this.app.settings.stealthMode = this.app.stealthMode;
    await this.app.db.saveSettings(this.app.settings);
    this.app.render();
    PWAController.showToast(this.app.stealthMode ? "Stealth Disguise Mode Enabled" : "Standard Mode Restored");
  }

  async setPin(pinCode) {
    this.app.settings.pinCode = pinCode;
    await this.app.db.saveSettings(this.app.settings);
    this.app.render();
    PWAController.showToast(pinCode ? "4-Digit PIN Lock Enabled" : "PIN Lock Disabled");
  }

  async setTempUnit(unit) {
    this.app.settings.tempUnit = unit;
    await this.app.db.saveSettings(this.app.settings);
    this.app.render();
    PWAController.showToast(`Temperature unit set to °${unit}`);
  }

  async exportData() {
    const data = await this.app.db.exportAllData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `flowsync_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    PWAController.showToast("Backup exported successfully!");
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        await this.app.db.importAllData(json);
        await this.app.loadData();
        PWAController.showToast("Backup restored successfully!");
      } catch (err) {
        alert("Failed to parse backup JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  render() {
    const s = this.app.settings;
    const themes = [
      { id: "rose", name: "Rose Bliss", color: "#FF5E7E" },
      { id: "berry", name: "Berry Noir", color: "#E11D48" },
      { id: "lavender", name: "Lavender Calm", color: "#8B5CF6" },
      { id: "mint", name: "Mint Oasis", color: "#10B981" },
      { id: "sunset", name: "Sunset Peach", color: "#F97316" }
    ];

    return `
      <div class="p-4 space-y-4 animate-fade-in pb-24">
        
        <div>
          <h2 class="text-lg font-extrabold text-white">App Preferences & Privacy</h2>
          <p class="text-xs text-slate-400">Security, themes, and personal data</p>
        </div>

        <!-- 1. Privacy & PIN Lock -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            ${Icons.shield("w-4 h-4 text-emerald-400")}
            <span>Privacy & Security Lock</span>
          </h3>

          <div class="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <span class="text-xs font-semibold text-slate-200 block">4-Digit PIN Lock</span>
              <span class="text-[11px] text-slate-400">Require PIN code on app resume</span>
            </div>

            <button onclick="window.app.promptPinSetup()" class="px-3 py-1.5 rounded-full text-xs font-bold ${s.pinCode ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 border border-white/10 text-slate-300"}">
              ${s.pinCode ? "Locked (Change/Disable)" : "Set PIN Code"}
            </button>
          </div>

          <!-- Stealth Disguise Mode -->
          <div class="flex items-center justify-between py-2">
            <div>
              <span class="text-xs font-semibold text-slate-200 block">Stealth Disguise Mode</span>
              <span class="text-[11px] text-slate-400">Disguise period labels as "Wellness & Habit Steps"</span>
            </div>

            <button onclick="window.app.settingsView.toggleStealthMode()" class="px-3 py-1.5 rounded-full text-xs font-bold ${this.app.stealthMode ? "bg-primary text-white" : "bg-white/5 text-slate-400 border border-white/10"}">
              ${this.app.stealthMode ? "Active" : "Off"}
            </button>
          </div>
        </div>

        <!-- 2. Aesthetic Theme Presets -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            ${Icons.sparkles("w-4 h-4 text-purple-400")}
            <span>Color Palette & Themes</span>
          </h3>

          <div class="grid grid-cols-5 gap-2 pt-1">
            ${themes.map(th => `
              <button onclick="window.app.settingsView.setTheme('${th.id}')"
                class="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${s.theme === th.id ? "bg-white/10 border-white" : "bg-white/5 border-transparent hover:bg-white/10"}">
                <span class="w-6 h-6 rounded-full shadow" style="background-color: ${th.color};"></span>
                <span class="text-[10px] font-bold text-slate-300 truncate w-full text-center">${th.name.split(" ")[0]}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <!-- 3. Units & Biometrics -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            ${Icons.thermometer("w-4 h-4 text-cyan-400")}
            <span>Units & Measurements</span>
          </h3>

          <div class="flex items-center justify-between py-1">
            <span class="text-xs text-slate-300 font-medium">Temperature Unit (BBT)</span>
            <div class="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button onclick="window.app.settingsView.setTempUnit('C')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${s.tempUnit === "C" ? "bg-primary text-white" : "text-slate-400"}">°C</button>
              <button onclick="window.app.settingsView.setTempUnit('F')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${s.tempUnit === "F" ? "bg-primary text-white" : "text-slate-400"}">°F</button>
            </div>
          </div>
        </div>

        <!-- 4. Reminders & Alerts -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            ${Icons.bell("w-4 h-4 text-amber-400")}
            <span>Reminders & Notifications</span>
          </h3>

          <div class="space-y-2 text-xs">
            <label class="flex items-center justify-between py-1 border-b border-white/5">
              <span class="text-slate-300">Period Approaching Alert (2 days before)</span>
              <input type="checkbox" checked class="accent-primary w-4 h-4" />
            </label>

            <label class="flex items-center justify-between py-1 border-b border-white/5">
              <span class="text-slate-300">Ovulation & Fertile Window Alert</span>
              <input type="checkbox" checked class="accent-primary w-4 h-4" />
            </label>

            <label class="flex items-center justify-between py-1 border-b border-white/5">
              <span class="text-slate-300">Daily Birth Control Pill Reminder</span>
              <input type="checkbox" checked class="accent-primary w-4 h-4" />
            </label>

            <label class="flex items-center justify-between py-1">
              <span class="text-slate-300">Evening Wellness Check-in</span>
              <input type="checkbox" checked class="accent-primary w-4 h-4" />
            </label>
          </div>
        </div>

        <!-- 5. Data Backup & Restore -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            ${Icons.download("w-4 h-4 text-pink-400")}
            <span>Data Backup & Restore</span>
          </h3>
          <p class="text-xs text-slate-400">All your data is saved locally on your device. Export a JSON backup to keep safe copies.</p>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button onclick="window.app.settingsView.exportData()" class="py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5">
              ${Icons.download("w-4 h-4 text-emerald-400")}
              <span>Export JSON</span>
            </button>

            <label class="py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer">
              ${Icons.upload("w-4 h-4 text-cyan-400")}
              <span>Restore JSON</span>
              <input type="file" accept=".json" onchange="window.app.settingsView.importData(event)" class="hidden" />
            </label>
          </div>
        </div>

        <!-- About Info -->
        <div class="text-center text-[11px] text-slate-500 pt-2 space-y-1">
          <p><strong>FlowSync PWA v1.0.0</strong> • Privacy-first Cycle Monitoring</p>
          <p>100% Client-side Offline Storage • Zero External Tracking</p>
        </div>

      </div>
    `;
  }
}
