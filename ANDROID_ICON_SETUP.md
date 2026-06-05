# Android App Icon Setup

## Logo File
The Emorvia logo is at `/app/frontend/logo.png`

## Generate Android Icons

### Option 1: Using cordova-res (Easiest)
```bash
cd /app/frontend
npm install -g cordova-res
npx cordova-res android --skip-config --copy --icon-source logo.png
```

### Option 2: Manual Resize (if cordova-res not available)

Use ImageMagick or online tools to create these sizes:

| Density | Size | Location |
|---------|------|----------|
| mdpi | 48x48 | `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` |
| hdpi | 72x72 | `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` |
| xhdpi | 96x96 | `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` |
| xxhdpi | 144x144 | `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` |
| xxxhdpi | 192x192 | `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` |

### Using ImageMagick (if installed)
```bash
# Install ImageMagick (Ubuntu/Debian)
apt-get install imagemagick

# Generate all sizes
convert logo.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert logo.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert logo.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert logo.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert logo.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

### Using Online Tool
1. Upload `logo.png` to https://icon.kitchen or https://appicon.co
2. Download Android icon pack
3. Extract to `android/app/src/main/res/` directories

## Splash Screen (Optional)

For a splash screen, create:
- Light theme: `android/app/src/main/res/drawable/splash.png` (2732x2732)
- Dark theme: `android/app/src/main/res/drawable-night/splash.png` (2732x2732)

Then configure in `capacitor.config.ts`:
```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: "#101428",
    showSpinner: false
  }
}
```
