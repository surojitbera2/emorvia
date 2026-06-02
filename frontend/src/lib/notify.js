// Lightweight Notification API helper. For true backgrounded push (tab closed)
// you'll need a service worker + VAPID push subscription — deferred to
// the Node backend deployment phase.

export const notify = {
  async requestPermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try { return await Notification.requestPermission(); }
    catch { return "denied"; }
  },
  show(title, body, opts = {}) {
    if (!("Notification" in window)) return null;
    if (Notification.permission !== "granted") return null;
    try {
      const n = new Notification(title, {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: opts.tag || "emorvia",
        requireInteraction: opts.requireInteraction || false,
      });
      if (opts.onClick) n.onclick = (e) => { e.preventDefault(); window.focus(); opts.onClick(); n.close(); };
      if (opts.autoCloseMs) setTimeout(() => { try { n.close(); } catch {} }, opts.autoCloseMs);
      return n;
    } catch { return null; }
  },
};
