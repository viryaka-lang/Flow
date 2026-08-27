// FlowSync PWA, Notifications & Vibration Haptics
export class PWAController {
  static deferredPrompt = null;

  static init() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").then((reg) => {
        console.log("[PWA] ServiceWorker registered with scope:", reg.scope);
      }).catch(err => {
        console.warn("[PWA] ServiceWorker registration failed:", err);
      });
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById("pwa-install-banner");
      if (installBtn) installBtn.classList.remove("hidden");
    });

    window.addEventListener("online", () => this.showToast("Back online", "check"));
    window.addEventListener("offline", () => this.showToast("Working offline (Data saved locally)", "info"));
  }

  static async promptInstall() {
    if (!this.deferredPrompt) {
      alert("To install FlowSync on Android:\n1. Tap the browser menu (⋮)\n2. Tap 'Install app' or 'Add to Home Screen'");
      return;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log("[PWA] Install prompt outcome:", outcome);
    this.deferredPrompt = null;
    const banner = document.getElementById("pwa-install-banner");
    if (banner) banner.classList.add("hidden");
  }

  static vibrate(pattern = [30]) {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  static showToast(message, iconName = "check") {
    const toast = document.getElementById("toast-container");
    if (!toast) return;
    toast.innerHTML = `<span class="text-primary font-bold">●</span> <span>${message}</span>`;
    toast.classList.add("show");
    this.vibrate([20]);
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }
}
