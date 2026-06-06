# 🔔 Emorvia Firebase FCM + Native Android — Setup Guide

Yeh guide app me Firebase Cloud Messaging (FCM) jodne ke liye step-by-step instructions deti hai. Iske bina APK to ban jayegi but **incoming call / chat push notifications kaam nahi karenge**.

Setup time: ~25 minutes.

---

## What's Already Done (Code)

Backend, frontend, aur Android native code sab ready hai:

- ✅ Node backend (`/app/node-backend/server.js`) — `firebase-admin` installed, FCM token register endpoint, `sendFcmToOwner()` helper jo call_request / chat_request / chat_message events pe automatically provider ko data-message bhejta hai.
- ✅ Android native (`/app/frontend/android/app/src/main/java/com/emorvia/app/`):
  - `MyFirebaseMessagingService.java` — FCM data messages receive karta hai, notification channel pe display karta hai
  - `IncomingCallActivity.java` — full-screen WhatsApp-style incoming-call UI, default system ringtone bajata hai, Accept/Reject buttons
  - `CallActionReceiver.java` — notification ke Accept/Reject buttons handle karta hai
  - `NotificationChannels.java` — 2 channels: `emorvia_calls` (HIGH + ringtone) aur `emorvia_chat`
  - `MainActivity.java` — `FLAG_SECURE` (block screenshots/recording), deep-link extras se React me event dispatch
- ✅ AndroidManifest.xml — permissions (camera, mic, notifications, full-screen-intent, wake-lock, foreground-service-phone-call), service/activity/receiver registered
- ✅ Frontend (`/app/frontend/src/lib/fcmManager.js`) — `initFcm()` ProviderHome me chalti hai, FCM token backend ko bhejti hai, `disableFcm()` logout pe
- ✅ Capacitor sync ho gaya (`npx cap sync android` done)

**Bas 2 cheezein chahiye user se:**
1. `google-services.json` (Android client config)
2. `firebase-service-account.json` (Backend service-account credentials)

---

## Part 1: Firebase Project Banao

### Step 1.1 — Firebase Console kholo
- Browser me jao: https://console.firebase.google.com
- Google account se sign-in karo

### Step 1.2 — Naya Project banao
- Click **"Add project"**
- Project name: **Emorvia**
- Click **Continue**
- Google Analytics: **Disable** (zaroori nahi hai, kar sakte ho enable bhi)
- Click **Create project** → wait ~30 sec → **Continue**

---

## Part 2: Android App Add Karo

### Step 2.1 — Firebase Dashboard me Android icon click karo

Firebase project dashboard me **"</>"** ya Android logo dikhega. **Android icon** pe click karo (orange/green hexagon).

### Step 2.2 — App register karo

| Field | Value |
|---|---|
| Android package name | `com.emorvia.app` |
| App nickname | Emorvia |
| Debug signing certificate SHA-1 | _(skip for now — chahiye agar phone auth ya invite link use karna ho)_ |

Click **Register app**.

### Step 2.3 — `google-services.json` download karo

Firebase ek **`google-services.json`** file generate karega. Click **Download google-services.json**.

### Step 2.4 — File ko Android project me daalo

Downloaded file ko is path pe rakho:

```
/app/frontend/android/app/google-services.json
```

⚠️ **Filename exactly `google-services.json` hona chahiye** (no `.txt`, no version suffix).

Verify karne ke liye:
```bash
ls -la /app/frontend/android/app/google-services.json
```

### Step 2.5 — Firebase wizard ke remaining steps SKIP karo

Firebase wizard "Add Firebase SDK" aur "Verify installation" steps dikhayega — **un dono ko skip kar do** (humne pehle hi Gradle me dependencies daal di hain). Bas **"Continue to console"** pe click karo.

---

## Part 3: Service Account JSON Generate Karo (Backend ke liye)

Yeh wo credentials hai jisse aapka Node backend FCM messages bhej payega.

### Step 3.1 — Project Settings kholo

Firebase Console → **gear icon** (top-left, "Project Overview" ke saath) → **Project settings**

### Step 3.2 — Service accounts tab

Top tabs me: **General | Cloud Messaging | Integrations | Service accounts | Data privacy | Users and permissions**

Click **Service accounts**.

### Step 3.3 — Private key generate karo

- Page pe "Firebase Admin SDK" section dikhega
- Click **Generate new private key**
- Confirmation popup: click **Generate key**
- Ek JSON file download hogi (filename jaisa: `emorvia-firebase-adminsdk-xxxxx-yyyyy.json`)

### Step 3.4 — File ko VPS pe daalo

Backend ko ye file is path pe chahiye:

```
/app/node-backend/firebase-service-account.json
```

Aap apne VPS pe:
```bash
# Rename downloaded file:
mv ~/Downloads/emorvia-firebase-adminsdk-xxxxx-yyyyy.json /app/node-backend/firebase-service-account.json

# Permissions secure karo:
chmod 600 /app/node-backend/firebase-service-account.json
```

⚠️ **Yeh file kabhi GitHub me commit mat karna!** `/app/node-backend/.gitignore` me already added hai.

### Step 3.5 — Backend restart karo

```bash
sudo supervisorctl restart backend
```

Logs check karo:
```bash
tail -n 20 /var/log/supervisor/backend.out.log
```

Sahi setup hone par dikhega:
```
Firebase Admin SDK initialised for project: emorvia-XXXXX
Mongo connected
Navya backend on :8001
```

Galat hone par:
```
Firebase service-account JSON not found at /app/node-backend/firebase-service-account.json — FCM disabled (push via web-push only).
```

---

## Part 4: APK Build Karo (Android Studio)

### Step 4.1 — Project sync karo

Local machine pe (jahan Android Studio installed hai):

```bash
cd /app/frontend
yarn install
yarn build           # production build (uses .env.production → https://dash.emorvia.in)
npx cap sync android # copies build/ into android/app/src/main/assets/public
```

### Step 4.2 — Android Studio me open karo

```bash
npx cap open android
```

Ya manually: Android Studio → **Open existing project** → `/app/frontend/android` folder select karo.

### Step 4.3 — Gradle sync wait karo

First time gradle sync me 5-10 minutes lag sakte hain (Firebase BoM + messaging dependencies download honge).

Agar koi error aaye:
- `google-services.json` file Android Studio me visible nahi hai? → File system pe check karo `/app/frontend/android/app/google-services.json` exists.
- "package name mismatch"? → `google-services.json` me `package_name` check karo, should match `com.emorvia.app`.

### Step 4.4 — Build APK

**Debug APK:**
- Top menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- 2-5 min wait — bottom right popup: "APK built successfully"
- **Locate** click karo → `app/build/outputs/apk/debug/app-debug.apk`

**Release APK (signed, for Play Store):**
- **Build → Generate Signed Bundle / APK → APK → Next**
- Keystore path: `/app/releases/emorvia-release.keystore`
- Keystore password: `emorvia2025`
- Key alias: `emorvia`
- Key password: `emorvia2025`
- Next → Release variant → Finish

---

## Part 5: Test Karo

### Step 5.1 — APK install karo

Android device pe APK install karo (USB me transfer karke ya `adb install`).

### Step 5.2 — Provider login karo

App kholo → Provider Login → OTP verify → ProviderHome dashboard pe pahunch jao.

### Step 5.3 — Permission grant karo

App pehli baar:
- **Notification permission** prompt aaye → **Allow**
- Background me automatically FCM token register hoga (visible nahi hoga)

### Step 5.4 — Backend pe verify karo

Backend logs me dikhega:
```bash
tail -f /var/log/supervisor/backend.out.log
```
(Token registration request silently happens via `POST /api/push/fcm/register`)

Database me check karo:
```bash
mongosh emorvia --eval "db.fcmtokens.find().pretty()"
```

### Step 5.5 — Incoming call test

User account se app pe login karke kisi listed provider ko call karo. Provider's device pe:
- **App background me ho** → full-screen WhatsApp-style incoming call screen aayega
- **Phone locked ho** → screen turn on hoga, ringtone bajegi
- Accept / Reject buttons kaam karenge

### Step 5.6 — Test push from provider account

Provider apne dashboard me login karke developer console kholke:
```js
fetch("/api/push/fcm/test", { method: "POST", headers: { Authorization: "Bearer " + localStorage.getItem("emorvia_token") } }).then(r=>r.json()).then(console.log)
```

Response: `{ ok: true, delivered: 1, failed: 0 }` matlab FCM kaam kar raha hai.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Backend log: "FCM disabled" | `firebase-service-account.json` not present at `/app/node-backend/`. Recheck Part 3. |
| Android Studio: "google-services.json not found" | File ko `/app/frontend/android/app/` me rakho (NOT in `android/` root) |
| Build error: "package name mismatch" | `google-services.json` me `package_name` should be exactly `com.emorvia.app` |
| Notification permission denied | Settings → Apps → Emorvia → Notifications → Allow |
| Call notif aati hai but ringtone nahi | Settings → Apps → Emorvia → Notifications → Incoming calls → Sound: Default ringtone |
| Full-screen activity nahi aati phone locked pe | Settings → Apps → Emorvia → Notifications → Incoming calls → Permission "Show on lock screen" + "Bypass DnD" enable karo |
| FCM token register error 401 | Provider re-login required (JWT expired) |
| `delivered: 0` in test | Wrong package name in google-services.json or wrong project in service-account.json — both must be from SAME Firebase project |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  Emorvia Android App (com.emorvia.app)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React (WebView)                                         │   │
│  │  ─────────────                                            │   │
│  │  ProviderHome.jsx ──┬──► initFcm() ──► PushNotifications │   │
│  │                     │                  .register()        │   │
│  │                     │                                     │   │
│  │                     └──► api.fcmRegister(token)           │   │
│  │                          POST /api/push/fcm/register      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ▲                                   │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │  Native Layer                                            │   │
│  │  ─────────────                                            │   │
│  │  MyFirebaseMessagingService                              │   │
│  │   ├─ onNewToken() → SharedPreferences                    │   │
│  │   └─ onMessageReceived(data) ──┐                         │   │
│  │                                ├─ type=incoming_call →   │   │
│  │                                │  IncomingCallActivity   │   │
│  │                                │  (full-screen +         │   │
│  │                                │   default ringtone)     │   │
│  │                                │                         │   │
│  │                                └─ type=incoming_chat →   │   │
│  │                                   notification + tap     │   │
│  │                                   → MainActivity         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ FCM HTTP v1
                              │ data-only message
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│  Node Backend (https://dash.emorvia.in)                         │
│  ─────────────────                                              │
│  server.js                                                      │
│   ├─ firebase-admin.initializeApp(serviceAccount)               │
│   ├─ POST /api/push/fcm/register  → stores token in MongoDB     │
│   ├─ POST /api/push/fcm/test      → manual test                 │
│   └─ Socket.io handlers:                                        │
│      ├─ call_request    → sendFcmToOwner(providerId, {          │
│      │                       type: 'incoming_call', ...        │
│      │                     })                                   │
│      ├─ chat_request    → sendFcmToOwner(...)                   │
│      └─ chat_message    → sendFcmToOwner(...) (only if         │
│                            socket offline)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Reference

| File | Purpose |
|---|---|
| `/app/frontend/android/app/google-services.json` | **USER UPLOADS** — Firebase Android client config |
| `/app/node-backend/firebase-service-account.json` | **USER UPLOADS** — Firebase Admin SDK credentials |
| `/app/node-backend/server.js` | FCM admin init, endpoints, send helpers |
| `/app/node-backend/.env` | Has `FIREBASE_SERVICE_ACCOUNT=` path |
| `/app/frontend/src/lib/fcmManager.js` | React FCM register/unregister |
| `/app/frontend/src/pages/ProviderHome.jsx` | Calls `initFcm()` on provider login |
| `/app/frontend/android/app/build.gradle` | Firebase BoM 33.5.1 + messaging dep |
| `/app/frontend/android/app/src/main/AndroidManifest.xml` | Permissions, service, activity, receiver |
| `/app/frontend/android/app/src/main/java/com/emorvia/app/MyFirebaseMessagingService.java` | FCM receiver |
| `/app/frontend/android/app/src/main/java/com/emorvia/app/IncomingCallActivity.java` | Full-screen call UI + ringtone |
| `/app/frontend/android/app/src/main/java/com/emorvia/app/CallActionReceiver.java` | Notification button actions |
| `/app/frontend/android/app/src/main/java/com/emorvia/app/NotificationChannels.java` | Channel creation |

---

## Security Notes

- ✅ Screenshot/screen-recording blocked everywhere via `FLAG_SECURE` (MainActivity + IncomingCallActivity)
- ✅ FCM uses HTTP v1 OAuth2 (token-based) — no legacy server key
- ✅ Service-account JSON `.gitignore`'d
- ✅ Provider auth required for `POST /api/push/fcm/register`
- ✅ Stale tokens auto-cleaned on send failure (`messaging/registration-token-not-registered`)
- ✅ Cleartext traffic disabled (`android:usesCleartextTraffic="false"`)

---

**Bas! Setup complete. Build APK aur test karo.**
