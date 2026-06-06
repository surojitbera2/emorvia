// FCM (Firebase Cloud Messaging) bootstrap for the Capacitor Android app.
//
// Behaviour:
//   - On native Android only: request push permission, register with FCM, send the
//     resulting device token to the Emorvia backend so the server can target it.
//   - On web/browser: silently no-op (the existing service-worker + VAPID Web Push
//     flow handles desktop / PWA notifications).
//   - Listens for incoming foreground notifications and dispatches in-app events so
//     React screens can react (e.g. show in-app banner / play ringtone).
//
// Call `initFcm()` once the provider is signed in (e.g. inside ProviderHome).
// Call `disableFcm()` on logout to unregister the current device token.

import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./store";

let _initStarted = false;
let _currentToken = null;
let _listeners = [];

const isNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

export async function initFcm({ verbose = false } = {}) {
  if (_initStarted) return _currentToken;
  _initStarted = true;

  if (!isNative()) {
    if (verbose) console.log("[FCM] not a native platform — skipping");
    return null;
  }

  try {
    // Permissions
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("[FCM] permission not granted:", perm.receive);
      return null;
    }

    // Register listeners BEFORE register() so we don't miss the registration event.
    const onRegistration = await PushNotifications.addListener("registration", async (token) => {
      const t = token?.value || "";
      if (!t) return;
      _currentToken = t;
      if (verbose) console.log("[FCM] token:", t.slice(0, 20) + "...");
      try {
        await api.fcmRegister(t, "android");
        if (verbose) console.log("[FCM] token sent to server");
      } catch (e) {
        console.warn("[FCM] could not send token to server:", e?.message);
      }
    });

    const onError = await PushNotifications.addListener("registrationError", (err) => {
      console.warn("[FCM] registrationError:", err?.error || err);
    });

    // Foreground (data) notification — show in-app banner / dispatch custom event.
    const onForeground = await PushNotifications.addListener("pushNotificationReceived", (notif) => {
      const data = notif?.data || {};
      window.dispatchEvent(new CustomEvent("emorviaFcmForeground", { detail: { notif, data } }));
    });

    // User tapped a notification (only fires for visible notifications, not for our
    // data-only call/chat messages handled natively, but useful for chat tap-through).
    const onAction = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action?.notification?.data || {};
      if (data.type === "incoming_call") {
        window.dispatchEvent(new CustomEvent("emorviaAcceptCall", { detail: data }));
      } else if (data.type === "incoming_chat" || data.type === "chat_message") {
        window.dispatchEvent(new CustomEvent("emorviaOpenChat", { detail: data }));
      }
    });

    _listeners.push(onRegistration, onError, onForeground, onAction);

    // Finally, register.
    await PushNotifications.register();

    return _currentToken;
  } catch (e) {
    console.warn("[FCM] init failed:", e?.message);
    return null;
  }
}

export async function disableFcm() {
  if (!isNative()) return;
  try {
    if (_currentToken) {
      try { await api.fcmUnregister(_currentToken); } catch (_e) { /* ignore */ }
    }
    for (const l of _listeners) {
      try { await l.remove(); } catch (_e) { /* ignore */ }
    }
    _listeners = [];
    _currentToken = null;
    _initStarted = false;
  } catch (e) {
    console.warn("[FCM] disable failed:", e?.message);
  }
}

export function getCurrentFcmToken() { return _currentToken; }
