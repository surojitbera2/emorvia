# EMORVIA — Product Requirements Doc

## Original problem statement (updated)
> Rebrand `bongobandhu` (Node-backend + React frontend) app to EMORVIA.
> Branding: name = EMORVIA, privacy = https://emorvia.in/privacy-policy/, dark palette (Body #101428, Card #171C33, Text #F2F5FF / #A9B1CC / #6E7694).
> OTP API (MessageCentral, Customer ID C-E2EDF3036EDD41B) for one-tap auth — single mobile login/register flow for everyone.
> Percentage-based payout — admin sets global split (40/60 default), per-provider override allowed.
> Separate per-minute rates for Video Call and Chat — both editable by provider AND admin.
> Chat feature — same billing model as video call, separate rate.
> Remove support phone numbers from user dashboard.
> Persistent session — never auto-logout except on explicit logout.

## Architecture
- **Node-backend** (Express + Socket.io + Mongoose) at `/app/node-backend/server.js`, port 8001 via Python `os.execvp` shim at `/app/backend/server.py` (preserves supervisor's `backend` slot without modifying read-only config)
- **Frontend** React 19 + Tailwind 3 (CRA via react-scripts) at `/app/frontend`
- **MongoDB** local at `mongodb://localhost:27017/emorvia`
- **Real-time** Socket.io for call/chat signalling + presence
- **OTP** MessageCentral REST
- **JWT** 365-day expiry; session in localStorage (`emorvia_token`, `emorvia_session`)

## User personas
- **User** — one-tap OTP signup, recharges wallet, calls or chats with providers
- **Provider (listener)** — accepts incoming calls/chats; sets own ₹/min for Video Call AND ₹/min for Chat
- **Admin** — manages providers, sets global payout %, per-provider rates / share overrides

## Core feature set
- ✅ EMORVIA branding everywhere
- ✅ Dark theme palette + accent `#6FA8FF` & `#3DDC97`
- ✅ Single-CTA Welcome page (no password options, no listener-login link)
- ✅ OTP-only auth via MessageCentral (`/login` and `/provider/login` redirect to `/register`)
- ✅ Persistent session — JWT 365d; only `isAuthError` (401/403) clears session
- ✅ Privacy policy → https://emorvia.in/privacy-policy/
- ✅ Per-minute billing: `amount = ceil(sec/60) × rateForChannel(provider, channel)`
- ✅ **Separate rates per channel**:
  - `callPerMinRate` for video call (default 20)
  - `chatPerMinRate` for chat (default 10)
  - Legacy `perMinRate` mirrored to `callPerMinRate` for back-compat
- ✅ **Percentage payout**:
  - `effectiveSharePct = provider.sharePctOverride ?? global providerSharePct` (default 60)
  - Provider earns `realUsed × effectiveSharePct%`
- ✅ Admin Payments → Global Payout Split slider with Provider/Admin % display
- ✅ Admin Providers → 3 fields per provider (call rate, chat rate, share override) + table column shows both rates
- ✅ Provider Profile Edit → two inputs (video call rate, chat rate)
- ✅ **Chat feature** — same billing model as video, separate rate
  - Socket: `chat_request/accept/reject/message/typing/end`
  - User screen `/chat/:providerId` (uses chatPerMinRate)
  - Provider screen `/provider/chat/:userId` (live earnings meter)
  - `CallLog.channel: "call" | "chat"` distinguishes session type
- ✅ User Dashboard — support phone numbers banner removed

## What's been implemented
- [2026-01 iter 1] Full rebrand + dark palette + Welcome redesign + OTP auth + percentage payout system (replaced legacy packages)
- [2026-01 iter 1] Provider perMinRate + admin sharePctOverride; AdminPayments slider; AdminProviders edit dialog
- [2026-01 iter 2] Single-CTA Welcome, `/login` & `/provider/login` redirect, Login.jsx removed
- [2026-01 iter 2] Auth-aware error handling (only isAuthError clears session)
- [2026-01 iter 2] Chat feature end-to-end (sockets + ChatScreen + ProviderChatScreen + Start Chat button)
- [2026-01 iter 3] **Split rates** — `callPerMinRate` and `chatPerMinRate` separately editable by both provider and admin
- [2026-01 iter 3] Removed support phone banner from `/app` (UserDashboard)
- [2026-01 iter 3] DB migration: populated `callPerMinRate` and `chatPerMinRate` on all 6 seeded providers

## Backlog (prioritised)
- **P1** — Per-mobile OTP send cooldown (30–60s) to prevent SMS abuse
- **P1** — Idempotent ₹50 welcome-bonus on repeat OTP verify
- **P2** — Return 404 from `PATCH /api/admin/providers/:id` for unknown id
- **P2** — Deprecate legacy `perMinRate` field on Provider schema (testing agent suggested)
- **P2** — Stricter AdminLayout role-check before child route render
- **P2** — Split monolithic `server.js` (~2280 lines) into routers
- **P3** — Chat history persistence (currently ephemeral)
- **P3** — Listener monthly payout statements (PDF)
- **P3** — Multi-language UI (Hindi, Bengali)

## Next tasks
- Validate: should chat support media (image/voice note) or stay text-only?
- Validate: should chat sessions be persisted for history/replay?
