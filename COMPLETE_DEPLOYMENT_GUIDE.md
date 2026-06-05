# 🚀 Complete Beginner's Guide - VPS Deployment & Android APK/AAB Generation

This guide is for complete beginners. Follow each step carefully.

---

## Part 1: VPS Deployment 🖥️

### What is VPS?
VPS (Virtual Private Server) is like renting a computer in the cloud where your app runs 24/7.

### Step 1: Choose a VPS Provider

**Popular Options:**
- **DigitalOcean** - Easy for beginners
- **AWS Lightsail** - Good value
- **Linode** - Developer friendly
- **Vultr** - Fast deployment

**Minimum Requirements:**
- RAM: 2GB
- Storage: 50GB SSD
- OS: Ubuntu 22.04 LTS

### Step 2: Initial VPS Setup

#### 2.1: Connect to Your VPS

**On Windows:**
```bash
# Download PuTTY from https://www.putty.org/
# Enter your VPS IP address
# Port: 22
# Click "Open"
# Login with username: root
# Enter password provided by VPS provider
```

**On Mac/Linux:**
```bash
ssh root@YOUR_VPS_IP
# Enter password when prompted
```

#### 2.2: Update System
```bash
apt update && apt upgrade -y
```

#### 2.3: Create New User (Security)
```bash
# Create user
adduser emorvia
# Set password when prompted

# Give sudo permissions
usermod -aG sudo emorvia

# Switch to new user
su - emorvia
```

### Step 3: Install Required Software

#### 3.1: Install Node.js
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

#### 3.2: Install MongoDB
```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
   --dearmor

# Create list file
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
```

#### 3.3: Install Nginx (Web Server)
```bash
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

#### 3.4: Install PM2 (Process Manager)
```bash
sudo npm install -g pm2 yarn
```

### Step 4: Deploy Backend

#### 4.1: Upload Your Code

**Option A: Using Git (Recommended)**
```bash
cd /home/emorvia
git clone YOUR_REPO_URL emorvia-app
cd emorvia-app
```

**Option B: Using SCP (Copy from local)**
```bash
# On your local machine
cd /path/to/your/project
tar -czf emorvia.tar.gz node-backend frontend

# Upload to VPS
scp emorvia.tar.gz emorvia@YOUR_VPS_IP:/home/emorvia/

# On VPS
cd /home/emorvia
tar -xzf emorvia.tar.gz
mv node-backend /opt/emorvia-backend
mv frontend /opt/emorvia-frontend
```

#### 4.2: Configure Backend

```bash
cd /opt/emorvia-backend

# Install dependencies
npm install

# Create .env file
nano .env
```

**Paste this in .env:**
```bash
MONGO_URL=mongodb://localhost:27017/emorvia
PORT=8001
JWT_SECRET=emorvia_jwt_secret_2026_CHANGE_THIS_IN_PRODUCTION
ADMIN_USERNAME=admindash
ADMIN_PASSWORD=Admin#2026*
WELCOME_BONUS=50
PUBLIC_URL=https://dash.emorvia.in

# MessageCentral OTP
MC_CUSTOMER_ID=C-E2EDF3036EDD41B
MC_AUTH_TOKEN=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLUUyRURGMzAzNkVERDQxQiIsImlhdCI6MTc3ODk5NDc4NywiZXhwIjoxOTM2Njc0Nzg3fQ.w4WuuGZML4qciXn9oCtXNMRo7WmUQa4ZEO3AA3Nv-RTTEZZpsn_Jj5AT32Z7SuUAHQ2_yzqamCoEGimhNbOKHw

# VAPID for web push
VAPID_SUBJECT=mailto:admin@emorvia.in

# CORS
CORS_ORIGIN=*
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

#### 4.3: Start Backend with PM2
```bash
cd /opt/emorvia-backend

# Start backend
pm2 start server.js --name emorvia-backend

# Save PM2 configuration
pm2 save

# Enable PM2 on system boot
pm2 startup
# Copy and run the command it shows
```

**Verify backend is running:**
```bash
pm2 status
pm2 logs emorvia-backend

# Test API
curl http://localhost:8001/api/providers
```

### Step 5: Deploy Frontend

#### 5.1: Build React App
```bash
cd /opt/emorvia-frontend

# Install dependencies
yarn install

# Build for production
yarn build
```

#### 5.2: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/emorvia
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    server_name dash.emorvia.in;  # Replace with your domain

    # Frontend - React build
    location / {
        root /opt/emorvia-frontend/build;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API - Proxy to Node.js
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for video calls
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Upload size limit for profile images
    client_max_body_size 10M;
}
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

#### 5.3: Enable Nginx Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/emorvia /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 6: Setup Domain & SSL

#### 6.1: Point Domain to VPS

**In your domain registrar (GoDaddy, Namecheap, etc.):**
1. Login to your domain control panel
2. Find DNS settings
3. Add/Edit A Record:
   - Type: `A`
   - Name: `dash` (or `@` for root domain)
   - Value: `YOUR_VPS_IP_ADDRESS`
   - TTL: `3600`
4. Save changes
5. Wait 5-30 minutes for DNS propagation

**Verify DNS:**
```bash
ping dash.emorvia.in
# Should show your VPS IP
```

#### 6.2: Install SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d dash.emorvia.in

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

### Step 7: Verify Deployment

**Test each endpoint:**
```bash
# Test frontend
curl https://dash.emorvia.in

# Test backend API
curl https://dash.emorvia.in/api/providers

# Test image upload directory
curl https://dash.emorvia.in/api/uploads/
```

**Open in browser:**
- Frontend: https://dash.emorvia.in
- Backend API: https://dash.emorvia.in/api/providers

### Step 8: Setup Firewall

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 9: Regular Maintenance

#### Check Logs
```bash
# Backend logs
pm2 logs emorvia-backend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

#### Restart Services
```bash
# Restart backend
pm2 restart emorvia-backend

# Restart Nginx
sudo systemctl restart nginx

# Restart MongoDB
sudo systemctl restart mongod
```

#### Update Application
```bash
# Pull latest code
cd /opt/emorvia-backend
git pull

# Restart backend
pm2 restart emorvia-backend

# Update frontend
cd /opt/emorvia-frontend
git pull
yarn build
```

---

## Part 2: Generate APK/AAB in Android Studio 📱

### Prerequisites

#### Install Android Studio
1. Download from: https://developer.android.com/studio
2. Run installer
3. Follow setup wizard (install all default components)
4. Takes 10-20 minutes

#### Install Java JDK 17
1. Download from: https://www.oracle.com/java/technologies/downloads/
2. Install JDK 17
3. Verify: `java -version` (should show 17.x.x)

### Step 1: Prepare React Build

**On your development machine:**

```bash
cd /app/frontend

# Make sure all dependencies are installed
yarn install

# Build React app for production
yarn build

# This creates /app/frontend/build directory
# Takes 2-5 minutes
```

**You should see:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:
  main.js: 234 KB
  ...

The build folder is ready to be deployed.
```

### Step 2: Sync to Android

```bash
cd /app/frontend

# Sync web build to Android project
npx cap sync android
```

**You should see:**
```
✔ Copying web assets from build to android/app/src/main/assets/public in 1.23s
✔ Updating Android plugins in 32.14ms
✔ Updating Android native dependencies with Gradle in 2.34s
✔ copy android in 3.61s
✔ Updating Android plugins in 7.53ms
✔ sync finished in 3.63s
```

### Step 3: Open in Android Studio

```bash
# Open Android Studio
npx cap open android
```

**Or manually:**
1. Open Android Studio
2. Click "Open"
3. Navigate to `/app/frontend/android`
4. Click "OK"

**First Time Setup (takes 5-10 minutes):**
- Gradle sync will start automatically
- Wait for "Gradle sync finished" message
- May see "Install missing platforms" - click "Install"
- May see "Install build tools" - click "Install"

### Step 4: Configure Android Studio

#### 4.1: Check SDK
1. Go to: **File → Settings** (Windows/Linux) or **Android Studio → Preferences** (Mac)
2. Navigate to: **Appearance & Behavior → System Settings → Android SDK**
3. Ensure these are checked:
   - Android 13.0 (API 33) ✓
   - Android SDK Build-Tools 33
   - Android SDK Platform-Tools
   - Android SDK Tools
4. Click "Apply" if anything is unchecked
5. Wait for downloads to complete

#### 4.2: Check Gradle
1. Look at bottom-right corner
2. Wait for "Gradle sync finished successfully"
3. If errors appear, click "Try Again"

### Step 5: Generate Debug APK (For Testing)

This APK is for testing only, not for distribution.

#### Method 1: Using Build Menu (Easiest)

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait 2-5 minutes (first build takes longer)
3. Look for notification: **"APK(s) generated successfully"**
4. Click **"locate"** in notification

**APK Location:**
```
/app/frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

#### Method 2: Using Terminal in Android Studio

1. Click **"Terminal"** tab at bottom
2. Run:
```bash
./gradlew assembleDebug
```
3. Wait for "BUILD SUCCESSFUL"
4. APK at: `app/build/outputs/apk/debug/app-debug.apk`

### Step 6: Test Debug APK

#### Install on Emulator

1. **Tools → AVD Manager** (Android Virtual Device Manager)
2. Click **"Create Virtual Device"**
3. Select **"Pixel 5"** or similar
4. Select **"System Image"** (API 33 recommended)
5. Click **"Next"** → **"Finish"**
6. Click **"Play"** button to start emulator
7. Wait for emulator to boot (2-3 minutes first time)

**Install APK:**
1. Drag and drop `app-debug.apk` onto emulator screen
2. Or run:
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

#### Install on Physical Device

1. Enable Developer Options on phone:
   - Settings → About Phone → Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging ON
3. Connect phone via USB
4. Allow USB debugging popup on phone
5. In Android Studio terminal:
```bash
# Check device is connected
adb devices

# Install APK
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Step 7: Generate Signed Release APK

This is for distribution (share with users, not Play Store).

#### 7.1: Generate Keystore (First Time Only)

**⚠️ VERY IMPORTANT: Keep this keystore safe! If you lose it, you can't update your app.**

1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Select **"APK"**
3. Click **"Next"**
4. Click **"Create new..."** (under Key store path)

**Fill in details:**
```
Key store path: /app/frontend/android/app/emorvia-release.keystore
Password: [Create strong password] (SAVE THIS!)
Confirm password: [Same password]

Key alias: emorvia
Password: [Create strong password] (SAVE THIS!)
Confirm password: [Same password]
Validity (years): 25

Certificate:
First and Last Name: Your Name
Organizational Unit: Emorvia
Organization: Emorvia
City: Your City
State: Your State
Country Code: IN (or your country)
```

5. Click **"OK"**

**⚠️ BACKUP YOUR KEYSTORE:**
```bash
# Copy keystore to safe location
cp /app/frontend/android/app/emorvia-release.keystore ~/emorvia-keystore-BACKUP.keystore

# Also save passwords in secure password manager!
```

#### 7.2: Generate Signed APK

1. **Build → Generate Signed Bundle / APK**
2. Select **"APK"**
3. Click **"Next"**
4. Fill in:
   - Key store path: (select your keystore)
   - Key store password: (enter password)
   - Key alias: emorvia
   - Key password: (enter password)
5. Click **"Next"**
6. Select **"release"** build variant
7. ✓ Check both signature versions (V1 and V2)
8. Click **"Finish"**
9. Wait 2-5 minutes

**Signed APK Location:**
```
/app/frontend/android/app/build/outputs/apk/release/app-release.apk
```

### Step 8: Generate AAB (For Google Play Store)

AAB (Android App Bundle) is required for Play Store.

#### 8.1: Generate Signed AAB

1. **Build → Generate Signed Bundle / APK**
2. Select **"Android App Bundle"**
3. Click **"Next"**
4. Fill in keystore details (same as before)
5. Click **"Next"**
6. Select **"release"** build variant
7. Click **"Finish"**
8. Wait 2-5 minutes

**AAB Location:**
```
/app/frontend/android/app/build/outputs/bundle/release/app-release.aab
```

### Step 9: Verify APK/AAB

#### Check APK Info
```bash
# Using aapt (Android Asset Packaging Tool)
cd /app/frontend/android/app/build/outputs/apk/release

# Check package name
aapt dump badging app-release.apk | grep package

# Should show:
# package: name='com.emorvia.app'
```

#### Test Signed APK
```bash
# Install signed APK
adb install app-release.apk

# If already installed:
adb install -r app-release.apk

# Launch app
adb shell am start -n com.emorvia.app/.MainActivity
```

### Step 10: Troubleshooting

#### Build Failed - Gradle Error
```bash
# Clean and rebuild
cd /app/frontend/android
./gradlew clean
./gradlew build --refresh-dependencies
```

#### "SDK not found"
1. File → Project Structure → SDK Location
2. Check Android SDK location (should be set)
3. Download SDK if missing

#### "Unable to find bundletool"
```bash
# In Android Studio terminal
./gradlew :app:bundleRelease
```

#### APK Too Large
1. File → Settings → Build, Execution, Deployment → Compiler
2. Check "Enable R8" (minification)
3. Rebuild

#### APK Won't Install
```bash
# Uninstall old version first
adb uninstall com.emorvia.app

# Then install new
adb install app-release.apk
```

---

## Summary - Quick Commands

### VPS Deployment
```bash
# Deploy backend
cd /opt/emorvia-backend
pm2 restart emorvia-backend

# Deploy frontend
cd /opt/emorvia-frontend
yarn build
sudo systemctl restart nginx
```

### Android Build
```bash
# Build React app
cd /app/frontend
yarn build

# Sync to Android
npx cap sync android

# Open Android Studio
npx cap open android

# Build Debug APK (in Android Studio terminal)
./gradlew assembleDebug

# Build Release APK
Build → Generate Signed Bundle / APK → APK → Select keystore → Finish

# Build AAB for Play Store
Build → Generate Signed Bundle / APK → Android App Bundle → Select keystore → Finish
```

### Output Files
```
Debug APK:   android/app/build/outputs/apk/debug/app-debug.apk
Release APK: android/app/build/outputs/apk/release/app-release.apk
Release AAB: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 🎯 Checklist

### VPS Deployment ✓
- [ ] VPS purchased and accessible
- [ ] Domain pointed to VPS IP
- [ ] Node.js, MongoDB, Nginx installed
- [ ] Backend running with PM2
- [ ] Frontend built and served by Nginx
- [ ] SSL certificate installed (HTTPS working)
- [ ] Firewall configured
- [ ] Can access https://dash.emorvia.in

### Android Build ✓
- [ ] Android Studio installed
- [ ] Java JDK 17 installed
- [ ] React app built (`yarn build`)
- [ ] Android project synced (`npx cap sync`)
- [ ] Debug APK generated and tested
- [ ] Keystore created and backed up
- [ ] Signed Release APK generated
- [ ] AAB generated for Play Store
- [ ] Screenshot blocking tested
- [ ] Camera/microphone permissions tested

---

**Need Help?** 
- VPS issues: Check PM2 logs (`pm2 logs`)
- Android issues: Check Logcat (Android Studio → Logcat tab)
- Build errors: Run `./gradlew clean` then rebuild

