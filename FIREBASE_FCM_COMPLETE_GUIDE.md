# 🔔 Complete Guide: Firebase Push Notifications Setup
## google-services.json for Emorvia Android App

---

## ❓ WHAT IS google-services.json?

**google-services.json** is a configuration file from Firebase that enables:
- Push notifications (call notifications)
- Cloud messaging
- Firebase services in your Android app

**WHERE IT GOES:**
- ✅ In Android project: `/app/frontend/android/app/google-services.json`
- ❌ NOT on VPS server

---

## 📋 WHAT WE WILL DO

1. Create Firebase project
2. Add Android app to Firebase
3. Download google-services.json
4. Place it in Android project
5. Configure Android build files
6. Get FCM Server Key
7. Configure backend on VPS
8. Test push notifications

**Total Time: 20-30 minutes**

---

## PART 1: CREATE FIREBASE PROJECT

### Step 1.1: Go to Firebase Console

1. Open browser
2. Go to: https://console.firebase.google.com
3. Sign in with your Google account

### Step 1.2: Create New Project

You'll see Firebase Console:
```
┌─────────────────────────────────────┐
│   Welcome to Firebase               │
├─────────────────────────────────────┤
│                                     │
│   Your Projects:                    │
│   (empty or list of projects)       │
│                                     │
│   [+ Add project]  <-- Click here   │
│                                     │
└─────────────────────────────────────┘
```

Click **"+ Add project"**

### Step 1.3: Enter Project Name

```
┌─────────────────────────────────────┐
│   Create a project                  │
│   Step 1 of 3                       │
├─────────────────────────────────────┤
│   What would you like to call       │
│   your project?                     │
│                                     │
│   Project name:                     │
│   [Emorvia                    ]     │
│                                     │
│   Your Firebase project will be     │
│   called "Emorvia"                  │
│                                     │
│   [Continue]  <-- Click             │
└─────────────────────────────────────┘
```

Type: **Emorvia**

Click **"Continue"**

### Step 1.4: Google Analytics (Optional)

```
┌─────────────────────────────────────┐
│   Google Analytics for your         │
│   Firebase project                  │
│   Step 2 of 3                       │
├─────────────────────────────────────┤
│   Enable Google Analytics for this  │
│   project                           │
│                                     │
│   ☑ Enable Google Analytics         │
│   (Recommended)                     │
│                                     │
│   [Continue]  <-- Click             │
└─────────────────────────────────────┘
```

**You can:**
- Leave it checked (recommended)
- Or uncheck it if you don't need analytics

Click **"Continue"**

### Step 1.5: Analytics Account (if enabled)

```
┌─────────────────────────────────────┐
│   Configure Google Analytics        │
│   Step 3 of 3                       │
├─────────────────────────────────────┤
│   Analytics account:                │
│   ● Default Account for Firebase    │
│                                     │
│   ☑ I accept the terms             │
│                                     │
│   [Create project]  <-- Click       │
└─────────────────────────────────────┘
```

1. Select **"Default Account for Firebase"**
2. Check **"I accept the terms"**
3. Click **"Create project"**

### Step 1.6: Wait for Project Creation

```
┌─────────────────────────────────────┐
│   Creating your project...          │
│   ⏳ This may take a minute         │
│                                     │
│   ████████████░░░░░░░░░░ 60%       │
│                                     │
│   Setting up Firebase services...   │
└─────────────────────────────────────┘
```

⏳ Wait 30-60 seconds

### Step 1.7: Project Ready

```
┌─────────────────────────────────────┐
│   ✓ Your new project is ready!     │
│                                     │
│   [Continue]  <-- Click             │
└─────────────────────────────────────┘
```

Click **"Continue"**

✅ **Checkpoint:** Firebase project created!

---

## PART 2: ADD ANDROID APP TO FIREBASE

### Step 2.1: Add Android App

You'll see your project dashboard:
```
┌─────────────────────────────────────┐
│   Project Overview                  │
├─────────────────────────────────────┤
│   Get started by adding Firebase    │
│   to your app                       │
│                                     │
│   [</>] Web    [📱] iOS    [🤖] Android
│                               ↑      │
│                         Click here  │
└─────────────────────────────────────┘
```

Click the **Android icon (🤖)** or button that says **"Android"**

### Step 2.2: Register App

```
┌─────────────────────────────────────┐
│   Add Firebase to your Android app  │
│   Step 1                            │
├─────────────────────────────────────┤
│   Android package name *            │
│   [com.emorvia.app            ]     │
│                                     │
│   App nickname (optional)           │
│   [Emorvia                    ]     │
│                                     │
│   Debug signing certificate SHA-1   │
│   (optional)                        │
│   [                           ]     │
│                                     │
│   [Register app]  <-- Click         │
└─────────────────────────────────────┘
```

**Fill in:**
1. **Android package name:** `com.emorvia.app` (MUST be exact!)
2. **App nickname:** `Emorvia`
3. **SHA-1:** Leave empty (not needed for FCM)

Click **"Register app"**

### Step 2.3: Download google-services.json

```
┌─────────────────────────────────────┐
│   Download and then add config file │
│   Step 2                            │
├─────────────────────────────────────┤
│   Download google-services.json     │
│   and place it in your module       │
│   (app-level) root directory        │
│                                     │
│   [Download google-services.json]   │
│          ↑                          │
│    Click here                       │
│                                     │
│   [Next]                            │
└─────────────────────────────────────┘
```

1. Click **"Download google-services.json"**
2. File downloads to your Downloads folder
3. Click **"Next"**

✅ **Checkpoint:** google-services.json downloaded!

### Step 2.4: Add Firebase SDK (Skip)

```
┌─────────────────────────────────────┐
│   Add Firebase SDK                  │
│   Step 3                            │
├─────────────────────────────────────┤
│   Add Firebase to your build files  │
│   (We'll do this manually later)    │
│                                     │
│   [Next]  <-- Click                 │
└─────────────────────────────────────┘
```

Click **"Next"** (we'll configure this manually)

### Step 2.5: Run Your App (Skip)

```
┌─────────────────────────────────────┐
│   Run your app to verify            │
│   installation                      │
│   Step 4                            │
├─────────────────────────────────────┤
│   [Continue to console]  <-- Click  │
└─────────────────────────────────────┘
```

Click **"Continue to console"**

✅ **Checkpoint:** Android app registered with Firebase!

---

## PART 3: PLACE google-services.json IN PROJECT

### Step 3.1: Find Downloaded File

1. Open your **Downloads** folder
2. You should see: `google-services.json`
3. **Right-click** on it
4. Select **"Copy"**

### Step 3.2: Navigate to Android App Folder

**Open File Explorer / Finder:**

Navigate to:
```
/app/frontend/android/app/
```

You should see these folders/files:
```
📁 android/
  └─ 📁 app/
     ├─ 📁 src/
     ├─ 📄 build.gradle
     ├─ 📄 google-services.json  <-- We'll put it here
     └─ ...
```

### Step 3.3: Paste google-services.json

1. **Right-click** in the `app` folder
2. Select **"Paste"**
3. The file `google-services.json` is now in `/app/frontend/android/app/`

### Step 3.4: Verify Placement

**Using Command Line:**
```bash
# Check if file exists
ls -la /app/frontend/android/app/google-services.json
```

**Expected output:**
```
-rw-r--r-- 1 user user 2347 Jun 5 16:00 google-services.json
```

✅ **Checkpoint:** google-services.json placed correctly!

---

## PART 4: CONFIGURE ANDROID BUILD FILES

### Step 4.1: Add Google Services Plugin to Project build.gradle

Open: `/app/frontend/android/build.gradle`

**Find this section:**
```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.0.0'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
        // Add this line below ↓
    }
}
```

**Add this line:**
```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.0.0'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
        classpath 'com.google.gms:google-services:4.4.2'  // ← Add this
    }
}
```

**Save the file** (Ctrl+S or Cmd+S)

### Step 4.2: Apply Plugin in App build.gradle

Open: `/app/frontend/android/app/build.gradle`

**At the very top, find:**
```gradle
apply plugin: 'com.android.application'
```

**Add below it:**
```gradle
apply plugin: 'com.android.application'
apply plugin: 'com.google.gms.google-services'  // ← Add this
```

**Save the file**

### Step 4.3: Sync Gradle Files

**In Android Studio:**
1. You'll see a notification bar at top:
   ```
   Gradle files have changed since last project sync
   [Sync Now]  [File]
   ```
2. Click **"Sync Now"**
3. Wait for sync to complete (1-2 minutes)

**Or manually:**
- Menu: **File → Sync Project with Gradle Files**

**Or using command:**
```bash
cd /app/frontend/android
./gradlew sync
```

✅ **Checkpoint:** Firebase SDK configured in Android project!

---

## PART 5: GET FCM SERVER KEY (FOR BACKEND)

### Step 5.1: Go to Project Settings

In Firebase Console:
1. Click **⚙️ gear icon** (top-left, next to "Project Overview")
2. Click **"Project settings"**

### Step 5.2: Navigate to Cloud Messaging

```
┌─────────────────────────────────────┐
│   Project settings                  │
├─────────────────────────────────────┤
│   General                           │
│   Service accounts                  │
│   Cloud Messaging  <-- Click        │
│   ...                               │
└─────────────────────────────────────┘
```

Click **"Cloud Messaging"** tab

### Step 5.3: Find Server Key

Scroll down to **"Cloud Messaging API (Legacy)"**:

```
┌─────────────────────────────────────┐
│   Cloud Messaging API (Legacy)      │
├─────────────────────────────────────┤
│   Server key                        │
│   AAAA...xyz123  [📋 Copy]         │
│          ↑                          │
│    Click to copy                    │
│                                     │
│   Sender ID                         │
│   123456789                         │
└─────────────────────────────────────┘
```

**If you see "Cloud Messaging API is disabled":**
1. Click **"Enable Cloud Messaging API"**
2. Wait for it to enable
3. Refresh page
4. Server key will appear

**Copy the Server Key** - it looks like:
```
AAAABCDEfg:APA91bHIJKLmnopQRStuvWXYZ1234567890abcdefghijklmnop...
```

✅ **Checkpoint:** FCM Server Key copied!

---

## PART 6: CONFIGURE BACKEND ON VPS

Now we need to add this Server Key to your backend on VPS.

### Step 6.1: Connect to VPS

**On your local machine:**
```bash
ssh emorvia@YOUR_VPS_IP
# Enter password
```

### Step 6.2: Edit Backend .env File

```bash
# Navigate to backend folder
cd /opt/emorvia-backend

# Edit .env file
nano .env
```

### Step 6.3: Add FCM Server Key

**Add this line at the end:**
```bash
# FCM Push Notifications
FCM_SERVER_KEY=YOUR_FCM_SERVER_KEY_HERE
```

**Replace `YOUR_FCM_SERVER_KEY_HERE` with the key you copied**

Example:
```bash
FCM_SERVER_KEY=AAAABCDEfg:APA91bHIJKLmnopQRStuvWXYZ1234567890abcdefghijklmnop...
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y`
- Press `Enter`

### Step 6.4: Restart Backend

```bash
pm2 restart emorvia-backend
```

**Check if running:**
```bash
pm2 logs emorvia-backend --lines 20
```

Look for:
```
Navya backend on :8001
✓ No errors
```

✅ **Checkpoint:** Backend configured with FCM!

---

## PART 7: REBUILD ANDROID APP

Now that we've added google-services.json, we need to rebuild the APK.

### Step 7.1: Sync Capacitor

On your local machine:
```bash
cd /app/frontend
npx cap sync android
```

### Step 7.2: Open in Android Studio

```bash
npx cap open android
```

### Step 7.3: Rebuild APK

**In Android Studio:**
1. **Build → Clean Project**
2. Wait for clean to finish
3. **Build → Rebuild Project**
4. Wait 3-5 minutes
5. **Build → Build Bundle(s) / APK(s) → Build APK(s)**

**Or using command:**
```bash
cd /app/frontend/android
./gradlew clean
./gradlew assembleDebug
```

✅ **Checkpoint:** New APK built with Firebase!

---

## PART 8: TEST PUSH NOTIFICATIONS

### Step 8.1: Install New APK

```bash
adb uninstall com.emorvia.app
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Step 8.2: Launch App

1. Open Emorvia app
2. Login as **Provider**
3. App will request notification permission
4. Click **"Allow"** when prompted

### Step 8.3: Test from Firebase Console

**Back in Firebase Console:**

1. Go to **"Cloud Messaging"** in left menu
2. Click **"Send your first message"**
3. Fill in:
   ```
   Notification title: Test Call
   Notification text: You have an incoming call
   ```
4. Click **"Next"**
5. Target: Select your app
6. Click **"Review"**
7. Click **"Publish"**

**Check your phone/emulator:**
- Notification should appear!

✅ **Checkpoint:** Push notifications working!

---

## PART 9: HOW IT WORKS IN YOUR APP

### When User Calls Provider:

1. **User clicks "Call Provider"**
2. **Frontend sends request to backend:**
   ```
   POST /api/call/initiate
   {
     providerId: "123",
     userId: "456"
   }
   ```

3. **Backend:**
   - Gets provider's FCM token from database
   - Sends push notification via FCM:
   ```javascript
   const message = {
     to: providerFCMToken,
     notification: {
       title: "Incoming Call",
       body: "User is calling you",
       sound: "default"
     },
     data: {
       type: "call",
       userId: "456",
       userName: "John"
     }
   };
   
   fetch('https://fcm.googleapis.com/fcm/send', {
     method: 'POST',
     headers: {
       'Authorization': `key=${FCM_SERVER_KEY}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(message)
   });
   ```

4. **Provider's phone:**
   - Receives notification
   - Shows "Incoming Call from John"
   - Provider can accept or reject

---

## 📝 SUMMARY

### What We Did:

✅ Created Firebase project
✅ Registered Android app
✅ Downloaded google-services.json
✅ Placed it in `/app/frontend/android/app/`
✅ Configured build.gradle files
✅ Got FCM Server Key
✅ Added Server Key to backend .env
✅ Rebuilt Android app
✅ Tested push notifications

### Files Modified:

```
Backend (VPS):
✓ /opt/emorvia-backend/.env
  Added: FCM_SERVER_KEY=...

Android (Local):
✓ /app/frontend/android/app/google-services.json
  (New file added)

✓ /app/frontend/android/build.gradle
  Added: google-services plugin

✓ /app/frontend/android/app/build.gradle
  Added: apply plugin google-services
```

---

## 🎯 QUICK REFERENCE

### File Locations:

**google-services.json location:**
```
/app/frontend/android/app/google-services.json
```

**Backend FCM config:**
```
/opt/emorvia-backend/.env
FCM_SERVER_KEY=AAAABCDEfg:APA91b...
```

### Important Commands:

**Sync after adding google-services.json:**
```bash
cd /app/frontend
npx cap sync android
```

**Rebuild APK:**
```bash
cd /app/frontend/android
./gradlew clean
./gradlew assembleDebug
```

**Restart backend:**
```bash
pm2 restart emorvia-backend
```

---

## ❗ IMPORTANT NOTES

### ⚠️ google-services.json Security:

**This file contains:**
- Firebase project configuration
- API keys
- Project IDs

**Security:**
- ✅ Safe to include in Android APK (it's designed for this)
- ✅ Safe in your local project
- ❌ Don't commit to public GitHub repo
- ❌ Don't share publicly

### ⚠️ FCM Server Key Security:

**This key is SENSITIVE!**
- ❌ Never commit to GitHub
- ❌ Never share publicly
- ❌ Never hardcode in frontend
- ✅ Keep only in backend .env
- ✅ Keep in password manager

### ⚠️ Package Name MUST Match:

When registering app in Firebase:
- Package name: **com.emorvia.app**
- MUST match exactly what's in AndroidManifest.xml
- If mismatch, notifications won't work

---

## 🐛 TROUBLESHOOTING

### "google-services.json not found"

**Solution:**
```bash
# Verify file exists
ls -la /app/frontend/android/app/google-services.json

# If missing, download again from Firebase Console
```

### "Failed to apply plugin 'com.google.gms.google-services'"

**Solution:**
```bash
# Make sure you added to both files:
# 1. /app/frontend/android/build.gradle (classpath)
# 2. /app/frontend/android/app/build.gradle (apply plugin)

# Then sync:
cd /app/frontend/android
./gradlew sync
```

### Notifications not received

**Check these:**
1. ✅ google-services.json in correct location
2. ✅ FCM_SERVER_KEY in backend .env
3. ✅ Backend restarted after adding key
4. ✅ App has notification permission
5. ✅ Device has internet connection
6. ✅ Provider is logged in

**Test from Firebase Console:**
- Send test notification
- Should appear on device

### "Package name doesn't match"

**Solution:**
1. Check AndroidManifest.xml: `com.emorvia.app`
2. In Firebase Console, go to Project Settings → Your apps
3. Verify package name is `com.emorvia.app`
4. If wrong, delete app and re-register with correct name

---

## ✅ CHECKLIST

Before moving forward:

- [ ] Firebase project created
- [ ] Android app registered
- [ ] google-services.json downloaded
- [ ] File placed in `/app/frontend/android/app/`
- [ ] build.gradle files updated
- [ ] Gradle sync successful
- [ ] FCM Server Key copied
- [ ] Server Key added to backend .env
- [ ] Backend restarted
- [ ] Android app rebuilt
- [ ] New APK tested
- [ ] Notifications working

---

## 🎉 DONE!

Your app now has push notifications enabled!

When a user calls, the provider will receive a notification even if the app is closed.

**Next steps:**
- Test with real users
- Monitor notification delivery
- Track errors in Firebase Console

