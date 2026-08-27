// FlowSync Deep Cycle Analytics & BBT Biphasic Charts
import { Icons } from "../icons.js";
import { CycleEngine } from "../engine.js";

export class AnalyticsView {
  constructor(app) {
    this.app = app;
    this.chartInstances = {};
  }

  render() {
    const profile = this.app.activeProfile;
    const cycles = this.app.cycles;
    const dailyLogs = this.app.dailyLogs;
    const stats = CycleEngine.calculateCycleStats(cycles, profile);
    const correlation = CycleEngine.analyzeSymptomCorrelations(dailyLogs, cycles);

    setTimeout(() => this.renderCharts(cycles, dailyLogs, stats), 100);

    return `
      <div class="p-4 space-y-4 animate-fade-in pb-24">
        
        <!-- Header with Medical Report Action -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-extrabold text-white">Cycle & Health Analytics</h2>
            <p class="text-xs text-slate-400">Statistical patterns & biometric trends</p>
          </div>

          <button onclick="window.app.openDoctorReport()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-200 hover:bg-white/10">
            ${Icons.fileText("w-3.5 h-3.5 text-primary")}
            <span>Doctor Report</span>
          </button>
        </div>

        <!-- Cycle Regularity & Key Stats Scorecard -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="glass-card p-3.5 space-y-1">
            <span class="text-[11px] font-bold text-slate-400">Cycle Regularity</span>
            <div class="text-2xl font-extrabold text-white flex items-baseline gap-1">
              <span>${stats.regularityScore}%</span>
            </div>
            <p class="text-[10px] text-emerald-400 font-semibold">${stats.regularityStatus}</p>
          </div>

          <div class="glass-card p-3.5 space-y-1">
            <span class="text-[11px] font-bold text-slate-400">Average Cycle</span>
            <div class="text-2xl font-extrabold text-primary flex items-baseline gap-1">
              <span>${stats.avgCycleLength}</span>
              <span class="text-xs text-slate-400">days</span>
            </div>
            <p class="text-[10px] text-slate-400">Period: ~${stats.avgPeriodLength} days</p>
          </div>
        </div>

        <!-- Cycle Length History Chart -->
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
              ${Icons.chart("w-4 h-4 text-primary")}
              <span>Cycle Length History</span>
            </h3>
            <span class="text-[11px] font-bold text-slate-400">Std Dev: ±${stats.stdDev}d</span>
          </div>

          <div class="h-48 w-full">
            <canvas id="cycle-length-chart"></canvas>
          </div>
        </div>

        <!-- BBT Biphasic Thermal Shift Curve -->
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-200 flex items-center gap-2">
              ${Icons.thermometer("w-4 h-4 text-cyan-400")}
              <span>Basal Body Temperature (BBT)</span>
            </h3>
            <span class="text-[11px] text-cyan-400 font-semibold">Biphasic Shift</span>
          </div>
          <p class="text-[11px] text-slate-400">Watch for ~0.3°C sustained rise confirming ovulation.</p>

          <div class="h-48 w-full">
            <canvas id="bbt-chart"></canvas>
          </div>
        </div>

        <!-- Top Logged Symptoms & Mood Breakdown -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- Symptoms -->
          <div class="glass-card p-4 space-y-3">
            <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Top Symptoms Logged</h3>
            <div class="space-y-2">
              ${correlation.topSymptoms.length === 0 ? `<p class="text-xs text-slate-500">No symptoms logged yet.</p>` : ""}
              ${correlation.topSymptoms.slice(0, 5).map(s => {
                const percent = Math.min(100, Math.round((s.count / Math.max(1, correlation.totalLogsRecorded)) * 100));
                return `
                  <div class="space-y-1 text-xs">
                    <div class="flex justify-between font-semibold text-slate-300">
                      <span>${s.name}</span>
                      <span class="text-primary">${s.count} times (${percent}%)</span>
                    </div>
                    <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div class="bg-primary h-full rounded-full" style="width: ${percent}%;"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Moods -->
          <div class="glass-card p-4 space-y-3">
            <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Mood Frequency</h3>
            <div class="space-y-2">
              ${correlation.topMoods.length === 0 ? `<p class="text-xs text-slate-500">No moods logged yet.</p>` : ""}
              ${correlation.topMoods.slice(0, 5).map(m => {
                const percent = Math.min(100, Math.round((m.count / Math.max(1, correlation.totalLogsRecorded)) * 100));
                return `
                  <div class="space-y-1 text-xs">
                    <div class="flex justify-between font-semibold text-slate-300">
                      <span>${m.name}</span>
                      <span class="text-purple-400">${m.count} times (${percent}%)</span>
                    </div>
                    <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div class="bg-purple-500 h-full rounded-full" style="width: ${percent}%;"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>

      </div>
    `;
  }

  renderCharts(cycles, dailyLogs, stats) {
    if (typeof Chart === "undefined") return;

    // 1. Cycle Length Bar Chart
    const cycleCtx = document.getElementById("cycle-length-chart");
    if (cycleCtx) {
      if (this.chartInstances.cycleChart) this.chartInstances.cycleChart.destroy();

      const validCycles = cycles.filter(c => c.length).slice(0, 8).reverse();
      const labels = validCycles.length ? validCycles.map(c => c.startDate.slice(5)) : ["Sample 1", "Sample 2", "Sample 3"];
      const data = validCycles.length ? validCycles.map(c => c.length) : [28, 29, 28];

      this.chartInstances.cycleChart = new Chart(cycleCtx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Cycle Length (Days)",
            data: data,
            backgroundColor: "rgba(255, 94, 126, 0.7)",
            borderColor: "#FF5E7E",
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              min: 20,
              max: 45,
              grid: { color: "rgba(255, 255, 255, 0.05)" },
              ticks: { color: "#94A3B8" }
            },
            x: {
              grid: { display: false },
              ticks: { color: "#94A3B8" }
            }
          }
        }
      });
    }

    // 2. BBT Chart
    const bbtCtx = document.getElementById("bbt-chart");
    if (bbtCtx) {
      if (this.chartInstances.bbtChart) this.chartInstances.bbtChart.destroy();

      const bbtLogs = dailyLogs.filter(l => l.bbt).slice(-18);
      const labels = bbtLogs.length ? bbtLogs.map(l => l.date.slice(5)) : ["D1", "D5", "D10", "D14", "D18", "D22", "D26"];
      const data = bbtLogs.length ? bbtLogs.map(l => l.bbt) : [36.4, 36.42, 36.38, 36.3, 36.65, 36.8, 36.85];

      this.chartInstances.bbtChart = new Chart(bbtCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: "BBT (°C)",
            data: data,
            borderColor: "#38BDF8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#38BDF8"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              min: 36.0,
              max: 37.2,
              grid: { color: "rgba(255, 255, 255, 0.05)" },
              ticks: { color: "#94A3B8" }
            },
            x: {
              grid: { display: false },
              ticks: { color: "#94A3B8" }
            }
          }
        }
      });
    }
  }
}
