# DialPro Node.js Backend

Express + Socket.io + MongoDB backend for the **DialPro** mobile-first video call PWA.

> This backend is **not** hosted on the Emergent preview environment (which is pinned to Python/FastAPI). Deploy this folder externally (Render / Railway / Fly.io / VPS).

## Quick start (local)
```bash
cd node-backend
cp .env.example .env       # then edit values
npm install
npm run dev                # nodemon hot-reload on :8080
```
You need a MongoDB instance reachable via `MONGO_URL` (local mongod or MongoDB Atlas).

## Connecting the React PWA
The PWA reads its backend URL from `frontend/.env`:
```
REACT_APP_BACKEND_URL=https://your-node-backend.example.com
```
Set this to the URL of your deployed Node backend, then rebuild/redeploy the frontend.

All HTTP routes are prefixed with `/api`. Socket.io listens on the same host.

## Deploy on Render (free tier)
1. Push the `node-backend/` folder to a GitHub repo.
2. Render → New → Web Service → connect repo.
3. Build command: `npm install` · Start: `npm start`
4. Set env vars from `.env.example` (use MongoDB Atlas for `MONGO_URL`).
5. Note the public URL → paste into the frontend `.env`.

## Routes
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | — | User signup (mobile+password) |
| POST | /api/auth/login | — | User login |
| POST | /api/provider/login | — | Provider login |
| POST | /api/admin/login | — | Admin login |
| GET | /api/providers | — | List providers |
| GET | /api/providers/:id | — | Provider details |
| GET | /api/me | user | Self |
| GET | /api/me/txns | user | Transactions |
| POST | /api/recharge | user | Submit UPI recharge request |
| POST | /api/call/log | user | Persist call + bill wallet |
| GET | /api/admin/users | admin | List users |
| GET/POST/PATCH/DELETE | /api/admin/providers[/:id] | admin | Manage providers |
| GET | /api/admin/recharges | admin | List requests |
| POST | /api/admin/recharges/:id/approve | admin | Approve recharge |
| POST | /api/admin/recharges/:id/reject | admin | Reject |
| GET | /api/payments/settings | — | UPI settings |
| PUT | /api/admin/payments/settings | admin | Update UPI/QR |

## Socket.io events
`register` · `call_request` · `call_accept` · `call_reject` · `webrtc_offer` · `webrtc_answer` · `webrtc_ice` · `call_end`

Note: For WebRTC across NATs in production you'll need TURN servers (e.g., [Twilio Network Traversal](https://www.twilio.com/stun-turn) or [metered.ca](https://www.metered.ca)). For same-network LAN demos STUN-only works.

## Admin credentials
Default: `admindash` / `Admin#2026*` — change in `.env` before going live.
