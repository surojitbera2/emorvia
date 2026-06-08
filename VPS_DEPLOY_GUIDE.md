# 🚀 VPS Deployment Guide — Iter 6 (FCM + Native Image Upload)

Aapke VPS (`dash.emorvia.in`) pe **purana code** chal raha hai. Naye changes deploy karne ke liye ye guide follow karo.

## What's New (Iter 6)

1. **FCM (Firebase Cloud Messaging)** — Provider ko incoming call/chat notifications app closed/minimized pe bhi milegi
2. **Native image upload fix** — Provider ab APK me gallery + camera dono se images upload kar sakega
3. **Backend full-URL fix** — Uploaded image URLs ab absolute hain (APK WebView me load honge)

## Files Changed

### Backend (node-backend/)
- `server.js` — FCM init, endpoints, `sendFcmToOwner` helper, hooked into socket events, upload URLs full-absolute
- `package.json` — Added `firebase-admin: ^12.7.0`
- `.env` — Added `FIREBASE_SERVICE_ACCOUNT=/var/www/emorvia/node-backend/firebase-service-account.json`
- **NEW FILE**: `firebase-service-account.json` (upload manually, do NOT commit)

### Frontend (frontend/)
- `src/lib/fcmManager.js` — **NEW** (Capacitor FCM bootstrap)
- `src/lib/imagePicker.js` — **NEW** (native gallery/camera picker)
- `src/lib/store.js` — Added `fcmRegister`, `fcmUnregister`, `fcmTest` endpoints
- `src/pages/ProviderHome.jsx` — Calls `initFcm()`, native deep-link listeners
- `src/pages/ProviderProfileEdit.jsx` — Uses native Capacitor Camera for upload

### Android (frontend/android/)
- `app/build.gradle` — Firebase BoM 33.5.1 + firebase-messaging
- `app/src/main/AndroidManifest.xml` — New permissions + FCM service + IncomingCallActivity
- `app/src/main/java/com/emorvia/app/*.java` — 4 new Java classes
- `app/src/main/res/layout/activity_incoming_call.xml` — Full-screen call UI
- `app/src/main/res/drawable/*.xml`, `values/colors.xml`, `values/styles.xml`
- **NEW FILE**: `app/google-services.json` (upload manually, do NOT commit)

---

## Deployment Steps

### Step 1: SSH into VPS

```bash
ssh root@HOSTCOIN-1410-4469
# OR your actual SSH command
```

### Step 2: Pull latest code

**Option A — If using GitHub:**
```bash
cd /var/www/emorvia
git pull origin main
```

**Option B — Manual file copy (if not using git):**
Copy the changed files manually via SCP. Just the changed ones listed above.

### Step 3: Install backend dependency

```bash
cd /var/www/emorvia/node-backend
yarn install     # installs firebase-admin
# OR: npm install (if you don't use yarn on VPS)
```

### Step 4: Upload `firebase-service-account.json`

From your local machine:
```bash
scp ~/Downloads/your-rotated-firebase-key.json root@HOSTCOIN-1410-4469:/var/www/emorvia/node-backend/firebase-service-account.json
ssh root@HOSTCOIN-1410-4469 'chmod 600 /var/www/emorvia/node-backend/firebase-service-account.json'
```

### Step 5: Update `.env`

```bash
cd /var/www/emorvia/node-backend
echo "FIREBASE_SERVICE_ACCOUNT=/var/www/emorvia/node-backend/firebase-service-account.json" >> .env
```

### Step 6: Restart backend

**If PM2:**
```bash
pm2 restart emorvia-backend   # OR whatever name you use
pm2 logs emorvia-backend --lines 20
```

**If systemd:**
```bash
sudo systemctl restart emorvia-backend
sudo journalctl -u emorvia-backend -n 30 --no-pager
```

**If manual (`node server.js`):**
```bash
# Kill old process
ps aux | grep "node.*server.js" | grep -v grep | awk '{print $2}' | xargs -r kill
# Start new
cd /var/www/emorvia/node-backend
nohup node server.js > server.log 2>&1 &
tail -n 30 server.log
```

### Step 7: Verify FCM is ready

Logs me dikhna chahiye:
```
Firebase Admin SDK initialised for project: emorvia-ff61b
Mongo connected
Navya backend on :8001
```

Test endpoint:
```bash
curl -X POST https://dash.emorvia.in/api/push/fcm/test
# Expected: 401 (no auth) → endpoint exists ✅
# NOT: 404 "Cannot POST /api/push/fcm/test" → still old code ❌
```

### Step 8: Frontend rebuild for APK

```bash
cd /var/www/emorvia/frontend
yarn install      # ensure @capacitor/push-notifications & @capacitor/camera present
yarn build        # uses .env.production
npx cap sync android
```

### Step 9: Upload `google-services.json` to VPS (if building APK on VPS)

```bash
scp ~/Downloads/google-services.json root@HOSTCOIN-1410-4469:/var/www/emorvia/frontend/android/app/google-services.json
```

### Step 10: Build APK in Android Studio

Local machine pe (or VPS pe headless build):
```bash
cd /var/www/emorvia/frontend/android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

OR Android Studio me open karke Build → Build APK.

### Step 11: Install fresh APK on phone

```bash
# Uninstall purana
adb uninstall com.emorvia.app

# Install naya
adb install app-debug.apk
```

### Step 12: Test

1. Provider login karo APK pe
2. Notification permission grant karo
3. App ko close/minimize karo
4. Dusra phone se user account banake call try karo
5. Provider ke phone pe **full-screen incoming call screen** aana chahiye with ringtone

---

## Verification Checklist

VPS pe ye command chalao — sab ✅ hone chahiye:

```bash
# 1. firebase-admin installed
cd /var/www/emorvia/node-backend && node -e "console.log(require('firebase-admin/lib/messaging/messaging').Messaging ? 'OK' : 'MISSING')"

# 2. service account JSON exists
ls -la /var/www/emorvia/node-backend/firebase-service-account.json

# 3. .env has the path
grep FIREBASE_SERVICE_ACCOUNT /var/www/emorvia/node-backend/.env

# 4. FCM endpoint reachable
curl -sk -o /dev/null -w "%{http_code}\n" -X POST https://dash.emorvia.in/api/push/fcm/register
# Expected: 401 (means endpoint exists, just needs auth)
# Wrong: 404 (endpoint missing — code not deployed)

# 5. google-services.json in frontend
ls -la /var/www/emorvia/frontend/android/app/google-services.json
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend log: "FCM disabled" | service account JSON missing — re-upload to `/var/www/emorvia/node-backend/firebase-service-account.json` |
| `/api/push/fcm/register` returns 404 | Old code still running — `git pull` + restart |
| APK installed but no notification arrives | Check provider logged in fresh + notification permission granted in Settings → Apps → Emorvia |
| Image upload still fails on APK | Make sure aapne fresh APK build kiya AFTER `yarn build && npx cap sync android` |
| "Failed to fetch firebase-admin" | `cd /var/www/emorvia/node-backend && yarn install` |
| Backend crashes on restart | Check `.env` path is correct, JSON file valid |

---

## Quick One-Liner (if all prerequisites met)

```bash
cd /var/www/emorvia && \
git pull && \
cd node-backend && yarn install && \
cd ../frontend && yarn install && yarn build && npx cap sync android && \
pm2 restart emorvia-backend && \
echo "✅ Deploy complete"
```

(Adjust `pm2 restart` to whatever process manager you use)
