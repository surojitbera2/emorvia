# EMORVIA — Product Requirements Doc

## Original problem statement (updated)
> Rebrand existing `bongobandhu` (Node-backend + React frontend) app to EMORVIA.
> 1. Redesign landing page using Clarity attachment as style reference (keep existing content)
> 2. Brand name: EMORVIA
> 3. Privacy policy link: https://emorvia.in/privacy-policy/
> 4. New color palette — Body #101428, Card #171C33, Text Primary #F2F5FF, Text Secondary #A9B1CC, Text Muted #6E7694
> 5. OTP API from messagecentral.com for USER REGISTRATION (Customer ID: C-E2EDF3036EDD41B)
> 6. Provider payout percentage — Admin sets global (default 40/60), per-provider override; provider can set own per-minute call charge from profile, admin can also edit.
> 7. Iteration 2 additions:
>    - Remove "I already have an account" and "Are you a listener?" links from Welcome — single CTA only
>    - No password option anywhere — OTP-only one-tap login/register
>    - Never auto-logout (session persists until user clicks Logout)
>    - Chat feature between User and Provider with same billing model as video calls

## Architecture
- **Node-backend** (Express + Socket.io + Mongoose) at `/app/node-backend/server.js`, port 8001
  - Runs via Python shim at `/app/backend/server.py` that `os.execvp`s into Node (reuses supervisor's `backend` slot without modifying read-only supervisord config)
- **Frontend** React 19 + Tailwind 3 (CRA via react-scripts) at `/app/frontend`
- **MongoDB** local at `mongodb://localhost:27017/emorvia`
- **Real-time**: Socket.io for call signalling + chat messaging + presence
- **OTP**: MessageCentral REST (https://cpaas.messagecentral.com)
- **JWT**: 365-day expiry; session in localStorage (`emorvia_token`, `emorvia_session`)

## User personas
- **User (caller)** — OTP signup once, recharges wallet, calls or chats with providers
- **Provider (listener)** — accepts incoming calls/chats, sets own ₹/min rate, earns share of each session
- **Admin** — manages providers, sets global payout %, configures payments

## Core feature set
- ✅ EMORVIA branding across all pages
- ✅ Dark theme palette (Body / Card / Text) + accent `#6FA8FF` & `#3DDC97`
- ✅ Welcome page — single "Continue with mobile number" CTA
- ✅ OTP-only auth via MessageCentral (no password UI anywhere)
- ✅ Persistent session — JWT 365d, never auto-logout on transient errors (only `isAuthError` clears session)
- ✅ Privacy policy URL → https://emorvia.in/privacy-policy/ everywhere
- ✅ Per-minute billing: `amount = ceil(durationSec/60) × provider.perMinRate`
- ✅ Percentage payout: provider earns `realUsed × effectiveSharePct%`
  - `effectiveSharePct = provider.sharePctOverride ?? global providerSharePct` (default 60)
- ✅ Admin Payments page → Global Payout Split slider with Provider/Admin % display
- ✅ Admin Providers panel → per-provider `perMinRate` + `sharePctOverride`
- ✅ Provider Profile Edit → provider sets own `perMinRate`
- ✅ **Chat feature** (iter 2):
  - Same billing model as video call — per-minute × share%
  - Socket events: `chat_request`, `chat_accept`, `chat_reject`, `chat_message`, `chat_typing`, `chat_end`
  - `CallLog.channel: "call" | "chat"` field distinguishes session type
  - User screen: `/chat/:providerId` (ChatScreen.jsx)
  - Provider screen: `/provider/chat/:userId` (ProviderChatScreen.jsx)
  - Live billing meter, typing indicator, auto-end on wallet exhaustion

## What's been implemented (2026-01)
- [2026-01] Full rebrand + dark palette + new Welcome
- [2026-01] OTP-based register via MessageCentral; bypass accounts for testing
- [2026-01] Provider perMinRate + admin sharePctOverride; replaced packages with single sharePct
- [2026-01] AdminPayments slider UI, AdminProviders edit dialog gains rate/override fields
- [2026-01] CallScreen + ProviderCallScreen migrated to per-minute math
- [2026-01] Backend test suite (`/app/backend/tests/test_emorvia_backend.py`) — 18/18 pass
- [2026-01] **Iter 2**: Single-CTA Welcome, `/login` & `/provider/login` redirect to `/register`, Login.jsx removed
- [2026-01] **Iter 2**: Auth-aware error handling — only `isAuthError` (401/403) clears session
- [2026-01] **Iter 2**: Chat feature end-to-end — socket handlers + ChatScreen + ProviderChatScreen + Start Chat button on profile

## Backlog (prioritised)
- **P1** — Per-mobile OTP cooldown (30–60s) on `/api/auth/otp/send` to prevent SMS abuse
- **P1** — Idempotent ₹50 welcome-bonus on first OTP verify per mobile
- **P2** — Return 404 from `PATCH /api/admin/providers/:id` for unknown id
- **P2** — Split monolithic `server.js` (now 2261 lines) into routers (auth, admin, provider, calls, chat, billing)
- **P2** — Stricter AdminLayout role-check before child route render (testing agent flagged a potential information-leak window)
- **P2** — Refactor: extract shared session/billing hook to dedupe CallScreen / ChatScreen logic
- **P3** — Chat history page (persisted message log) — currently messages are ephemeral
- **P3** — Real-time WebRTC quality metrics dashboard for admin
- **P3** — Listener monthly payout statements (PDF)
- **P3** — Multi-language UI (Hindi, Bengali)

## Next tasks
- Validate with user: should the chat feature include image / voice-note support, or strictly text?
- Validate: should chat messages persist beyond the session (for history/replay), or stay ephemeral?
