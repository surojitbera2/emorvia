# EMORVIA — Product Requirements Doc

## Original problem statement
> Rebrand existing `bongobandhu` (Node-backend + React frontend) app to EMORVIA.
> 1. Redesign landing page using Clarity attachment as style reference (keep existing content)
> 2. Brand name: EMORVIA
> 3. Privacy policy link: https://emorvia.in/privacy-policy/
> 4. New color palette — Body #101428, Card #171C33, Text Primary #F2F5FF, Text Secondary #A9B1CC, Text Muted #6E7694
> 5. OTP API from messagecentral.com for USER REGISTRATION ONLY
>    - Customer ID: C-E2EDF3036EDD41B (token in /app/node-backend/.env)
> 6. Provider payout percentage (replace fixed package rates):
>    - Admin sets global payout % (default 60% provider / 40% admin)
>    - Per-provider sharePctOverride supported
> 7. Per-minute call charge:
>    - Provider sets own from their profile
>    - Admin can also set/edit per provider

## Architecture
- **Node-backend** (Express + Socket.io + Mongoose) at `/app/node-backend/server.js`, port 8001
  - Runs via a thin Python shim at `/app/backend/server.py` that `os.execvp`s into Node (preserves supervisor's `backend` program slot without modifying read-only supervisord config)
- **Frontend** React 19 + Tailwind 3 (CRA via react-scripts) at `/app/frontend`
- **MongoDB** local at `mongodb://localhost:27017/emorvia`
- **Real-time**: Socket.io for call signalling + presence
- **OTP**: MessageCentral REST (https://cpaas.messagecentral.com)

## User personas
- **User (caller)** — signs up via OTP, recharges wallet, calls providers
- **Provider (listener)** — sets own ₹/min rate, online/offline, earns share of each call
- **Admin** — manages providers, sets global payout %, configures payments

## Core feature set
- ✅ EMORVIA branding (logo, copy, manifest, page title) across all pages
- ✅ Dark theme palette applied globally (Body / Card / Text)
- ✅ Fresh accent: cool blue `#6FA8FF` (primary) + emerald `#3DDC97` (success/positive)
- ✅ New Welcome page — hero "Real talk, real listeners." with ambient blue/teal aurora and dot grid
- ✅ Register via MessageCentral OTP (bypass numbers `7777777777`/`2411`, `6666666666`/`0401` for tests)
- ✅ Password Login retained for existing users + listeners
- ✅ Privacy policy URL → https://emorvia.in/privacy-policy/ everywhere
- ✅ Backend: per-minute billing — `amount = ceil(durationSec/60) × provider.perMinRate`
- ✅ Backend: percentage payout — provider earns `realUsed × effectiveSharePct%` (bonusBalance calls don't earn provider revenue)
- ✅ Effective share = `provider.sharePctOverride ?? global providerSharePct`
- ✅ Admin Payments page → Global Payout Split slider (0–100%) with live Provider/Admin % display
- ✅ Admin Providers page → table column "Rate / Share" + edit dialog has Per-min rate + Payout share override
- ✅ Provider Profile Edit → Per-minute call charge field
- ✅ User dashboard provider cards show `₹X/min` badge
- ✅ Call screen recalculates `currentAmount` and `maxSec` from `perMinRate` × wallet

## What's been implemented (2026-01)
- [2026-01] Full rebrand from "Bongo Bandhu"/"Navya" → "EMORVIA" across UI + backend strings + email/UPI defaults
- [2026-01] Color palette swap (sed across `/app/frontend/src`) + tailwind tokens in `index.css`
- [2026-01] New Welcome.jsx with EMORVIA hero, aurora backdrop, dot grid, Sora typography
- [2026-01] Register.jsx switched to OTP-only auth (MessageCentral)
- [2026-01] Provider schema: added `perMinRate` (default 20) and `sharePctOverride` (nullable)
- [2026-01] Removed legacy `packages` from billing settings; replaced with single `providerSharePct`
- [2026-01] AdminPayments: Global Payout Split slider replaces packages config
- [2026-01] AdminProviders: edit dialog gains Per-min rate + Payout share override fields; list shows Rate / Share column
- [2026-01] ProviderProfileEdit: Provider can set own perMinRate
- [2026-01] CallScreen + ProviderCallScreen: switched from package matching to per-minute billing math
- [2026-01] DB migration: old `billing.packages` field removed on next backend boot (one-time)
- [2026-01] Backend test suite added at `/app/backend/tests/test_emorvia_backend.py` (14/14 pass)

## Backlog (prioritised)
- **P1** — Add per-mobile cooldown (30–60s) on `/api/auth/otp/send` to prevent SMS abuse
- **P1** — Make welcome-bonus issuance idempotent (verify re-verify of an existing user does NOT regrant ₹50)
- **P2** — Return 404 from `PATCH /api/admin/providers/:id` when id not found
- **P2** — Split monolithic `server.js` (2k+ lines) into routers (`auth.js`, `admin.js`, `provider.js`, `calls.js`, `billing.js`)
- **P2** — Real-time WebRTC quality metrics dashboard for admin
- **P3** — Listener payout statements (PDF download per month)
- **P3** — Multi-language UI (Hindi, Bengali) for users

## Next tasks
- Confirm with user: should welcome-bonus only apply to first-ever signup per mobile (idempotency)?
- Optional: add language preference picker on register flow
