# EMORVIA Android App - Build Guide

This guide walks you through building the Emorvia Android app from the React web app using Capacitor.

## 🎯 What's Included

- ✅ **Native Android App** - Full native Android APK/AAB
- ✅ **WhatsApp-Style Call Notifications** - FCM push notifications for incoming calls
- ✅ **Screenshot & Screen Recording Blocked** - Secure content protection
- ✅ **Camera & Microphone Permissions** - For video/audio calls
- ✅ **Same UI/UX** - Identical to web version
- ✅ **Provider Image Upload** - Images stored on VPS at https://dash.emorvia.in

## 📋 Prerequisites

### Required Software
1. **Android Studio** (Latest stable version)
   - Download: https://developer.android.com/studio
   - Install with Android SDK, Android SDK Platform-Tools, and Android Emulator

2. **Java Development Kit (JDK) 17 or higher**
   - Check: `java -version`
   - Download: https://www.oracle.com/java/technologies/downloads/

3. **Node.js & Yarn** (Already installed in project)

### Environment Variables
Ensure these are set in your system:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

## 🚀 Quick Start

### 1. Build the React App
```bash
cd /app/frontend
yarn build
```

### 2. Sync Capacitor
```bash
npx cap sync android
```

### 3. Open in Android Studio
```bash
npx cap open android
```

## 🔧 Detailed Build Steps

### Step 1: Prepare the React Build

The React app needs to be built with production settings:

```bash
cd /app/frontend

# Install dependencies (if not already done)
yarn install

# Build for production
yarn build
```

This creates the `/app/frontend/build` directory with optimized assets.

### Step 2: Update Backend URL

The app is configured to use `https://dash.emorvia.in` as the backend API.

Verify in `/app/frontend/.env.production`:
```
REACT_APP_BACKEND_URL=https://dash.emorvia.in
```

### Step 3: Sync with Android

Copy the web assets to the Android project:

```bash
npx cap sync android
```

This command:
- Copies the `build` folder to `android/app/src/main/assets/public`
- Updates native dependencies
- Syncs Capacitor plugins

### Step 4: Configure App Icon

#### Option A: Use Capacitor Asset Generator (Recommended)
```bash
# Install cordova-res
npm install -g cordova-res

# Generate all icon sizes from logo.png
npx cordova-res android --skip-config --copy --icon-source logo.png
```

#### Option B: Manual Icon Setup
Place icons in these directories with specified sizes:
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)

### Step 5: Build Debug APK

#### Using Android Studio (Recommended)
1. Open Android Studio
2. File → Open → Select `/app/frontend/android`
3. Wait for Gradle sync to complete
4. Build → Make Project (Ctrl+F9 / Cmd+F9)
5. Build → Build Bundle(s) / APK(s) → Build APK(s)
6. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Using Command Line
```bash
cd /app/frontend/android
./gradlew assembleDebug
```

APK location: `app/build/outputs/apk/debug/app-debug.apk`

### Step 6: Build Signed Release APK

#### 6.1: Generate Keystore (First Time Only)

```bash
cd /app/frontend/android/app

# Generate keystore
keytool -genkey -v -keystore emorvia-release.keystore \
  -alias emorvia \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be prompted for:
# - Keystore password (save this!)
# - Key password (save this!)
# - Your name, organization, etc.
```

**⚠️ IMPORTANT: Keep these safe!**
- `emorvia-release.keystore` - Store securely (never commit to git)
- Keystore password
- Key alias: `emorvia`
- Key password

#### 6.2: Configure Signing

Create `/app/frontend/android/keystore.properties`:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=emorvia
storeFile=emorvia-release.keystore
```

Update `/app/frontend/android/app/build.gradle`:

Add before `android {` block:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Add inside `android {` block:
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

#### 6.3: Build Release APK

```bash
cd /app/frontend/android
./gradlew assembleRelease
```

Release APK: `app/build/outputs/apk/release/app-release.apk`

#### 6.4: Build AAB for Play Store

```bash
./gradlew bundleRelease
```

Release AAB: `app/build/outputs/bundle/release/app-release.aab`

## 📱 Testing

### Install Debug APK
```bash
# Via ADB
adb install app/build/outputs/apk/debug/app-debug.apk

# Or drag & drop APK to emulator
```

### Test on Physical Device
1. Enable **Developer Options** on your Android phone
2. Enable **USB Debugging**
3. Connect via USB
4. Run: `adb devices` to verify connection
5. Install APK: `adb install app-debug.apk`

### Test in Android Emulator
```bash
# Start emulator from Android Studio or:
emulator -avd Pixel_5_API_33

# Install APK
adb install app-debug.apk
```

## 🔔 Push Notifications Setup (FCM)

### 1. Firebase Project Setup

1. Go to https://console.firebase.google.com
2. Create/select your project
3. Add Android app:
   - Package name: `com.emorvia.app`
   - Download `google-services.json`

### 2. Add google-services.json

Place the file at:
```
/app/frontend/android/app/google-services.json
```

### 3. Update build.gradle

In `/app/frontend/android/build.gradle` (project level):
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

In `/app/frontend/android/app/build.gradle` (app level):
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services' // Add this
}
```

### 4. Get FCM Server Key

1. Firebase Console → Project Settings → Cloud Messaging
2. Copy **Server Key**
3. Add to backend `.env`:
```bash
FCM_SERVER_KEY=your_firebase_server_key_here
```

### 5. Rebuild & Sync
```bash
npx cap sync android
```

## 🛡️ Security Features

### Screenshot & Screen Recording Block

✅ **Already Configured** in `MainActivity.java`:
```java
getWindow().setFlags(
    WindowManager.LayoutParams.FLAG_SECURE,
    WindowManager.LayoutParams.FLAG_SECURE
);
```

This prevents:
- Screenshots (system screenshot button)
- Screen recording (system screen recorder)
- Recent apps preview shows black screen

### Secure Content

✅ Configured in `AndroidManifest.xml`:
- `android:usesCleartextTraffic="false"` - Forces HTTPS
- All API calls go through https://dash.emorvia.in

## 🔑 Permissions Explained

### Automatically Granted
- `INTERNET` - Network access
- `ACCESS_NETWORK_STATE` - Check connection status

### Runtime Permissions (User prompted when needed)
- `CAMERA` - For video calls
- `RECORD_AUDIO` - For audio in calls
- `POST_NOTIFICATIONS` - For call notifications (Android 13+)

### Background Permissions
- `RECEIVE_BOOT_COMPLETED` - Restore notification listener after reboot
- `WAKE_LOCK` - Keep device awake for incoming calls
- `USE_FULL_SCREEN_INTENT` - Full-screen call notifications

## 🖼️ Provider Profile Images

Images are uploaded to your VPS at `https://dash.emorvia.in`

### Backend Configuration

✅ Already configured in `/app/node-backend/.env`:
```bash
PUBLIC_URL=https://dash.emorvia.in
```

### Upload Endpoints
- Provider self-upload: `POST /api/provider/upload`
- Admin upload: `POST /api/admin/upload`

### Image URLs
Uploaded images return URLs like:
```
https://dash.emorvia.in/api/uploads/filename.jpg
```

These URLs work in both web and mobile app.

## 🐛 Troubleshooting

### Build Fails - Gradle Error
```bash
cd /app/frontend/android
./gradlew clean
./gradlew build --refresh-dependencies
```

### APK Install Failed
```bash
# Uninstall old version first
adb uninstall com.emorvia.app

# Reinstall
adb install app-debug.apk
```

### Images Not Loading
1. Check backend is running: `curl https://dash.emorvia.in/api/uploads/test.jpg`
2. Verify `PUBLIC_URL` in backend `.env`
3. Check CORS settings allow your domain

### Camera Permission Denied
```bash
# Grant via ADB (testing only)
adb shell pm grant com.emorvia.app android.permission.CAMERA
adb shell pm grant com.emorvia.app android.permission.RECORD_AUDIO
```

### Push Notifications Not Working
1. Verify `google-services.json` is in correct location
2. Check FCM Server Key in backend
3. Rebuild after adding google-services: `npx cap sync android`
4. Test FCM: Send test notification from Firebase Console

## 📦 Distribution

### Google Play Store

1. **Create Release AAB**
   ```bash
   ./gradlew bundleRelease
   ```

2. **Upload to Play Console**
   - Go to https://play.google.com/console
   - Create app → Upload AAB
   - Fill store listing, content rating, pricing

3. **Review & Publish**
   - Can take 2-7 days for review

### Direct Distribution (APK)

1. **Host APK on your server**
   ```bash
   scp app-release.apk user@yourserver:/var/www/downloads/
   ```

2. **Share download link**
   - Users need to enable "Install from Unknown Sources"
   - Link: `https://yourserver/downloads/app-release.apk`

## 🔄 Update Process

When you update the React app:

```bash
cd /app/frontend

# 1. Update frontend code
# 2. Build React app
yarn build

# 3. Sync to Android
npx cap sync android

# 4. Rebuild APK
cd android
./gradlew assembleRelease

# 5. Upload new APK/AAB
```

## 📞 Support

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Login failed | Check `REACT_APP_BACKEND_URL` in `.env.production` |
| Images not showing | Verify `PUBLIC_URL` in backend `.env` |
| Notifications not working | Add `google-services.json` and rebuild |
| Screenshot blocking not working | Verify `FLAG_SECURE` in MainActivity.java |
| APK too large | Enable ProGuard minification in build.gradle |

### Testing Checklist

Before release, test:
- [ ] User login (OTP)
- [ ] Provider login (OTP)
- [ ] Video call with camera/mic
- [ ] Text chat with scroll
- [ ] Provider profile image upload
- [ ] Incoming call notification
- [ ] Screenshot blocking (try system screenshot)
- [ ] Background app behavior
- [ ] Logout & session persistence

## 📝 Build Summary

**App Info:**
- Package: `com.emorvia.app`
- Name: `Emorvia`
- Backend: `https://dash.emorvia.in`

**Key Files:**
- APK Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- APK Release: `android/app/build/outputs/apk/release/app-release.apk`
- AAB Release: `android/app/build/outputs/bundle/release/app-release.aab`

**Security:**
- ✅ Screenshots blocked
- ✅ Screen recording blocked
- ✅ HTTPS only
- ✅ Signed release builds

---

## 🚀 Quick Commands Reference

```bash
# Build React app
cd /app/frontend && yarn build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Build Debug APK (CLI)
cd android && ./gradlew assembleDebug

# Build Release APK (CLI)
./gradlew assembleRelease

# Build AAB for Play Store
./gradlew bundleRelease

# Install on device
adb install app/build/outputs/apk/debug/app-debug.apk

# View logs
adb logcat | grep Capacitor
```

---

**Need Help?** Check the [Capacitor Documentation](https://capacitorjs.com/docs/android) or open an issue on your project repository.
