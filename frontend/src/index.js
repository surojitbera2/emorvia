import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
// NOTE: StrictMode intentionally OFF — it double-mounts components in dev which
// races with our WebSocket signaling (causing call_request to be sent during a
// half-open socket and getting dropped). Production behaviour is unaffected.
root.render(<App />);

// Register Service Worker in production (Web Push + offline cache).
// Also register in development for testing push notifications via WebView/devices.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
