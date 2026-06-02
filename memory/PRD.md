# EMORVIA — Product Requirements Doc

## Iterations completed (2026-01)
- **Iter 1** — Full rebrand to EMORVIA, dark palette, OTP auth via MessageCentral, percentage-based payout replacing fixed packages
- **Iter 2** — Single-CTA Welcome, password UI removed, persistent session, Chat feature with same billing model as video
- **Iter 3** — Separate `callPerMinRate` + `chatPerMinRate` per provider, support phone banner removed from user dashboard
- **Iter 4** — OTP send cooldown (60s), idempotent welcome bonus, chat message persistence + history page, dedicated provider register & login pages, legacy `perMinRate` deprecated

## Architecture
- **Node-backend** (Express + Socket.io + Mongoose) on port 8001 via Python `execvp` shim
- **Frontend** React 19 + Tailwind 3 at `/app/frontend`
- **MongoDB** local at `mongodb://localhost:27017/emorvia`
- **Real-time** Socket.io for call + chat + presence; on register the client sends `{id, role}` so server can resolve sender role for chat persistence
- **OTP** MessageCentral REST
- **JWT** 365-day expiry; localStorage keys: `emorvia_token`, `emorvia_session`

## User personas
- **User** — OTP-only signup (10-digit mobile + SMS code), ₹50 welcome bonus on first verify (idempotent), recharges wallet, calls / chats with listeners
- **Provider (Listener)** — has dedicated emerald-themed `/provider/register` and `/provider/login` pages; sets own per-minute rates (call + chat); admin can also edit. New providers land in `status: 'pending'` until admin activates.
- **Admin** — manages providers, payments, payouts; sets global payout %

## Core features
| Area | Status |
|---|---|
| EMORVIA branding (logo, copy, manifest) | ✅ |
| Dark theme (#101428 / #171C33 / #F2F5FF / #A9B1CC / #6E7694) | ✅ |
| Privacy URL → https://emorvia.in/privacy-policy/ | ✅ |
| OTP-only auth (no password UI anywhere) | ✅ |
| **OTP send cooldown** — 60s per (mobile, role); bypass accounts immune | ✅ Iter 4 |
| **Idempotent welcome bonus** — User.welcomeBonusGiven flag; exactly one ₹50 credit per mobile | ✅ Iter 4 |
| Persistent session — JWT 365d, only `isAuthError` clears | ✅ |
| Per-minute billing | ✅ |
| **Separate Call vs Chat rates** — callPerMinRate, chatPerMinRate | ✅ Iter 3 |
| Percentage payout — global % + per-provider override | ✅ |
| Admin Payments slider + Admin Providers per-provider rate / share fields | ✅ |
| Provider Profile Edit — provider sets own rates | ✅ |
| Video call (WebRTC) | ✅ |
| Real-time text Chat | ✅ Iter 2 |
| **Chat persistence + history page** — ChatMessage collection, GET /api/chat/threads, GET /api/chat/messages, ChatHistory.jsx UI | ✅ Iter 4 |
| **Dedicated Provider register/login** — `/provider/register` and `/provider/login` (ProviderAuth.jsx) with emerald theme | ✅ Iter 4 |
| Legacy `perMinRate` field deprecated — read-only fallback, no writes | ✅ Iter 4 |
| Support phone banner removed from /app | ✅ Iter 3 |

## Backlog (prioritised)
- **P2** — Return 404 from `PATCH /api/admin/providers/:id` for unknown id
- **P2** — Stricter AdminLayout role-check before child route render
- **P2** — Split monolithic `server.js` (~2400 lines) into routers
- **P2** — Tighten `/chats` empty-state CTA copy (link to discover)
- **P3** — Chat media (image / voice-note) — currently text-only
- **P3** — Listener monthly payout PDF statements
- **P3** — Multi-language UI (Hindi, Bengali)
- **P3** — Drop legacy `perMinRate` field from Provider schema entirely after a few migration cycles

## Test surface
- `/app/backend/tests/test_emorvia_backend.py` — 41 tests pass / 1 intentional skip
- `/app/test_reports/iteration_{1-4}.json` — per-iteration reports

## Next tasks
- (Optional) Wire P2 items above when user picks them up
- Validate with user whether chat needs media support or stays text-only
