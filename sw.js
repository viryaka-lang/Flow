// FlowSync PWA Service Worker
const CACHE_NAME = "flowsync-pwa-v1.0.0";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/db.js",
  "./js/engine.js",
  "./js/icons.js",
  "./js/ui/dashboard.js",
  "./js/ui/calendar.js",
  "./js/ui/logger.js",
  "./js/ui/analytics.js",
  "./js/ui/profiles.js",
  "./js/ui/reports.js",
  "./js/ui/settings.js",
  "./js/ui/pwa.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Pre-caching offline assets");
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn("[ServiceWorker] Precache note:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "FlowSync Reminder", body: "Check in on your cycle health today!" };
  const options = {
    body: data.body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: "./index.html" }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("index.html") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("./index.html");
      }
    })
  );
});