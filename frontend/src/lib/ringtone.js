// Phone-style ringtone. Uses /ringtone.wav (looped HTMLAudio) for reliable
// playback in WebView / minimized browsers, with a WebAudio fallback for
// when the file isn't loaded yet.

let audioEl = null;
let fallbackCtx = null;
let fallbackTimer = null;
let fallbackGain = null;

const initAudio = () => {
  if (audioEl) return audioEl;
  try {
    audioEl = new Audio("/ringtone.wav");
    audioEl.loop = true;
    audioEl.volume = 1.0;
    // Some Android WebViews need this hint
    audioEl.setAttribute("playsinline", "true");
    audioEl.preload = "auto";
  } catch {
    audioEl = null;
  }
  return audioEl;
};

// Fallback: generate ring tones via WebAudio when file playback fails
const fallbackTone = (freq, durMs) => {
  if (!fallbackCtx) return;
  try {
    const osc = fallbackCtx.createOscillator();
    const g = fallbackCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(fallbackGain);
    const now = fallbackCtx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.02);
    g.gain.linearRampToValueAtTime(0, now + durMs / 1000);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.05);
  } catch {}
};
const fallbackRingPattern = () => {
  fallbackTone(450, 400);
  setTimeout(() => fallbackTone(450, 400), 600);
};
const startFallback = () => {
  try {
    if (!fallbackCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      fallbackCtx = new AC();
      fallbackGain = fallbackCtx.createGain();
      fallbackGain.gain.value = 0.7;
      fallbackGain.connect(fallbackCtx.destination);
    }
    if (fallbackCtx.state === "suspended") fallbackCtx.resume().catch(() => {});
    if (fallbackTimer) return;
    fallbackRingPattern();
    fallbackTimer = setInterval(fallbackRingPattern, 2200);
  } catch {}
};
const stopFallback = () => {
  if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
  try { if (fallbackCtx && fallbackCtx.state !== "closed") fallbackCtx.suspend().catch(() => {}); } catch {}
};

export const ringtone = {
  // Must be called once after a user gesture so subsequent autoplay is allowed.
  warmUp() {
    const a = initAudio();
    if (a) {
      // Play + immediately pause to unlock autoplay policy
      a.muted = true;
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }).catch(() => {});
    }
  },
  start() {
    const a = initAudio();
    let played = false;
    if (a) {
      try {
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.then(() => { played = true; }).catch(() => {
            // Autoplay blocked — fall back to WebAudio oscillator
            startFallback();
          });
        } else {
          played = true;
        }
      } catch {
        startFallback();
      }
    } else {
      startFallback();
    }
    // Defensive: if the audio element is silent for any reason, also start fallback
    setTimeout(() => {
      if (a && a.paused) startFallback();
    }, 800);
  },
  stop() {
    if (audioEl) {
      try { audioEl.pause(); audioEl.currentTime = 0; } catch {}
    }
    stopFallback();
  },
};
