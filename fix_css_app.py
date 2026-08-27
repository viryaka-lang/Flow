# -*- coding: utf-8 -*-

css_code = """/* FlowSync Android PWA Master Styles */
:root {
  --theme-primary: #FF5E7E;
  --theme-primary-hover: #FF476C;
  --theme-primary-light: rgba(255, 94, 126, 0.15);
  --theme-primary-border: rgba(255, 94, 126, 0.3);
  --theme-accent: #A78BFA;
  --theme-accent-light: rgba(167, 139, 250, 0.15);
  --theme-ovulation: #F59E0B;
  --theme-ovulation-light: rgba(245, 158, 11, 0.15);
  --theme-fertile: #10B981;
  --theme-fertile-light: rgba(16, 185, 129, 0.15);
  --theme-luteal: #8B5CF6;
  --theme-luteal-light: rgba(139, 92, 246, 0.15);
  --theme-follicular: #06B6D4;
  --theme-follicular-light: rgba(6, 182, 212, 0.15);
  
  --theme-bg: #0C0A14;
  --theme-surface: #141122;
  --theme-card: #1C182F;
  --theme-card-hover: #241F3C;
  --theme-border: #2B2547;
  --theme-border-light: rgba(255, 255, 255, 0.08);
  --theme-text: #F8FAFC;
  --theme-text-muted: #94A3B8;
  --theme-text-subtle: #64748B;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

/* Theme Presets */
body[data-theme="berry"] {
  --theme-primary: #E11D48;
  --theme-primary-hover: #BE123C;
  --theme-primary-light: rgba(225, 29, 72, 0.15);
  --theme-primary-border: rgba(225, 29, 72, 0.3);
  --theme-bg: #09050C;
  --theme-surface: #130B1A;
  --theme-card: #1E1228;
  --theme-card-hover: #291837;
  --theme-border: #351F47;
}

body[data-theme="lavender"] {
  --theme-primary: #8B5CF6;
  --theme-primary-hover: #7C3AED;
  --theme-primary-light: rgba(139, 92, 246, 0.15);
  --theme-primary-border: rgba(139, 92, 246, 0.3);
  --theme-bg: #0A0815;
  --theme-surface: #120F24;
  --theme-card: #1B1736;
  --theme-card-hover: #252049;
  --theme-border: #2D2758;
}

body[data-theme="mint"] {
  --theme-primary: #10B981;
  --theme-primary-hover: #059669;
  --theme-primary-light: rgba(16, 185, 129, 0.15);
  --theme-primary-border: rgba(16, 185, 129, 0.3);
  --theme-bg: #040E0C;
  --theme-surface: #0A1B17;
  --theme-card: #102923;
  --theme-card-hover: #183C34;
  --theme-border: #1F4C42;
}

body[data-theme="sunset"] {
  --theme-primary: #F97316;
  --theme-primary-hover: #EA580C;
  --theme-primary-light: rgba(249, 115, 22, 0.15);
  --theme-primary-border: rgba(249, 115, 22, 0.3);
  --theme-bg: #0F0A06;
  --theme-surface: #1B130D;
  --theme-card: #281C13;
  --theme-card-hover: #37261B;
  --theme-border: #473224;
}

/* Base resets & typography */
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.hidden {
  display: none !important;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  background-color: var(--theme-bg);
  color: var(--theme-text);
  font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--theme-border);
  border-radius: 9999px;
}

/* App container with max-width for desktop centered view */
#app-root {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 520px;
  margin: 0 auto;
  position: relative;
  background-color: var(--theme-surface);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.4);
}

/* Top App Bar */
.top-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: rgba(20, 17, 34, 0.88);
  border-bottom: 1px solid var(--theme-border-light);
  padding-top: max(0.75rem, var(--safe-top));
}

/* Bottom Navigation Bar */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 520px;
  z-index: 40;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(20, 17, 34, 0.94);
  border-top: 1px solid var(--theme-border-light);
  padding-bottom: max(0.5rem, var(--safe-bottom));
}

/* Nav Item active styles */
.nav-tab-btn {
  position: relative;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-tab-btn.active {
  color: var(--theme-primary);
}

.nav-tab-btn.active .nav-indicator {
  transform: scale(1);
  opacity: 1;
}

.nav-indicator {
  position: absolute;
  top: -4px;
  width: 24px;
  height: 3px;
  background: var(--theme-primary);
  border-radius: 9999px;
  transform: scale(0);
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 10px var(--theme-primary);
}

/* Circular Cycle Wheel */
.cycle-dial-container {
  position: relative;
  width: 280px;
  height: 280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cycle-dial-svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.cycle-track {
  fill: none;
  stroke: var(--theme-border);
  stroke-width: 14;
}

.cycle-progress {
  fill: none;
  stroke: var(--theme-primary);
  stroke-width: 14;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.cycle-dial-inner {
  position: absolute;
  inset: 24px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--theme-card) 0%, var(--theme-surface) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--theme-border-light);
}

/* Interactive Chips */
.tag-chip {
  padding: 0.5rem 0.85rem;
  border-radius: 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid var(--theme-border);
  background: var(--theme-card);
  color: var(--theme-text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: all 0.15s ease-out;
}

.tag-chip:hover {
  border-color: var(--theme-primary-border);
  color: var(--theme-text);
}

.tag-chip.active {
  background: var(--theme-primary-light);
  border-color: var(--theme-primary);
  color: var(--theme-primary);
  box-shadow: 0 0 12px var(--theme-primary-light);
}

/* Glass Cards */
.glass-card {
  background: var(--theme-card);
  border: 1px solid var(--theme-border);
  border-radius: 1.25rem;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.glass-card:active {
  transform: scale(0.99);
}

/* Bottom Sheet / Drawer Modal */
.bottom-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 50;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.bottom-sheet-backdrop.open {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.bottom-sheet-content {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 100%);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  background: var(--theme-surface);
  border-top-left-radius: 1.75rem;
  border-top-right-radius: 1.75rem;
  border-top: 1px solid var(--theme-border);
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
  z-index: 51;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.bottom-sheet-backdrop.open .bottom-sheet-content {
  transform: translate(-50%, 0);
}

.sheet-handle {
  width: 44px;
  height: 5px;
  background: var(--theme-border);
  border-radius: 9999px;
  margin: 0.75rem auto 0.25rem auto;
}

/* Toast Notifications */
.toast-msg {
  position: fixed;
  top: max(1rem, var(--safe-top));
  left: 50%;
  transform: translateX(-50%) translateY(-100px);
  z-index: 70;
  background: var(--theme-card);
  border: 1px solid var(--theme-primary-border);
  color: var(--theme-text);
  padding: 0.75rem 1.25rem;
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.toast-msg.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

/* Calendar styling */
.calendar-day-cell {
  aspect-ratio: 1;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
}

.calendar-day-cell:hover {
  background: var(--theme-card-hover);
}

.calendar-day-cell.today {
  border: 1.5px solid var(--theme-primary);
}

.calendar-day-cell.period-day {
  background: var(--theme-primary);
  color: #FFFFFF !important;
  font-weight: 700;
  box-shadow: 0 2px 8px var(--theme-primary-light);
}

.calendar-day-cell.predicted-period {
  background: var(--theme-primary-light);
  color: var(--theme-primary);
  border: 1px dashed var(--theme-primary);
}

.calendar-day-cell.fertile-day {
  background: var(--theme-fertile-light);
  color: var(--theme-fertile);
}

.calendar-day-cell.ovulation-day {
  background: var(--theme-ovulation-light);
  color: var(--theme-ovulation);
  border: 1.5px solid var(--theme-ovulation);
  font-weight: 700;
}

.calendar-day-cell.pms-day {
  background: var(--theme-luteal-light);
  color: var(--theme-luteal);
}

.day-dot {
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  margin: 1px;
}

/* PIN Lock Screen */
#pin-lock-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--theme-bg);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

#pin-lock-screen.active {
  display: flex !important;
}

#pin-lock-screen.hidden {
  display: none !important;
}

.pin-digit-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--theme-primary);
  transition: all 0.2s ease;
}

.pin-digit-dot.filled {
  background: var(--theme-primary);
  box-shadow: 0 0 10px var(--theme-primary);
}

.pin-key-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--theme-card);
  border: 1px solid var(--theme-border);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--theme-text);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.pin-key-btn:active {
  background: var(--theme-primary-light);
  border-color: var(--theme-primary);
  transform: scale(0.92);
}

/* Hormone Graph Wave */
.hormone-wave-svg {
  width: 100%;
  height: 90px;
  overflow: visible;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.25s ease-out forwards;
}

/* Fallback utilities */
.text-primary { color: var(--theme-primary); }
.bg-primary { background-color: var(--theme-primary); }
.border-primary { border-color: var(--theme-primary); }

@media print {
  body { background: #FFFFFF !important; color: #000000 !important; }
  .top-nav, .bottom-nav, .no-print { display: none !important; }
  #app-root { max-width: 100% !important; box-shadow: none !important; }
  .glass-card { border: 1px solid #CCCCCC !important; background: #FFFFFF !important; color: #000000 !important; break-inside: avoid; }
}
"""

with open("css/styles.css", "w", encoding="utf-8") as f:
    f.write(css_code)

print("css/styles.css updated with proper display states!")