// FlowSync Dashboard UI with Circular Cycle Wheel & Daily Biological Insights
import { Icons } from "../icons.js";
import { CycleEngine } from "../engine.js";
import { PWAController } from "./pwa.js";

export class DashboardView {
  constructor(app) {
    this.app = app;
  }

  render() {
    const profile = this.app.activeProfile;
    const cycles = this.app.cycles;
    const todayStr = CycleEngine.toDateStr(new Date());
    const todayLog = this.app.dailyLogs.find(l => l.date === todayStr) || {};
    const status = CycleEngine.getCurrentCycleStatus(cycles, profile, new Date());
    const phase = status.phase;

    // Calculate circumference for circular progress
    const radius = 110;
    const circumference = 2 * Math.PI * radius;
    const cycleLength = phase.cycleLength || 28;
    const progressFraction = Math.min(1, Math.max(0, (status.cycleDay - 1) / cycleLength));
    const strokeDashoffset = circumference - (progressFraction * circumference);

    // Dynamic wave coordinates for hormone preview
    const waveData = CycleEngine.generateHormoneWavePoints(cycleLength, phase.ovulationDay, 300, 75);

    return `
      <div class="p-4 space-y-5 animate-fade-in pb-24">
        
        <!-- Active Profile Quick Pill & Stealth Title -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-all" onclick="window.app.openProfileModal()">
            <span class="text-lg">${profile?.avatar || "🌸"}</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-slate-200 leading-tight">${this.app.stealthMode ? "Personal Space" : (profile?.name || "My Cycle")}</span>
              <span class="text-[10px] text-slate-400 capitalize">${profile?.goal === "ttc" ? "TTC Mode" : profile?.goal === "irregular" ? "Irregular Mode" : "Tracking"}</span>
            </div>
            ${Icons.chevronDown("w-3.5 h-3.5 text-slate-400 ml-1")}
          </div>

          <button onclick="window.app.openLogger('${todayStr}')" class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all">
            ${Icons.plus("w-3.5 h-3.5")}
            <span>Log Today</span>
          </button>
        </div>

        <!-- Circular Cycle Wheel -->
        <div class="relative py-2 flex flex-col items-center justify-center">
          <div class="cycle-dial-container">
            <svg class="cycle-dial-svg" viewBox="0 0 280 280">
              <!-- Outer Track Background -->
              <circle cx="140" cy="140" r="${radius}" class="cycle-track" stroke-dasharray="${circumference}" stroke-dashoffset="0" />
              
              <!-- Progress Arc with Active Phase Color -->
              <circle cx="140" cy="140" r="${radius}" class="cycle-progress" 
                style="stroke: ${phase.color}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeDashoffset};" />
            </svg>

            <!-- Inner Dial Content -->
            <div class="cycle-dial-inner">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                ${this.app.stealthMode ? "Phase Step" : "Cycle Day"}
              </span>
              <div class="text-4xl font-extrabold tracking-tight text-white mb-1 flex items-baseline gap-1">
                <span>Day ${status.cycleDay}</span>
              </div>
              <div class="px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 shadow-sm flex items-center gap-1"
                style="background-color: ${phase.lightColor}; color: ${phase.color}; border: 1px solid ${phase.color}40;">
                <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${phase.color}"></span>
                ${this.app.stealthMode ? "Active Rhythm" : phase.phaseName}
              </div>
              
              <!-- Countdown / Days to Period -->
              <p class="text-xs font-medium text-slate-300 text-center px-4">
                ${status.isLate 
                  ? `<span class="text-amber-400 font-bold">⚠️ Period is ${status.daysLate} day${status.daysLate > 1 ? "s" : ""} late</span>`
                  : status.cycleDay <= (profile?.avgPeriodLength || 5)
                  ? `<span class="text-primary font-semibold">🩸 Day ${status.cycleDay} of Period</span>`
                  : `<span class="text-slate-300">Next period in <strong class="text-white">${status.daysUntilPeriod} days</strong></span>`
                }
              </p>
              
              <!-- Quick Period Start Date Adjust Button -->
              <button onclick="window.app.openPeriodStartModal('${status.cycleStartDate}')" class="mt-1 text-[10px] font-bold text-slate-400 hover:text-primary underline flex items-center gap-1 transition-all">
                <span>Start: ${status.cycleStartDate}</span> ✏️
              </button>
            </div>
          </div>

          <!-- Conception Probability Badge -->
          <div class="mt-3 flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
            <span class="text-amber-400">✨</span>
            <span>Chance of Conception:</span>
            <span class="font-bold text-white">${phase.pregnancyChance} (${phase.pregnancyPercent}%)</span>
          </div>
        </div>

        
        <!-- Quick 'Period Started Today' Quick Action Banner -->
        ${status.cycleDay > (profile?.avgPeriodLength || 5) ? `
          <div class="glass-card p-3.5 bg-gradient-to-r from-rose-950/40 to-purple-950/40 border-rose-500/30 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-xl p-1.5 rounded-xl bg-rose-500/20 text-rose-400">🩸</span>
              <div>
                <h4 class="text-xs font-bold text-white">Period started today?</h4>
                <p class="text-[10px] text-slate-300">Tap to start Day 1 of your new cycle</p>
              </div>
            </div>
            <button onclick="window.app.openPeriodStartModal('${todayStr}')" class="px-3.5 py-1.5 rounded-full bg-primary text-white text-xs font-extrabold shadow-md shadow-primary/30 hover:opacity-90 transition-all">
              Log Day 1
            </button>
          </div>
        ` : ""}

        <!-- Today's Quick Log Summary & Quick Chips -->
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
              ${Icons.activity("w-4 h-4 text-primary")}
              <span>Today's Check-in (${todayStr})</span>
            </h3>
            <button onclick="window.app.openLogger('${todayStr}')" class="text-xs text-primary font-medium hover:underline">Edit</button>
          </div>

          <!-- Quick Log Chips Row -->
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${todayLog.flow && todayLog.flow !== "none" ? `
              <span class="tag-chip active text-xs">🩸 ${todayLog.flow.toUpperCase()} Flow</span>
            ` : `
              <button onclick="window.app.quickLogFlow('${todayStr}', 'medium')" class="tag-chip text-xs hover:border-primary">🩸 + Flow</button>
            `}

            ${todayLog.moods && todayLog.moods.length > 0 ? `
              <span class="tag-chip active text-xs">😊 ${todayLog.moods.join(", ")}</span>
            ` : `
              <button onclick="window.app.openLogger('${todayStr}')" class="tag-chip text-xs">😊 + Mood</button>
            `}

            ${todayLog.bbt ? `
              <span class="tag-chip active text-xs">🌡️ ${todayLog.bbt}°${this.app.settings.tempUnit || "C"}</span>
            ` : `
              <button onclick="window.app.openLogger('${todayStr}')" class="tag-chip text-xs">🌡️ + BBT</button>
            `}

            <!-- Water tracker button in chip -->
            <button onclick="window.app.incrementWater('${todayStr}')" class="tag-chip text-xs hover:border-cyan-400">
              💧 <strong>${todayLog.water || 0}</strong>/8 Glasses
            </button>
          </div>
        </div>

        <!-- 4-Phase Biological Insights Card -->
        <div class="glass-card p-4 space-y-4">
          <div class="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg" style="background-color: ${phase.lightColor}; color: ${phase.color}">
                ${Icons.sparkles("w-4 h-4")}
              </span>
              <div>
                <h3 class="text-sm font-bold text-white">${phase.phaseName}</h3>
                <p class="text-[11px] text-slate-400">${phase.badgeText}</p>
              </div>
            </div>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">${phase.summary}</p>

          <!-- Hormone Wave Dynamic Graphic -->
          <div class="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
            <div class="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>Hormone Curve (Cycle Day ${status.cycleDay})</span>
              <div class="flex items-center gap-2 text-[10px]">
                <span class="flex items-center gap-1 text-cyan-400">● Estrogen</span>
                <span class="flex items-center gap-1 text-purple-400">● Progesterone</span>
              </div>
            </div>
            <svg class="hormone-wave-svg" viewBox="0 0 300 75">
              <!-- Estrogen curve -->
              <path d="${waveData.estrogenPath}" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" />
              <!-- Progesterone curve -->
              <path d="${waveData.progesteronePath}" fill="none" stroke="#A855F7" stroke-width="2.5" stroke-linecap="round" />
              <!-- Current Day Indicator Line -->
              <line x1="${(status.cycleDay / cycleLength) * 300}" y1="0" x2="${(status.cycleDay / cycleLength) * 300}" y2="75" stroke="#FFFFFF" stroke-dasharray="3 3" stroke-width="1.5" />
            </svg>
            <p class="text-[10px] text-slate-400 text-center font-medium">${phase.hormones}</p>
          </div>

          <!-- Actionable Lifestyle & Wellness Grid -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <div class="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-1">
              <span class="text-[11px] font-bold text-amber-400 flex items-center gap-1">⚡ Energy & Focus</span>
              <p class="text-xs text-slate-200 font-medium">${phase.energy}</p>
            </div>

            <div class="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-1">
              <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-1">🏃 Movement</span>
              <p class="text-xs text-slate-200 font-medium">${phase.workout}</p>
            </div>

            <div class="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-1">
              <span class="text-[11px] font-bold text-pink-400 flex items-center gap-1">🥗 Nutrition</span>
              <p class="text-xs text-slate-200 font-medium">${phase.nutrition}</p>
            </div>

            <div class="bg-white/5 p-2.5 rounded-xl border border-white/5 space-y-1">
              <span class="text-[11px] font-bold text-indigo-400 flex items-center gap-1">🧠 Mindset</span>
              <p class="text-xs text-slate-200 font-medium">${phase.mood}</p>
            </div>
          </div>
        </div>

        <!-- Upcoming Cycle Milestones -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
            ${Icons.calendar("w-4 h-4 text-purple-400")}
            <span>Upcoming Milestones</span>
          </h3>

          <div class="space-y-2">
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs">
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span class="font-medium text-slate-200">Ovulation & Peak Fertility</span>
              </div>
              <span class="font-bold text-amber-400">Day ${phase.ovulationDay}</span>
            </div>

            <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs">
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                <span class="font-medium text-slate-200">Luteal / PMS Window</span>
              </div>
              <span class="font-bold text-purple-400">Day ${phase.pmsStart}</span>
            </div>

            <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs">
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span class="font-medium text-slate-200">Next Estimated Period</span>
              </div>
              <span class="font-bold text-primary">In ${status.daysUntilPeriod} Days</span>
            </div>
          </div>
        </div>

      </div>
    `;
  }
}
