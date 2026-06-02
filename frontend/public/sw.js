// Bongo Bandhu PWA service worker — caching + Web Push handler.
const CACHE = "bongobandhu-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
  "/favicon-16.png",
  "/ringtone.wav",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("/")))
  );
});

// Notify all open clients (e.g. minimized WebView with active socket) so the
// app can start its in-app ringtone immediately, in addition to the OS notification.
const notifyClients = async (message) => {
  try {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    list.forEach((c) => { try { c.postMessage(message); } catch {} });
  } catch {}
};

// ----- Web Push: Incoming call notification (with sound + vibration + ringtone) -----
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } catch { data = { title: "Bongo Bandhu", body: event.data.text() }; }
  }
  const isCall = data.type === "incoming_call";
  const title = data.title || "Bongo Bandhu";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    image: isCall ? "/icon-512.png" : undefined,
    tag: data.tag || "bongobandhu-notification",
    renotify: isCall, // re-alert if a previous notification with same tag exists
    requireInteraction: isCall, // notification persists until user acts
    vibrate: isCall
      ? [500, 250, 500, 250, 500, 250, 500, 250, 500, 250, 500]
      : [200, 100, 200],
    data: data,
    actions: isCall
      ? [
          { action: "accept", title: "Open call" },
          { action: "reject", title: "Dismiss" },
        ]
      : [],
    silent: false,
    timestamp: Date.now(),
  };

  // Show OS notification AND signal in-app clients to start ringtone
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    isCall ? notifyClients({ type: "incoming-call-push", data }) : Promise.resolve(),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  // If user tapped "Dismiss", just close — do not focus the app
  if (action === "reject") {
    event.waitUntil(notifyClients({ type: "notification-dismiss", data }));
    return;
  }
  const target = data.type === "incoming_call" ? "/provider" : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          c.postMessage({ type: "notification-click", data, action });
          if ("focus" in c) return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  // Tell clients to stop ringtone when notification is dismissed
  const data = event.notification.data || {};
  if (data.type === "incoming_call") {
    notifyClients({ type: "notification-dismiss", data });
  }
});
