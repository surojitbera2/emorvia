// Native image picker for the Capacitor Android app.
//
// Why we need this:
//   The standard <input type="file"> element doesn't reliably open the system
//   gallery on Capacitor Android (especially Android 13+ where Scoped Storage /
//   MediaPicker behaviour changed). Capacitor's @capacitor/camera plugin gives
//   us a stable, permission-aware gallery picker that works on every Android
//   version we care about.
//
// Usage:
//   const files = await pickImagesFromGallery(8);  // returns File[]
//   if (files.length) { /* upload them */ }
//
// On web/browser this falls back to a hidden file input automatically so the
// same call site works in both environments.

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const isNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch { return false; }
};

/** Convert a base64 "image/jpeg" string into a File the API can upload. */
const base64ToFile = (b64, filename, mime = "image/jpeg") => {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
};

/** Picks up to `max` images. On native: uses Capacitor Camera (photo picker).
 *  On web: opens a hidden <input type="file" multiple>. Returns Promise<File[]>. */
export async function pickImagesFromGallery(max = 8) {
  if (isNative()) {
    try {
      // pickImages = multi-image gallery picker (Android Photo Picker / iOS limited
      // photo selection). No runtime permission needed on Android 13+ because the
      // OS-provided picker has its own scoped access.
      const res = await Camera.pickImages({
        quality: 88,
        limit: Math.max(1, Math.min(max, 8)),
      });
      const photos = Array.isArray(res?.photos) ? res.photos : [];
      const files = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        try {
          // Each photo has a webPath we can fetch as a blob.
          const r = await fetch(p.webPath);
          const blob = await r.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || (p.format || "jpg");
          files.push(new File([blob], `photo-${Date.now()}-${i}.${ext}`, { type: blob.type || "image/jpeg" }));
        } catch (e) {
          console.warn("pickImagesFromGallery: failed to read photo", i, e?.message);
        }
      }
      return files;
    } catch (e) {
      // User cancelled or plugin error. Treat as empty selection.
      console.warn("pickImagesFromGallery cancelled/failed:", e?.message);
      return [];
    }
  }

  // Web fallback — hidden <input> element.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = max > 1;
    input.style.display = "none";
    document.body.appendChild(input);
    let done = false;
    const cleanup = () => { try { document.body.removeChild(input); } catch (_e) { /* noop */ } };
    input.onchange = (e) => {
      done = true;
      const files = Array.from(e.target.files || []).slice(0, max);
      cleanup();
      resolve(files);
    };
    // If the user cancels, the change event never fires. We do a best-effort
    // cleanup after focus returns (browser quirk).
    window.addEventListener("focus", () => {
      setTimeout(() => { if (!done) { cleanup(); resolve([]); } }, 1500);
    }, { once: true });
    input.click();
  });
}

/** Take a single photo from the camera (front/rear). Returns File or null. */
export async function takePhotoFromCamera() {
  if (!isNative()) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 88,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });
    if (!photo?.base64String) return null;
    return base64ToFile(photo.base64String, `camera-${Date.now()}.jpg`, "image/jpeg");
  } catch (e) {
    console.warn("takePhotoFromCamera cancelled/failed:", e?.message);
    return null;
  }
}
