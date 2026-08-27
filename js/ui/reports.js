// FlowSync Gynecologist / Clinical Doctor Report Generator
import { Icons } from "../icons.js";
import { CycleEngine } from "../engine.js";

export class DoctorReportModal {
  constructor(app) {
    this.app = app;
  }

  open() {
    const modal = document.getElementById("doctor-report-modal");
    if (!modal) return;
    modal.innerHTML = this.render();
    modal.classList.add("open");
  }

  close() {
    const modal = document.getElementById("doctor-report-modal");
    if (modal) modal.classList.remove("open");
  }

  print() {
    window.print();
  }

  render() {
    const profile = this.app.activeProfile;
    const cycles = this.app.cycles;
    const dailyLogs = this.app.dailyLogs;
    const stats = CycleEngine.calculateCycleStats(cycles, profile);
    const correlation = CycleEngine.analyzeSymptomCorrelations(dailyLogs, cycles);
    const dateGenerated = new Date().toLocaleDateString();

    return `
      <div class="bottom-sheet-content !max-h-[92vh]">
        <div class="sheet-handle no-print"></div>
        <div class="p-5 space-y-5 overflow-y-auto pb-12 bg-white text-slate-900 rounded-t-3xl">
          
          <!-- Report Header -->
          <div class="flex items-center justify-between border-b-2 border-slate-200 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-2xl font-black text-rose-600">FlowSync</span>
                <span class="text-xs uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-rose-100 text-rose-700">Clinical Summary</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Menstrual Cycle & Gynecological Health Record</p>
            </div>

            <div class="flex items-center gap-2 no-print">
              <button onclick="window.app.doctorReport.print()" class="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold shadow hover:bg-rose-700 flex items-center gap-1">
                ${Icons.download("w-3.5 h-3.5")}
                <span>Print / PDF</span>
              </button>
              <button onclick="window.app.doctorReport.close()" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                ${Icons.x("w-5 h-5")}
              </button>
            </div>
          </div>

          <!-- Patient Summary Card -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span class="text-slate-500 block font-medium">Patient Name:</span>
              <strong class="text-slate-900 font-bold text-sm">${profile?.name || "Patient"}</strong>
            </div>
            <div>
              <span class="text-slate-500 block font-medium">Age & Goal:</span>
              <strong class="text-slate-900">${profile?.age || 26} yrs (${profile?.goal?.toUpperCase() || "TRACK"})</strong>
            </div>
            <div>
              <span class="text-slate-500 block font-medium">Contraception:</span>
              <strong class="text-slate-900">${profile?.birthControl || "None"}</strong>
            </div>
            <div>
              <span class="text-slate-500 block font-medium">Generated On:</span>
              <strong class="text-slate-900">${dateGenerated}</strong>
            </div>
          </div>

          <!-- Statistical Metrics Grid -->
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-[11px] text-slate-500 font-bold uppercase">Avg Cycle Length</span>
              <div class="text-xl font-extrabold text-rose-600 mt-0.5">${stats.avgCycleLength} Days</div>
              <span class="text-[10px] text-slate-400">Std Dev: ±${stats.stdDev}d</span>
            </div>

            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-[11px] text-slate-500 font-bold uppercase">Avg Period Flow</span>
              <div class="text-xl font-extrabold text-slate-900 mt-0.5">${stats.avgPeriodLength} Days</div>
              <span class="text-[10px] text-slate-400">Duration</span>
            </div>

            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-[11px] text-slate-500 font-bold uppercase">Regularity Index</span>
              <div class="text-xl font-extrabold text-emerald-600 mt-0.5">${stats.regularityScore}%</div>
              <span class="text-[10px] text-emerald-700 font-medium">${stats.regularityStatus}</span>
            </div>
          </div>

          <!-- Historical Cycles Table -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Logged Cycle History</h4>
            <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table class="w-full text-left">
                <thead class="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th class="p-2.5">Start Date</th>
                    <th class="p-2.5">End Date</th>
                    <th class="p-2.5 text-center">Cycle Length</th>
                    <th class="p-2.5 text-center">Flow Duration</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 text-slate-800">
                  ${cycles.slice(0, 6).map(c => `
                    <tr>
                      <td class="p-2.5 font-medium">${c.startDate}</td>
                      <td class="p-2.5">${c.endDate || "Ongoing"}</td>
                      <td class="p-2.5 text-center font-bold">${c.length ? c.length + " days" : "—"}</td>
                      <td class="p-2.5 text-center">${c.periodLength || stats.avgPeriodLength} days</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Symptom & Clinical Findings -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Top Reported Symptoms</h4>
            <div class="flex flex-wrap gap-2">
              ${correlation.topSymptoms.slice(0, 6).map(s => `
                <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium">
                  ${s.name} (${s.count}x)
                </span>
              `).join("")}
            </div>
          </div>

          <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
            <strong>Physician Note:</strong> This health log was exported from FlowSync PWA. The data reflects self-reported daily biometrics, basal body temperatures, ovulation test results, and period dates recorded by the patient.
          </div>

        </div>
      </div>
    `;
  }
}
