// FlowSync Multi-Profile Management View & Switcher
import { Icons } from "../icons.js";
import { PWAController } from "./pwa.js";

export class ProfilesView {
  constructor(app) {
    this.app = app;
    this.editingProfile = null;
  }

  async switchProfile(id) {
    await this.app.setActiveProfile(id);
    PWAController.showToast("Switched active profile");
  }

  openProfileModal(profile = null) {
    this.editingProfile = profile ? JSON.parse(JSON.stringify(profile)) : {
      name: "",
      avatar: "🌸",
      color: "#FF5E7E",
      age: 26,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      lutealPhaseLength: 14,
      goal: "track",
      birthControl: "None",
      notes: ""
    };

    const modal = document.getElementById("profile-editor-modal");
    if (modal) {
      modal.innerHTML = this.renderEditorModal();
      modal.classList.add("open");
      PWAController.vibrate([20]);
    }
  }

  closeProfileModal() {
    const modal = document.getElementById("profile-editor-modal");
    if (modal) modal.classList.remove("open");
  }

  async saveEditingProfile() {
    const nameInput = document.getElementById("prof-name-input");
    if (!nameInput || !nameInput.value.trim()) {
      alert("Please enter a profile name");
      return;
    }

    this.editingProfile.name = nameInput.value.trim();
    this.editingProfile.age = parseInt(document.getElementById("prof-age-input").value) || 25;
    this.editingProfile.avgCycleLength = parseInt(document.getElementById("prof-cycle-input").value) || 28;
    this.editingProfile.avgPeriodLength = parseInt(document.getElementById("prof-period-input").value) || 5;
    this.editingProfile.goal = document.getElementById("prof-goal-input").value;
    this.editingProfile.birthControl = document.getElementById("prof-bc-input").value;

    const saved = await this.app.db.saveProfile(this.editingProfile);

    // If new or current active, refresh
    if (!this.app.activeProfile || this.app.activeProfile.id === saved.id) {
      await this.app.setActiveProfile(saved.id);
    } else {
      await this.app.loadData();
    }

    this.closeProfileModal();
    PWAController.showToast("Profile saved!");
  }

  async deleteProfile(id) {
    if (this.app.profiles.length <= 1) {
      alert("You must have at least one active profile.");
      return;
    }
    if (!confirm("Are you sure you want to delete this profile and all its cycle logs?")) return;

    await this.app.db.deleteProfile(id);
    const remaining = await this.app.db.getProfiles();
    await this.app.setActiveProfile(remaining[0].id);
    PWAController.showToast("Profile deleted");
  }

  async loadSampleData() {
    if (confirm("Reset & reload demo profiles (Sarah - Regular, Elena - TTC, Maya - Irregular)?")) {
      await this.app.db.seedSampleData();
      await this.app.loadData();
      PWAController.showToast("Sample demo profiles loaded!");
    }
  }

  renderEditorModal() {
    const p = this.editingProfile;
    const avatars = ["🌸", "✨", "🌿", "💎", "🌙", "🍓", "🦋", "🌻", "🍒", "🔮"];

    return `
      <div class="bottom-sheet-content">
        <div class="sheet-handle"></div>
        <div class="p-4 space-y-4 max-h-[85vh] overflow-y-auto pb-10">
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 class="text-base font-extrabold text-white">${p.id ? "Edit Profile" : "Create New Profile"}</h2>
            <button onclick="window.app.profilesView.closeProfileModal()" class="p-1 rounded-full text-slate-400">
              ${Icons.x("w-5 h-5")}
            </button>
          </div>

          <!-- Avatar Picker -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-300">Choose Avatar Icon</label>
            <div class="flex flex-wrap gap-2">
              ${avatars.map(av => `
                <button type="button" onclick="window.app.profilesView.editingProfile.avatar = '${av}'; document.getElementById('selected-avatar-disp').innerText = '${av}';"
                  class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-xl flex items-center justify-center hover:bg-white/15">
                  ${av}
                </button>
              `).join("")}
            </div>
          </div>

          <!-- Name & Age -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2 space-y-1">
              <label class="text-xs font-bold text-slate-300">Name / Monitored Person</label>
              <div class="flex items-center gap-2">
                <span id="selected-avatar-disp" class="text-2xl">${p.avatar || "🌸"}</span>
                <input id="prof-name-input" type="text" placeholder="e.g. Sarah, Daughter, Maya" value="${p.name || ""}"
                  class="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white text-xs font-bold focus:border-primary outline-none" />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-300">Age</label>
              <input id="prof-age-input" type="number" value="${p.age || 26}"
                class="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white text-xs font-bold focus:border-primary outline-none" />
            </div>
          </div>

          <!-- Goal Mode -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-300">Tracking Goal</label>
            <select id="prof-goal-input" class="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:border-primary outline-none">
              <option value="track" ${p.goal === "track" ? "selected" : ""}>General Cycle & Period Tracking</option>
              <option value="ttc" ${p.goal === "ttc" ? "selected" : ""}>Trying to Conceive (TTC & Fertility)</option>
              <option value="irregular" ${p.goal === "irregular" ? "selected" : ""}>Irregular / Perimenopause Rhythms</option>
              <option value="pregnancy" ${p.goal === "pregnancy" ? "selected" : ""}>Pregnancy Tracking Mode</option>
            </select>
          </div>

          <!-- Cycle & Period Lengths -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-300">Avg Cycle Length (days)</label>
              <input id="prof-cycle-input" type="number" min="20" max="60" value="${p.avgCycleLength || 28}"
                class="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white text-xs font-bold focus:border-primary outline-none" />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-300">Avg Period Length (days)</label>
              <input id="prof-period-input" type="number" min="2" max="12" value="${p.avgPeriodLength || 5}"
                class="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white text-xs font-bold focus:border-primary outline-none" />
            </div>
          </div>

          <!-- Birth Control -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-300">Contraception / Birth Control</label>
            <select id="prof-bc-input" class="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:border-primary outline-none">
              <option value="None" ${p.birthControl === "None" ? "selected" : ""}>None (Natural Cycle)</option>
              <option value="Oral Pill" ${p.birthControl === "Oral Pill" ? "selected" : ""}>Combined Oral Pill</option>
              <option value="Mini Pill" ${p.birthControl === "Mini Pill" ? "selected" : ""}>Progestin-only Mini Pill</option>
              <option value="IUD Copper" ${p.birthControl === "IUD Copper" ? "selected" : ""}>Copper IUD</option>
              <option value="IUD Hormonal" ${p.birthControl === "IUD Hormonal" ? "selected" : ""}>Hormonal IUD (Mirena/Kyleena)</option>
              <option value="Implant" ${p.birthControl === "Implant" ? "selected" : ""}>Arm Implant (Nexplanon)</option>
            </select>
          </div>

          <!-- Actions -->
          <button onclick="window.app.profilesView.saveEditingProfile()"
            class="w-full py-3.5 rounded-xl bg-primary text-white font-extrabold text-sm shadow-xl shadow-primary/30 hover:opacity-95">
            Save Profile
          </button>
        </div>
      </div>
    `;
  }

  render() {
    const profiles = this.app.profiles;
    const activeId = this.app.activeProfile?.id;

    return `
      <div class="p-4 space-y-4 animate-fade-in pb-24">
        
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-extrabold text-white">Monitored Profiles</h2>
            <p class="text-xs text-slate-400">Track multiple people independently</p>
          </div>

          <button onclick="window.app.profilesView.openProfileModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold shadow-md hover:opacity-90">
            ${Icons.userPlus("w-3.5 h-3.5")}
            <span>Add Profile</span>
          </button>
        </div>

        <!-- Profiles List -->
        <div class="space-y-3">
          ${profiles.map(p => {
            const isActive = p.id === activeId;
            return `
              <div class="glass-card p-4 transition-all ${isActive ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "opacity-90"}">
                <div class="flex items-center justify-between">
                  
                  <div class="flex items-center gap-3 cursor-pointer" onclick="window.app.profilesView.switchProfile('${p.id}')">
                    <div class="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl border border-white/10 shadow-inner">
                      ${p.avatar || "🌸"}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="text-sm font-bold text-white">${p.name}</h3>
                        ${isActive ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-white uppercase tracking-wider">Active</span>` : ""}
                      </div>
                      <p class="text-xs text-slate-400 capitalize">${p.goal === "ttc" ? "TTC / Fertility Mode" : p.goal === "irregular" ? "Irregular Tracking" : "Standard Cycle"} • ${p.avgCycleLength}d cycle</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-1">
                    <button onclick="window.app.profilesView.openProfileModal(window.app.profiles.find(x => x.id === '${p.id}'))" class="p-2 rounded-lg hover:bg-white/10 text-slate-400">
                      ${Icons.edit("w-4 h-4")}
                    </button>
                    ${profiles.length > 1 ? `
                      <button onclick="window.app.profilesView.deleteProfile('${p.id}')" class="p-2 rounded-lg hover:bg-white/10 text-rose-400">
                        ${Icons.trash("w-4 h-4")}
                      </button>
                    ` : ""}
                  </div>

                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- Sample Data Generator -->
        <div class="pt-4">
          <button onclick="window.app.profilesView.loadSampleData()" class="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 flex items-center justify-center gap-2">
            ${Icons.sparkles("w-4 h-4 text-amber-400")}
            <span>Reload 3 Realistic Sample Profiles (Sarah, Elena, Maya)</span>
          </button>
        </div>

      </div>
    `;
  }
}
