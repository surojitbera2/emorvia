# 📱 Android Studio - Visual Step-by-Step Guide for Beginners

This guide shows you EXACTLY what to click in Android Studio to generate APK and AAB files.

---

## 🎬 Before You Start

### What You Need:
1. ✅ Android Studio installed
2. ✅ React app built (`cd /app/frontend && yarn build`)
3. ✅ Project synced (`npx cap sync android`)
4. ✅ 30 minutes of time

---

## Part 1: Opening Project in Android Studio

### Step 1: Launch Android Studio
1. Double-click Android Studio icon on desktop
2. Or search "Android Studio" in Start menu (Windows) / Spotlight (Mac)

### Step 2: Open Project
**When you see the welcome screen:**

```
┌─────────────────────────────────────┐
│   Android Studio                    │
├─────────────────────────────────────┤
│                                     │
│   [New Project]                     │
│   [Open]  <-- CLICK THIS           │
│   [Get from VCS]                    │
│                                     │
│   Recent Projects:                  │
│   - Previous projects show here     │
│                                     │
└─────────────────────────────────────┘
```

1. Click **"Open"**
2. Navigate to: `/app/frontend/android`
3. Click **"OK"**

### Step 3: Wait for Gradle Sync

**What you'll see:**
```
Bottom status bar:
┌────────────────────────────────────┐
│ Gradle sync in progress... ⏳      │
└────────────────────────────────────┘
```

**Wait 3-10 minutes** for first sync. You'll see:
- "Gradle: Download dependencies"
- "Gradle: Build model"
- "Gradle sync finished successfully ✓"

**If popup appears "Install missing platforms":**
- Click **"Install"**
- Wait for download
- Click **"Finish"**

---

## Part 2: Generate Debug APK (For Testing)

### Method 1: Using Menu (Easiest for Beginners)

#### Step 1: Open Build Menu
```
Top Menu:
[File] [Edit] [View] [Navigate] [Code] [Analyze] [Refactor] [Build] <-- CLICK
                                                                    ↓
```

#### Step 2: Select Build APK
```
Build Menu:
├─ Make Project
├─ Make Module 'app'
├─ Clean Project
├─ Rebuild Project
├─ Build Bundle(s) / APK(s) ────► ├─ Build Bundle(s)         │
│                                  ├─ Build APK(s)  <-- CLICK │
└──────────────────────────────────└─ Build Bundle and APK(s)│
```

Click: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

#### Step 3: Wait for Build
**Bottom-right corner shows:**
```
┌────────────────────────────────────┐
│ ⏳ Gradle Build Running...         │
│ :app:generateDebugBuildConfig     │
│ :app:mergeDebugResources          │
│ :app:packageDebug                 │
└────────────────────────────────────┘
```

**Takes 2-5 minutes. When done, you'll see:**
```
┌────────────────────────────────────┐
│ ✓ APK(s) generated successfully.  │
│                                    │
│   [locate] [analyze]               │
└────────────────────────────────────┘
```

#### Step 4: Find Your APK
Click **"locate"** in the notification.

**File Explorer opens showing:**
```
📁 android/app/build/outputs/apk/debug/
   └─ 📄 app-debug.apk  <-- THIS IS YOUR APK!
```

**Copy this APK** to share or install.

### Method 2: Using Terminal (Alternative)

#### Step 1: Open Terminal in Android Studio
```
Bottom tabs:
[Logcat] [Terminal] <-- CLICK  [Build] [TODO] [Problems]
```

#### Step 2: Run Build Command
```bash
# Type this command:
./gradlew assembleDebug
```

**Press Enter**

**You'll see:**
```
> Task :app:generateDebugBuildConfig
> Task :app:mergeDebugResources
> Task :app:packageDebug

BUILD SUCCESSFUL in 2m 34s
142 tasks executed
```

#### Step 3: Find APK
```bash
# APK is at:
app/build/outputs/apk/debug/app-debug.apk
```

---

## Part 3: Test Debug APK

### Option A: Test on Emulator

#### Step 1: Open AVD Manager
```
Top-right toolbar:
[▶ Run] [🐛 Debug] [AVD Manager] <-- CLICK
```

#### Step 2: Create Emulator (First Time)
**If no devices exist:**

```
┌─────────────────────────────────────┐
│   Android Virtual Device Manager   │
├─────────────────────────────────────┤
│   Your Virtual Devices:             │
│   (empty)                           │
│                                     │
│   [+ Create Virtual Device] <--CLICK│
└─────────────────────────────────────┘
```

**Select Device:**
```
Category: Phone
┌─────────────────────────────────────┐
│ ○ Pixel 5  <-- SELECT THIS          │
│ ○ Pixel 4                           │
│ ○ Nexus 5                           │
└─────────────────────────────────────┘
[Next] <-- CLICK
```

**Select System Image:**
```
Recommended:
┌─────────────────────────────────────┐
│ Release Name   API  ABI             │
│ Tiramisu   ✓  33   x86_64  <--SELECT│
│ S          ✓  31   x86_64           │
└─────────────────────────────────────┘

If "Download" icon (⬇) appears, click it first.

[Next] <-- CLICK
```

**Verify Configuration:**
```
AVD Name: Pixel 5 API 33
[Finish] <-- CLICK
```

#### Step 3: Start Emulator
```
Your Virtual Devices:
┌─────────────────────────────────────┐
│ Pixel 5 API 33                      │
│ [▶ Play] <-- CLICK                  │
└─────────────────────────────────────┘
```

**Emulator window opens** (takes 2-3 minutes first time)

#### Step 4: Install APK on Emulator

**Method 1: Drag & Drop**
1. Open file explorer
2. Navigate to `app/build/outputs/apk/debug/`
3. **Drag** `app-debug.apk` onto emulator screen
4. Wait for installation confirmation

**Method 2: Using ADB**
In Android Studio Terminal:
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Option B: Test on Real Phone

#### Step 1: Enable Developer Options
**On your Android phone:**
1. Go to: **Settings**
2. Scroll to: **About phone**
3. Find: **Build number**
4. **Tap "Build number" 7 times quickly**
5. You'll see: "You are now a developer!"

#### Step 2: Enable USB Debugging
1. Go back to: **Settings**
2. New option appears: **Developer options** or **System → Developer options**
3. Find: **USB debugging**
4. Turn **ON**

#### Step 3: Connect Phone
1. Connect phone to computer via USB cable
2. Phone popup appears: "Allow USB debugging?"
3. Check: "Always allow from this computer"
4. Tap: **"OK"**

#### Step 4: Verify Connection
In Android Studio Terminal:
```bash
adb devices
```

**You should see:**
```
List of devices attached
ABC123XYZ    device  <-- Your phone
```

#### Step 5: Install APK
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

**You'll see:**
```
Performing Streamed Install
Success
```

**App is now installed on your phone!** Check app drawer.

---

## Part 4: Generate Signed Release APK

### Why Signed APK?
- Debug APK is for testing only
- Signed APK can be shared with users
- Signed APK is required for updates (same signature)

### Step 1: Open Build Menu
```
Top Menu:
[Build] <-- CLICK
```

### Step 2: Generate Signed Bundle/APK
```
Build Menu:
├─ Build Bundle(s) / APK(s)
├─ Generate Signed Bundle / APK... <-- CLICK
└─ ...
```

### Step 3: Choose APK
```
┌─────────────────────────────────────┐
│   Generate Signed Bundle or APK    │
├─────────────────────────────────────┤
│   ○ Android App Bundle (AAB)       │
│   ● APK  <-- SELECT THIS            │
│                                     │
│   [Next] <-- CLICK                  │
└─────────────────────────────────────┘
```

### Step 4: Create Keystore (FIRST TIME ONLY)

```
┌─────────────────────────────────────┐
│   Key store path:                   │
│   [___________] [Browse] [Create new] <-- CLICK "Create new"
│                                     │
│   Key store password: _______       │
│   Key alias: _______                │
│   Key password: _______             │
│                                     │
│   [Previous] [Next]                 │
└─────────────────────────────────────┘
```

Click **"Create new..."**

#### Fill in New Key Store Form:

```
┌─────────────────────────────────────────────┐
│   New Key Store                             │
├─────────────────────────────────────────────┤
│   Key store path:                           │
│   /app/frontend/android/app/emorvia.keystore│
│   [Browse...] <-- Click to choose location  │
│                                             │
│   Password: ************ (min 6 chars)      │
│   Confirm:  ************                    │
│                                             │
│   ─────────────────────────────────────────│
│                                             │
│   Alias: emorvia                            │
│   Password: ************ (min 6 chars)      │
│   Confirm:  ************                    │
│   Validity (years): 25                      │
│                                             │
│   ─────────────────────────────────────────│
│   Certificate                               │
│   First and Last Name: Your Name            │
│   Organizational Unit: Emorvia              │
│   Organization: Emorvia                     │
│   City or Locality: Your City               │
│   State or Province: Your State             │
│   Country Code (XX): IN                     │
│                                             │
│   [OK] [Cancel]                             │
└─────────────────────────────────────────────┘
```

**IMPORTANT: Write down these passwords!**
```
🔐 SAVE THESE PASSWORDS:
   Keystore Password: _______________
   Key Password: _______________
   Key Alias: emorvia
```

Click **"OK"**

### Step 5: Sign APK

**Now you're back at the main screen:**
```
┌─────────────────────────────────────┐
│   Key store path:                   │
│   /app/.../emorvia.keystore ✓       │
│                                     │
│   Key store password: ******* ✓     │
│   Key alias: emorvia ✓              │
│   Key password: ******* ✓           │
│                                     │
│   ☑ Remember passwords              │
│                                     │
│   [Previous] [Next] <-- CLICK       │
└─────────────────────────────────────┘
```

### Step 6: Choose Build Variant
```
┌─────────────────────────────────────┐
│   Destination Folder:               │
│   /app/frontend/android/app         │
│                                     │
│   Build Variants:                   │
│   ☑ release  <-- MUST BE CHECKED    │
│                                     │
│   Signature Versions:               │
│   ☑ V1 (Jar Signature)              │
│   ☑ V2 (Full APK Signature)         │
│                                     │
│   [Previous] [Finish] <-- CLICK     │
└─────────────────────────────────────┘
```

Click **"Finish"**

### Step 7: Wait for Build

**Bottom-right shows progress:**
```
⏳ Gradle Build Running...
   :app:packageRelease
   :app:assembleRelease
```

**Takes 3-7 minutes**

**When done:**
```
✓ APK(s) generated successfully.

  Generate Signed APK
  APK(s) generated successfully for module 'app' with 1 build variant:
  Build variant: 'release'
  APK(s) generated at: /app/frontend/android/app/release

  [locate] <-- CLICK
```

### Step 8: Get Your Signed APK

Click **"locate"**

**File explorer opens:**
```
📁 android/app/build/outputs/apk/release/
   └─ 📄 app-release.apk  <-- THIS IS YOUR SIGNED APK!
   
   File size: ~25-35 MB
```

**This APK can be:**
- Shared with users
- Uploaded to your website
- Distributed via direct download

---

## Part 5: Generate AAB for Google Play Store

### What is AAB?
- Android App Bundle (AAB) is required for Play Store
- Smaller download size for users
- Play Store optimizes APK for each device

### Step 1: Build → Generate Signed Bundle/APK
```
Same as before:
Build → Generate Signed Bundle / APK...
```

### Step 2: Choose Android App Bundle
```
┌─────────────────────────────────────┐
│   Generate Signed Bundle or APK    │
├─────────────────────────────────────┤
│   ● Android App Bundle  <-- SELECT  │
│   ○ APK                             │
│                                     │
│   [Next] <-- CLICK                  │
└─────────────────────────────────────┘
```

### Step 3: Select Keystore (Same as APK)
```
Same keystore as before:
- Key store path: /app/.../emorvia.keystore
- Password: (your password)
- Key alias: emorvia
- Key password: (your password)

[Next] <-- CLICK
```

### Step 4: Choose Build Variant
```
Same as APK:
- Build Variant: release ✓
- Signature V1 ✓
- Signature V2 ✓

[Finish] <-- CLICK
```

### Step 5: Wait for Build

**Takes 3-7 minutes**

```
⏳ Gradle Build Running...
   :app:bundleReleaseClassesToCompileJar
   :app:bundleRelease

BUILD SUCCESSFUL in 4m 23s
```

### Step 6: Get Your AAB

**Notification appears:**
```
✓ Generate Signed Bundle
  Android App Bundle(s) generated successfully for 1 module:
  Module 'app': /app/frontend/android/app/release/app-release.aab

  [locate] <-- CLICK
```

**File explorer opens:**
```
📁 android/app/build/outputs/bundle/release/
   └─ 📄 app-release.aab  <-- UPLOAD THIS TO PLAY STORE
   
   File size: ~20-28 MB (smaller than APK)
```

---

## Part 6: Verify Your Build

### Check APK Info

#### Step 1: Open Terminal
Click **"Terminal"** tab at bottom

#### Step 2: Navigate to APK folder
```bash
cd app/build/outputs/apk/release
```

#### Step 3: Check Package Info
```bash
aapt dump badging app-release.apk | grep package
```

**You should see:**
```
package: name='com.emorvia.app' versionCode='1' versionName='1.0'
```

### Test Signed APK

```bash
# Install on connected device/emulator
adb install app-release.apk

# Or force reinstall
adb install -r app-release.apk

# Launch app
adb shell am start -n com.emorvia.app/.MainActivity
```

---

## Part 7: Common Errors & Solutions

### Error 1: "Gradle sync failed"

**What you see:**
```
Gradle sync failed: Could not resolve all dependencies
```

**Solution:**
```bash
# In Terminal:
./gradlew clean
./gradlew build --refresh-dependencies
```

Then: **File → Sync Project with Gradle Files**

### Error 2: "SDK not found"

**What you see:**
```
SDK location not found. Define location with sdk.dir...
```

**Solution:**
1. **File → Project Structure**
2. Select **"SDK Location"** on left
3. Click **"..."** button
4. Select Android SDK location (usually):
   - Windows: `C:\Users\YourName\AppData\Local\Android\Sdk`
   - Mac: `/Users/YourName/Library/Android/sdk`
5. Click **"OK"**
6. Click **"Apply"** and **"OK"**

### Error 3: "Keystore was tampered with"

**What you see:**
```
java.security.UnrecoverableKeyException: Password verification failed
```

**Solution:**
- You entered wrong password
- Re-enter correct keystore and key passwords
- If you forgot passwords, you must create new keystore (can't update app!)

### Error 4: "Build failed - Out of memory"

**What you see:**
```
Expiring Daemon because JVM heap space is exhausted
```

**Solution:**
Create/edit `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
```

Then clean and rebuild.

### Error 5: "Installation failed: INSTALL_FAILED_UPDATE_INCOMPATIBLE"

**What you see:**
```
adb: failed to install app-release.apk: Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]
```

**Solution:**
```bash
# Uninstall old version first
adb uninstall com.emorvia.app

# Then install new
adb install app-release.apk
```

---

## Quick Reference

### Where Are My Files?

```
Android Project Structure:
📁 /app/frontend/android/
   ├─ 📁 app/
   │  ├─ 📁 build/
   │  │  └─ 📁 outputs/
   │  │     ├─ 📁 apk/
   │  │     │  ├─ 📁 debug/
   │  │     │  │  └─ app-debug.apk           ← Debug APK
   │  │     │  └─ 📁 release/
   │  │     │     └─ app-release.apk         ← Signed APK
   │  │     └─ 📁 bundle/
   │  │        └─ 📁 release/
   │  │           └─ app-release.aab         ← Play Store AAB
   │  └─ emorvia.keystore                    ← YOUR KEYSTORE (backup!)
   └─ ...
```

### Build Commands Quick Reference

```bash
# Debug APK
./gradlew assembleDebug

# Release APK (unsigned)
./gradlew assembleRelease

# Release AAB
./gradlew bundleRelease

# Clean build
./gradlew clean

# Install on device
adb install app/build/outputs/apk/release/app-release.apk

# Uninstall
adb uninstall com.emorvia.app
```

---

## 🎯 Final Checklist

Before distributing your app:

- [ ] Debug APK tested on emulator
- [ ] Debug APK tested on real device
- [ ] Keystore created and **BACKED UP**
- [ ] Passwords written down and **STORED SAFELY**
- [ ] Signed release APK generated
- [ ] AAB generated for Play Store
- [ ] App launches without crashes
- [ ] Login works
- [ ] Camera permission works
- [ ] Microphone permission works
- [ ] Screenshot blocking tested (try taking screenshot)
- [ ] Video call tested
- [ ] Chat tested
- [ ] Provider image upload/display works

---

## 🚀 What's Next?

### For Direct Distribution (APK):
1. Upload `app-release.apk` to your website
2. Share download link with users
3. Users must enable "Install from Unknown Sources"

### For Play Store (AAB):
1. Create Google Play Developer account ($25 one-time fee)
2. Go to https://play.google.com/console
3. Click "Create app"
4. Fill in app details
5. Upload `app-release.aab`
6. Complete store listing
7. Submit for review (takes 2-7 days)

---

**Congratulations!** 🎉 You've successfully built your Android app!
