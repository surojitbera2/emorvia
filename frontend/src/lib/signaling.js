// Socket.io-client signaling — same API surface used by CallScreen,
// ProviderCallScreen, ProviderHome:
//   signaling.connect(peerId)
//   signaling.send(eventName, toPeerId, payload)
//   signaling.on(eventName, fn) → unsubscribe fn
//   await signaling.ready()

import { io } from "socket.io-client";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

const EVENTS = [
  "call_request", "call_accept", "call_reject",
  "webrtc_offer", "webrtc_answer", "webrtc_ice", "call_end",
];

const listeners = new Map(); // eventName -> Set<fn>
let socket = null;
let myId = null;
let readyResolvers = [];

const ensureSocket = () => {
  if (socket) return socket;
  socket = io(BACKEND, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  socket.on("connect", () => {
    if (myId) socket.emit("register", { id: myId });
    readyResolvers.forEach((r) => r());
    readyResolvers = [];
  });
  EVENTS.forEach((ev) => {
    socket.on(ev, (data) => {
      const set = listeners.get(ev);
      if (set) set.forEach((fn) => fn(data || {}));
    });
  });
  return socket;
};

export const signaling = {
  connect(id) {
    if (!id) return;
    if (myId === id && socket && socket.connected) return;
    myId = id;
    const s = ensureSocket();
    if (s.connected) s.emit("register", { id });
  },
  disconnect() {
    myId = null;
    if (socket) { try { socket.disconnect(); } catch {} }
    socket = null;
    listeners.clear();
    readyResolvers = [];
  },
  ready() {
    if (socket && socket.connected) return Promise.resolve();
    ensureSocket();
    return new Promise((r) => readyResolvers.push(r));
  },
  send(event, to, payload = {}) {
    const s = ensureSocket();
    const msg = { to, ...payload };
    if (s.connected) s.emit(event, msg);
    else s.once("connect", () => s.emit(event, msg));
  },
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
};

export const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    // 👉 Add TURN here for production (e.g., metered.ca):
    // { urls: "turn:a.relay.metered.ca:80", username: "...", credential: "..." },
  ],
};
