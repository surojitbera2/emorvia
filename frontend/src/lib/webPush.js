// Web Push subscription helper for providers.
// Usage: await webPush.subscribe()
import { api } from "./store";

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const webPush = {
  isSupported() {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
  },
  permission() {
    return typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  },
  async subscribe() {
    if (!this.isSupported()) throw new Error("Push not supported on this device");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notification permission denied");

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await api.pushVapidKey();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    await api.pushSubscribe(sub.toJSON());
    return sub;
  },
  async unsubscribe() {
    if (!this.isSupported()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
    } catch { /* silent */ }
  },
};
