// FlowSync Biological & Mathematical Menstrual Cycle Engine

export class CycleEngine {
  static toDateStr(date) {
    if (typeof date === "string") return date.split("T")[0];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  static parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  static addDays(date, days) {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res;
  }

  static diffDays(d1Str, d2Str) {
    const t1 = this.parseDate(d1Str).getTime();
    const t2 = this.parseDate(d2Str).getTime();
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
  }

  static calculateCycleStats(cycles, profile) {
    const defaultCycle = profile?.avgCycleLength || 28;
    const defaultPeriod = profile?.avgPeriodLength || 5;
    const lutealLength = profile?.lutealPhaseLength || 14;

    const completedCycles = cycles
      .filter(c => c.length && c.length >= 18 && c.length <= 60)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    if (completedCycles.length === 0) {
      return {
        avgCycleLength: defaultCycle,
        avgPeriodLength: defaultPeriod,
        lutealLength: lutealLength,
        regularityScore: 95,
        regularityStatus: "Regular (Estimated)",
        stdDev: 1.2,
        minCycle: defaultCycle,
        maxCycle: defaultCycle,
        totalCyclesRecorded: 0,
        anomalies: []
      };
    }

    const lengths = completedCycles.map(c => c.length);
    const periodLengths = completedCycles.map(c => c.periodLength || defaultPeriod);

    let weightedSum = 0;
    let totalWeight = 0;
    const weights = [0.45, 0.30, 0.15, 0.10];

    lengths.forEach((len, idx) => {
      const w = idx < weights.length ? weights[idx] : 0.05;
      weightedSum += len * w;
      totalWeight += w;
    });

    const avgCycle = Math.round(weightedSum / totalWeight);
    const avgPeriod = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    let regScore = Math.max(20, Math.min(99, Math.round(100 - (stdDev * 10))));
    if (completedCycles.length === 1) regScore = 90;

    let regStatus = "Highly Regular";
    if (stdDev > 4.5) regStatus = "Irregular Cycle";
    else if (stdDev > 2.5) regStatus = "Moderately Variable";

    const anomalies = [];
    if (avgCycle < 21) anomalies.push("Polymenorrhea: Cycles shorter than 21 days");
    if (avgCycle > 35) anomalies.push("Oligomenorrhea: Cycles longer than 35 days");
    if (stdDev > 6) anomalies.push("High variation: Cycle length varies by more than 6 days");

    return {
      avgCycleLength: avgCycle,
      avgPeriodLength: avgPeriod,
      lutealLength: lutealLength,
      regularityScore: regScore,
      regularityStatus: regStatus,
      stdDev: +stdDev.toFixed(1),
      minCycle: Math.min(...lengths),
      maxCycle: Math.max(...lengths),
      totalCyclesRecorded: completedCycles.length,
      anomalies
    };
  }

  static getActiveCycle(cycles) {
    if (!cycles || cycles.length === 0) return null;
    return cycles.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
  }

  static getCurrentCycleStatus(cycles, profile, targetDate = new Date()) {
    const stats = this.calculateCycleStats(cycles, profile);
    const latestCycle = this.getActiveCycle(cycles);
    const targetDateStr = this.toDateStr(targetDate);

    if (!latestCycle) {
      return {
        cycleDay: 1,
        daysUntilPeriod: stats.avgCycleLength,
        isLate: false,
        daysLate: 0,
        cycleStartDate: targetDateStr,
        stats,
        phase: this.getPhaseInfo(1, stats, profile)
      };
    }

    const startStr = latestCycle.startDate;
    const diff = this.diffDays(startStr, targetDateStr);
    const cycleDay = diff + 1;

    const expectedCycleLength = stats.avgCycleLength;
    const daysUntilPeriod = expectedCycleLength - cycleDay;
    const isLate = daysUntilPeriod < 0;
    const daysLate = isLate ? Math.abs(daysUntilPeriod) : 0;

    const phase = this.getPhaseInfo(cycleDay, stats, profile);

    return {
      cycleDay: Math.max(1, cycleDay),
      daysUntilPeriod: Math.max(0, daysUntilPeriod),
      isLate,
      daysLate,
      cycleStartDate: startStr,
      latestCycle,
      stats,
      phase
    };
  }

  static getPhaseInfo(cycleDay, stats, profile) {
    const cycleLen = stats.avgCycleLength || 28;
    const periodLen = stats.avgPeriodLength || 5;
    const lutealLen = stats.lutealLength || 14;
    const ovulationDay = Math.max(periodLen + 2, cycleLen - lutealLen);

    const fertileStart = Math.max(periodLen + 1, ovulationDay - 5);
    const fertileEnd = ovulationDay + 1;
    const pmsStart = Math.max(fertileEnd + 1, cycleLen - 4);

    let phaseId = "follicular";
    let phaseName = "Follicular Phase";
    let color = "var(--theme-follicular)";
    let lightColor = "var(--theme-follicular-light)";
    let badgeText = "Rising Energy & Clarity";
    let pregnancyChance = "Low";
    let pregnancyPercent = 12;

    if (cycleDay <= periodLen) {
      phaseId = "menstruation";
      phaseName = "Menstrual Phase";
      color = "var(--theme-primary)";
      lightColor = "var(--theme-primary-light)";
      badgeText = "Rest, Recharge & Renew";
      pregnancyChance = "Very Low";
      pregnancyPercent = 2;
    } else if (cycleDay >= fertileStart && cycleDay <= fertileEnd) {
      if (cycleDay === ovulationDay) {
        phaseId = "ovulation";
        phaseName = "Ovulation Day";
        color = "var(--theme-ovulation)";
        lightColor = "var(--theme-ovulation-light)";
        badgeText = "Peak Fertility & Vitality";
        pregnancyChance = "Peak";
        pregnancyPercent = 33;
      } else {
        phaseId = "fertile";
        phaseName = "Fertile Window";
        color = "var(--theme-fertile)";
        lightColor = "var(--theme-fertile-light)";
        badgeText = "High Conception Window";
        pregnancyChance = cycleDay >= ovulationDay - 2 ? "High" : "Medium";
        pregnancyPercent = cycleDay >= ovulationDay - 2 ? 26 : 18;
      }
    } else if (cycleDay >= pmsStart) {
      phaseId = "pms";
      phaseName = "Luteal / PMS Window";
      color = "var(--theme-luteal)";
      lightColor = "var(--theme-luteal-light)";
      badgeText = "Nourish & Gentle Pacing";
      pregnancyChance = "Very Low";
      pregnancyPercent = 1;
    } else if (cycleDay > fertileEnd) {
      phaseId = "luteal";
      phaseName = "Luteal Phase";
      color = "var(--theme-luteal)";
      lightColor = "var(--theme-luteal-light)";
      badgeText = "Progesterone Dominance";
      pregnancyChance = "Low";
      pregnancyPercent = 4;
    }

    const recommendations = {
      menstruation: {
        summary: "Your uterine lining is shedding. Estrogen and progesterone are at baseline. Prioritize warm nourishment, soothing hydration, and gentle movement.",
        hormones: "Estrogen: Baseline Low | Progesterone: Low | LH: Baseline",
        energy: "Inward & Reflective (3/5)",
        workout: "Gentle Yin yoga, slow walks, stretching, or full restorative rest.",
        nutrition: "Warm stews, iron-rich spinach, lentils, bone broth, and dark chocolate.",
        mood: "Introspective, intuitive. Honor boundaries and quiet time."
      },
      follicular: {
        summary: "FSH is stimulating follicles in your ovaries. Estrogen levels are steadily rising, bringing a boost in brain chemistry, metabolic stamina, and optimism.",
        hormones: "Estrogen: Rising Fast | Progesterone: Low | FSH: Active",
        energy: "Surging Vitality & Mental Spark (4.5/5)",
        workout: "Strength training, HIIT, spin classes, and learning new motor skills.",
        nutrition: "Light fresh proteins, fermented kimchi/kombucha, sprouted grains, citrus.",
        mood: "Creative, social, highly motivated, and mentally sharp for planning."
      },
      fertile: {
        summary: "Estrogen peaks, triggering cervical fluid to become stretchy and fertile (egg-white texture). The body prepares for releasing a mature egg.",
        hormones: "Estrogen: Peak | LH: Surging | Progesterone: Beginning to rise",
        energy: "Peak Radiance & High Libido (5/5)",
        workout: "High-intensity cardio, group fitness, heavy lifting, dance.",
        nutrition: "Cruciferous veggies (broccoli, kale) to support estrogen metabolism, berries.",
        mood: "Charismatic, communicative, magnetic, and confident in social settings."
      },
      ovulation: {
        summary: "LH surge triggers the release of an egg into the fallopian tube. Conception likelihood is at its highest 24-hour peak.",
        hormones: "LH: Peak Surge | Estrogen: Sharp Peak | Progesterone: Rising",
        energy: "Maximum Power & High Stamina (5/5)",
        workout: "Personal record lifts, sprint intervals, or celebratory energetic movement.",
        nutrition: "Zinc & B-complex foods: pumpkin seeds, wild salmon, avocados, leafy greens.",
        mood: "Empowered, passionate, assertive, and expressive."
      },
      luteal: {
        summary: "The ruptured follicle becomes the corpus luteum, producing progesterone to support the uterine lining. Basal body temperature rises ~0.3°C to 0.5°C.",
        hormones: "Progesterone: High Dominance | Estrogen: Secondary Peak | LH: Low",
        energy: "Steady & Grounded, slowly tapering (3.5/5)",
        workout: "Pilates, steady-state zone 2 cardio, moderate resistance training.",
        nutrition: "Root vegetables (sweet potato, squash), magnesium-rich nuts, pumpkin seeds.",
        mood: "Detail-oriented, organizing, nesting, and wrapping up key projects."
      },
      pms: {
        summary: "Progesterone drops sharply before menstruation. Serotonin can fluctuate slightly. Keep blood sugar stable and reduce stimulants.",
        hormones: "Progesterone: Dropping Fast | Estrogen: Declining | Serotonin: Fluctuating",
        energy: "Delicate & Grounded (2.5/5)",
        workout: "Brisk scenic walks, gentle foam rolling, restorative yoga, swimming.",
        nutrition: "Magnesium glycinate, chamomile tea, complex whole grains to stabilize blood sugar.",
        mood: "Sensitive to stress. Prioritize warm baths, journaling, and deep sleep."
      }
    };

    return {
      phaseId,
      phaseName,
      color,
      lightColor,
      badgeText,
      cycleDay,
      ovulationDay,
      fertileStart,
      fertileEnd,
      pmsStart,
      cycleLength: cycleLen,
      pregnancyChance,
      pregnancyPercent,
      ...recommendations[phaseId]
    };
  }

  static generateFutureCycles(lastCycleStartDate, stats, numCycles = 12) {
    const cycleLen = stats.avgCycleLength || 28;
    const periodLen = stats.avgPeriodLength || 5;
    const lutealLen = stats.lutealLength || 14;

    const forecasts = [];
    let currentStart = this.parseDate(lastCycleStartDate);

    for (let i = 1; i <= numCycles; i++) {
      const nextStart = this.addDays(currentStart, cycleLen);
      const periodEnd = this.addDays(nextStart, periodLen - 1);
      const ovulationDate = this.addDays(nextStart, cycleLen - lutealLen);
      const fertileStart = this.addDays(ovulationDate, -5);
      const fertileEnd = this.addDays(ovulationDate, 1);
      const pmsStart = this.addDays(nextStart, cycleLen - 4);
      const cycleEnd = this.addDays(nextStart, cycleLen - 1);

      forecasts.push({
        cycleIndex: i,
        startDate: this.toDateStr(nextStart),
        endDate: this.toDateStr(cycleEnd),
        periodEndDate: this.toDateStr(periodEnd),
        ovulationDate: this.toDateStr(ovulationDate),
        fertileStartDate: this.toDateStr(fertileStart),
        fertileEndDate: this.toDateStr(fertileEnd),
        pmsStartDate: this.toDateStr(pmsStart),
        length: cycleLen,
        periodLength: periodLen
      });

      currentStart = nextStart;
    }

    return forecasts;
  }

  static generateHormoneWavePoints(cycleLength = 28, ovulationDay = 14, width = 300, height = 80) {
    const points = {
      estrogen: [],
      progesterone: [],
      lh: [],
      fsh: []
    };

    const numPoints = 50;
    for (let i = 0; i <= numPoints; i++) {
      const day = 1 + (i / numPoints) * (cycleLength - 1);
      const x = (i / numPoints) * width;

      const eOvPeak = Math.exp(-Math.pow((day - (ovulationDay - 1)) / 2.5, 2)) * 0.85;
      const eLutPeak = Math.exp(-Math.pow((day - (ovulationDay + 6)) / 4, 2)) * 0.45;
      const eBase = 0.15;
      const estrogenVal = Math.min(1.0, eBase + eOvPeak + eLutPeak);
      const yEstrogen = height - (estrogenVal * (height - 10) + 5);

      const pLutPeak = day > ovulationDay ? Math.exp(-Math.pow((day - (ovulationDay + 6)) / 3.8, 2)) * 0.90 : 0.05;
      const progesteroneVal = Math.min(1.0, pLutPeak);
      const yProgesterone = height - (progesteroneVal * (height - 10) + 5);

      const lhPeak = Math.exp(-Math.pow((day - (ovulationDay - 1)) / 1.2, 2)) * 0.95;
      const lhVal = Math.min(1.0, 0.08 + lhPeak);
      const yLH = height - (lhVal * (height - 10) + 5);

      const fshEarly = Math.exp(-Math.pow((day - 3) / 3, 2)) * 0.4;
      const fshOv = Math.exp(-Math.pow((day - (ovulationDay - 1)) / 1.5, 2)) * 0.45;
      const fshVal = Math.min(1.0, 0.1 + fshEarly + fshOv);
      const yFSH = height - (fshVal * (height - 10) + 5);

      points.estrogen.push({ x: +x.toFixed(1), y: +yEstrogen.toFixed(1) });
      points.progesterone.push({ x: +x.toFixed(1), y: +yProgesterone.toFixed(1) });
      points.lh.push({ x: +x.toFixed(1), y: +yLH.toFixed(1) });
      points.fsh.push({ x: +x.toFixed(1), y: +yFSH.toFixed(1) });
    }

    const toSvgPath = (pts) => {
      return pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    };

    return {
      estrogenPath: toSvgPath(points.estrogen),
      progesteronePath: toSvgPath(points.progesterone),
      lhPath: toSvgPath(points.lh),
      fshPath: toSvgPath(points.fsh)
    };
  }

  static classifyCalendarDate(dateStr, cycles, dailyLogs, profile) {
    const stats = this.calculateCycleStats(cycles, profile);
    const dateObj = this.parseDate(dateStr);
    const log = dailyLogs.find(l => l.date === dateStr);

    let isPeriod = false;
    let isPredictedPeriod = false;
    let isFertile = false;
    let isOvulation = false;
    let isPMS = false;
    let periodDayNumber = null;
    let cycleDayNumber = null;

    for (const c of cycles) {
      const cStart = this.parseDate(c.startDate);
      const pLen = c.periodLength || stats.avgPeriodLength;
      const cEnd = c.endDate ? this.parseDate(c.endDate) : this.addDays(cStart, (c.length || stats.avgCycleLength) - 1);

      if (dateObj >= cStart && dateObj <= cEnd) {
        cycleDayNumber = this.diffDays(c.startDate, dateStr) + 1;
        const diffStart = this.diffDays(c.startDate, dateStr);

        if (diffStart >= 0 && diffStart < pLen) {
          isPeriod = true;
          periodDayNumber = diffStart + 1;
        }

        const ovDay = c.length ? c.length - stats.lutealLength : stats.avgCycleLength - stats.lutealLength;
        if (cycleDayNumber === ovDay) isOvulation = true;
        else if (cycleDayNumber >= ovDay - 5 && cycleDayNumber <= ovDay + 1) isFertile = true;

        if (c.length && cycleDayNumber >= c.length - 4) isPMS = true;
      }
    }

    if (log && log.flow && log.flow !== "none") {
      isPeriod = true;
    }

    const latestCycle = this.getActiveCycle(cycles);
    if (latestCycle) {
      const latestStart = this.parseDate(latestCycle.startDate);
      if (dateObj > latestStart) {
        const forecasts = this.generateFutureCycles(latestCycle.startDate, stats, 6);
        for (const f of forecasts) {
          const fStart = this.parseDate(f.startDate);
          const fPeriodEnd = this.parseDate(f.periodEndDate);
          const fOv = this.parseDate(f.ovulationDate);
          const fFertStart = this.parseDate(f.fertileStartDate);
          const fFertEnd = this.parseDate(f.fertileEndDate);
          const fPMSStart = this.parseDate(f.pmsStartDate);
          const fEnd = this.parseDate(f.endDate);

          if (dateObj >= fStart && dateObj <= fEnd) {
            cycleDayNumber = this.diffDays(f.startDate, dateStr) + 1;
          }

          if (dateObj >= fStart && dateObj <= fPeriodEnd) {
            isPredictedPeriod = true;
          }
          if (dateStr === f.ovulationDate) {
            isOvulation = true;
          } else if (dateObj >= fFertStart && dateObj <= fFertEnd) {
            isFertile = true;
          }
          if (dateObj >= fPMSStart && dateObj <= fEnd) {
            isPMS = true;
          }
        }
      }
    }

    return {
      dateStr,
      isPeriod,
      isPredictedPeriod,
      isFertile,
      isOvulation,
      isPMS,
      periodDayNumber,
      cycleDayNumber,
      log: log || null
    };
  }

  static analyzeSymptomCorrelations(dailyLogs, cycles) {
    const symptomFrequency = {};
    const moodFrequency = {};

    dailyLogs.forEach(log => {
      if (log.symptoms && Array.isArray(log.symptoms)) {
        log.symptoms.forEach(s => {
          const name = typeof s === "string" ? s : s.name;
          symptomFrequency[name] = (symptomFrequency[name] || 0) + 1;
        });
      }
      if (log.moods && Array.isArray(log.moods)) {
        log.moods.forEach(m => {
          moodFrequency[m] = (moodFrequency[m] || 0) + 1;
        });
      }
    });

    const topSymptoms = Object.entries(symptomFrequency)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topMoods = Object.entries(moodFrequency)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      topSymptoms,
      topMoods,
      totalLogsRecorded: dailyLogs.length
    };
  }
}
