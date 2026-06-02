# DialPro Deployment Guide

## A. Deploy Node.js backend on Render (5 min)

### 1. MongoDB Atlas (free tier)
- Sign up at https://www.mongodb.com/cloud/atlas → create M0 free cluster.
- Database Access → add user (e.g. `dialpro` / strong password).
- Network Access → allow `0.0.0.0/0` (or restrict to Render IPs).
- Clusters → Connect → Drivers → copy connection string. Replace `<password>` and append `/dialpro?retryWrites=true&w=majority`.

### 2. Render
- Push `/app/node-backend` to a GitHub repo (or zip + upload).
- Render → New → Web Service → connect repo (root = `node-backend`).
- Build: `npm install` · Start: `npm start` · Region: closest to your users.
- Environment variables:
  | KEY | VALUE |
  |---|---|
  | `MONGO_URL` | your Atlas connection string |
  | `JWT_SECRET` | a long random string |
  | `ADMIN_USERNAME` | `admindash` |
  | `ADMIN_PASSWORD` | `Admin#2026*` |
  | `CORS_ORIGIN` | `https://top-up-selector.preview.emergentagent.com` |
- Deploy. Note the public URL, e.g. `https://dialpro-backend.onrender.com`.

### 3. Verify
```bash
curl https://dialpro-backend.onrender.com/api/health
# → {"ok":true}
```

## B. Point the React PWA at your backend
Edit `/app/frontend/.env`:
```
REACT_APP_BACKEND_URL=https://dialpro-backend.onrender.com
```
Restart frontend (`sudo supervisorctl restart frontend`).

## C. Switch the data layer from localStorage → REST + Socket.io
The current frontend uses localStorage (file: `src/lib/store.js`) and BroadcastChannel signaling (`src/lib/signaling.js`). To go live:
1. Replace `signaling.js` content with a Socket.io-client wrapper that emits the **same event names**:
   ```js
   import { io } from "socket.io-client";
   const socket = io(process.env.REACT_APP_BACKEND_URL, { transports: ["websocket"] });
   export const signaling = {
     connect: (id) => socket.emit("register", { id }),
     on: (type, fn) => { socket.on(type, fn); return () => socket.off(type, fn); },
     send: (type, to, payload) => socket.emit(type, { to, ...payload }),
     disconnect: () => socket.disconnect(),
   };
   export const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
   ```
   Then `yarn add socket.io-client`.
2. Replace `store.js` calls with `axios` calls against the routes in `node-backend/server.js`.

## D. TURN server for production WebRTC across NATs
STUN alone is fine on same network. For mobile networks behind carrier-grade NAT:
- Twilio Network Traversal Service (paid, reliable)
- metered.ca (free tier, 50 GB/mo)
- Self-host coturn

Add the TURN entries to `ICE_CONFIG.iceServers` in `signaling.js`.

## E. PWA "Add to Home Screen"
Already configured: `/public/manifest.json` + `/public/icon.svg` + service worker `/public/sw.js`. Service worker is registered only in production builds. To install: open the deployed site → browser menu → "Install app".
