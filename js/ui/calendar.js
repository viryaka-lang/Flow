// FlowSync Interactive Monthly Calendar & Prediction Grid
import { Icons } from "../icons.js";
import { CycleEngine } from "../engine.js";

export class CalendarView {
  constructor(app) {
    this.app = app;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.selectedDate = CycleEngine.toDateStr(new Date());
  }

  prevMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.app.render();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.app.render();
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    this.app.render();
  }

  render() {
    const profile = this.app.activeProfile;
    const cycles = this.app.cycles;
    const dailyLogs = this.app.dailyLogs;
    const todayStr = CycleEngine.toDateStr(new Date());

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    // Prepare calendar cells
    let dayCells = "";
    
    // Empty cells before month start
    for (let i = 0; i < firstDayIndex; i++) {
      dayCells += `<div class="calendar-day-cell opacity-10 cursor-default"></div>`;
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(this.currentMonth + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;

      const dayInfo = CycleEngine.classifyCalendarDate(dateStr, cycles, dailyLogs, profile);
      const isSelected = dateStr === this.selectedDate;
      const isToday = dateStr === todayStr;

      let cellClasses = "calendar-day-cell";
      if (isToday) cellClasses += " today";
      if (isSelected) cellClasses += " ring-2 ring-white/80 ring-offset-2 ring-offset-slate-900";
      
      if (dayInfo.isPeriod) {
        cellClasses += " period-day";
      } else if (dayInfo.isPredictedPeriod) {
        cellClasses += " predicted-period";
      } else if (dayInfo.isOvulation) {
        cellClasses += " ovulation-day";
      } else if (dayInfo.isFertile) {
        cellClasses += " fertile-day";
      } else if (dayInfo.isPMS) {
        cellClasses += " pms-day";
      }

      // Log dots
      let dotsHtml = "";
      if (dayInfo.log) {
        const hasSymptoms = dayInfo.log.symptoms && dayInfo.log.symptoms.length > 0;
        const hasMoods = dayInfo.log.moods && dayInfo.log.moods.length > 0;
        const hasBbt = !!dayInfo.log.bbt;
        const hasIntimacy = !!dayInfo.log.intimacy;

        dotsHtml = `
          <div class="flex items-center justify-center gap-0.5 mt-0.5">
            ${hasSymptoms ? `<span class="day-dot bg-amber-400"></span>` : ""}
            ${hasMoods ? `<span class="day-dot bg-purple-400"></span>` : ""}
            ${hasBbt ? `<span class="day-dot bg-cyan-400"></span>` : ""}
            ${hasIntimacy ? `<span class="day-dot bg-pink-400"></span>` : ""}
          </div>
        `;
      }

      dayCells += `
        <div class="${cellClasses}" onclick="window.app.calendarView.selectDate('${dateStr}')">
          <span class="text-xs font-semibold">${day}</span>
          ${dayInfo.isOvulation ? `<span class="text-[9px] leading-none">⭐</span>` : ""}
          ${dotsHtml}
        </div>
      `;
    }

    // Selected day info card
    const selectedDayInfo = CycleEngine.classifyCalendarDate(this.selectedDate, cycles, dailyLogs, profile);
    const selectedLog = selectedDayInfo.log || {};

    return `
      <div class="p-4 space-y-4 animate-fade-in pb-24">
        
        <!-- Calendar Header Controls -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-extrabold text-white">${monthNames[this.currentMonth]} ${this.currentYear}</h2>
          </div>

          <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button onclick="window.app.calendarView.prevMonth()" class="p-1.5 rounded-lg hover:bg-white/10 text-slate-300">
              ${Icons.chevronLeft("w-4 h-4")}
            </button>
            <button onclick="window.app.calendarView.selectDate('${todayStr}')" class="px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10 rounded-lg">
              Today
            </button>
            <button onclick="window.app.calendarView.nextMonth()" class="p-1.5 rounded-lg hover:bg-white/10 text-slate-300">
              ${Icons.chevronRight("w-4 h-4")}
            </button>
          </div>
        </div>

        <!-- Calendar Legend -->
        <div class="flex flex-wrap gap-2 text-[11px] font-medium text-slate-300 bg-white/5 p-2.5 rounded-xl border border-white/5">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-primary"></span> Period</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-primary/40 border border-dashed border-primary"></span> Predicted</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Fertile</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Ovulation (⭐)</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span> PMS</span>
        </div>

        <!-- Month Grid -->
        <div class="glass-card p-3">
          <!-- Weekday Headers -->
          <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-2">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>

          <!-- Day Cells -->
          <div class="grid grid-cols-7 gap-1">
            ${dayCells}
          </div>
        </div>

        <!-- Selected Date Details Drawer/Card -->
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <span class="text-xs text-slate-400 font-medium">Selected Date</span>
              <h3 class="text-sm font-bold text-white">${this.selectedDate}</h3>
            </div>
            
            <div class="flex items-center gap-2">
              <button onclick="window.app.openPeriodStartModal('${this.selectedDate}')" class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold hover:bg-rose-500/30 transition-all" title="Mark this date as Day 1 of Period">
                <span>🩸 Started Here</span>
              </button>
              <button onclick="window.app.openLogger('${this.selectedDate}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold shadow-md hover:opacity-90">
                ${Icons.edit("w-3.5 h-3.5")}
                <span>Log Day</span>
              </button>
            </div>
          </div>

          <!-- Summary for selected date -->
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between py-1 border-b border-white/5">
              <span class="text-slate-400">Flow Status:</span>
              <span class="font-semibold text-white capitalize">${selectedLog.flow && selectedLog.flow !== "none" ? `🩸 ${selectedLog.flow} flow` : selectedDayInfo.isPredictedPeriod ? "Predicted Period" : "No period flow logged"}</span>
            </div>

            ${selectedLog.bbt ? `
              <div class="flex items-center justify-between py-1 border-b border-white/5">
                <span class="text-slate-400">Basal Body Temp:</span>
                <span class="font-semibold text-cyan-400">🌡️ ${selectedLog.bbt}°${this.app.settings.tempUnit || "C"}</span>
              </div>
            ` : ""}

            ${selectedLog.symptoms && selectedLog.symptoms.length > 0 ? `
              <div class="py-1 border-b border-white/5">
                <span class="text-slate-400 block mb-1">Symptoms:</span>
                <div class="flex flex-wrap gap-1">
                  ${selectedLog.symptoms.map(s => `<span class="tag-chip active text-[10px] py-0.5 px-2">${typeof s === "string" ? s : s.name}</span>`).join("")}
                </div>
              </div>
            ` : ""}

            ${selectedLog.moods && selectedLog.moods.length > 0 ? `
              <div class="py-1 border-b border-white/5">
                <span class="text-slate-400 block mb-1">Moods:</span>
                <div class="flex flex-wrap gap-1">
                  ${selectedLog.moods.map(m => `<span class="tag-chip text-[10px] py-0.5 px-2 bg-purple-500/20 text-purple-300 border-purple-500/30">${m}</span>`).join("")}
                </div>
              </div>
            ` : ""}

            ${selectedLog.notes ? `
              <div class="py-1">
                <span class="text-slate-400 block mb-0.5">Notes:</span>
                <p class="p-2 rounded-lg bg-black/20 text-slate-300 italic text-[11px]">${selectedLog.notes}</p>
              </div>
            ` : ""}
          </div>
        </div>

        <!-- 6-Month Projection Forecast List -->
        <div class="glass-card p-4 space-y-3">
          <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
            ${Icons.sparkles("w-4 h-4 text-primary")}
            <span>Future 6-Month Predictions</span>
          </h3>

          <div class="space-y-2">
            ${CycleEngine.generateFutureCycles(this.app.cycles[0]?.startDate || todayStr, CycleEngine.calculateCycleStats(cycles, profile), 6).map((f, i) => `
              <div class="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Cycle ${f.cycleIndex}</span>
                  <div class="font-bold text-white mt-0.5">${f.startDate} → ${f.periodEndDate}</div>
                  <span class="text-[10px] text-slate-400">Ovulation: <strong class="text-amber-400">${f.ovulationDate}</strong></span>
                </div>
                <div class="text-right">
                  <span class="text-[11px] font-semibold text-slate-300">${f.length} days</span>
                  <div class="text-[10px] text-slate-400">PMS: ${f.pmsStartDate}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

      </div>
    `;
  }
}
