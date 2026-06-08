import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { MobileShell } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr, formatDuration } from "../lib/format";
import { signaling, ICE_CONFIG } from "../lib/signaling";
import { toast, Toaster } from "sonner";

const GRACE_SEC = 10; // calls under this don't charge

const billedMinutes = (sec) => {
  if (!sec || sec < GRACE_SEC) return 0;
  return Math.ceil(sec / 60);
};

const computeAmount = (durationSec, perMinRate) => {
  const rate = Math.max(0, Number(perMinRate) || 0);
  return billedMinutes(durationSec) * rate;
};

// Caller (user) side.
export default function CallScreen() {
  const nav = useNavigate();
  const { id: providerId } = useParams();
  const [provider, setProvider] = useState(null);
  const [user, setUser] = useState(null);
  const [perMinRate, setPerMinRate] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [phase, setPhase] = useState("ringing");
  const [ended, setEnded] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const accepted = useRef(false);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const pc = useRef(null);
  const tickRef = useRef(null);
  const pendingIce = useRef([]);
  const providerRef = useRef(null);
  const userRef = useRef(null);
  const perMinRateRef = useRef(0);
  const maxSecRef = useRef(0);
  const secondsRef = useRef(0);
  const endedRef = useRef(false);
  const hideTimer = useRef(null);
  const mediaReady = useRef(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/register"); return; }
    signaling.connect(s.id, "user");
    let mounted = true;
    let retryTimer = null;
    let timeoutTimer = null;

    const init = async () => {
      try {
        const [p, u] = await Promise.all([
          api.getProvider(providerId),
          api.getMe(),
        ]);
        if (!mounted) return;
        const rate = Math.max(0, Number(p?.callPerMinRate ?? p?.perMinRate) || 0);
        setPerMinRate(rate);
        perMinRateRef.current = rate;

        // Pre-call safety check: block if wallet < 1 minute rate
        if (rate <= 0) {
          toast.error("Listener hasn't set a call rate yet. Try someone else.");
          nav("/app");
          return;
        }
        if (u.wallet < rate) {
          toast.error(`Need at least ${inr(rate)} (1 minute) to start a call. Please recharge.`);
          nav("/wallet");
          return;
        }

        // Max allowed seconds = floor(wallet / rate) minutes × 60
        const maxSec = Math.floor(u.wallet / rate) * 60;
        maxSecRef.current = maxSec;

        setProvider(p); setUser(u);
        providerRef.current = p; userRef.current = u;
      } catch {
        nav("/app");
        return;
      }

      mediaReady.current = (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
          if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStream.current = stream;
          if (localVideo.current) localVideo.current.srcObject = stream;
        } catch (e) {
          toast.error("Camera/mic blocked. Allow permissions.");
        }
      })();
      await mediaReady.current;
      await signaling.ready();
      if (!mounted) return;
      const p = providerRef.current;
      const u = userRef.current;
      if (!p || !u) return;
      const ring = () => signaling.send("call_request", p.id, { fromName: u.name });
      ring();
      retryTimer = setInterval(() => { if (mounted) ring(); }, 2500);
      timeoutTimer = setTimeout(() => {
        if (!mounted) return;
        toast.error("Provider didn't answer");
        clearInterval(retryTimer);
        cleanup();
        nav("/app");
      }, 30000);
    };
    init();

    const offAccept = signaling.on("call_accept", async () => {
      if (accepted.current) return;
      accepted.current = true;
      clearInterval(retryTimer);
      clearTimeout(timeoutTimer);
      // CRITICAL: wait for camera/mic so the offer carries local tracks,
      // otherwise SDP negotiation ends with no media in either direction.
      if (mediaReady.current) await mediaReady.current;
      setPhase("connected");
      await startPeer(true);
    });
    const offReject = signaling.on("call_reject", (msg) => {
      if (accepted.current) return;
      accepted.current = true;
      clearInterval(retryTimer);
      clearTimeout(timeoutTimer);
      if (msg?.reason === "blocked") toast.error("You have been blocked by this provider.");
      else if (msg?.reason === "offline") toast.error("Provider is offline.");
      else toast.error("Call rejected");
      cleanup();
      nav("/app");
    });
    const offAnswer = signaling.on("webrtc_answer", async ({ sdp }) => {
      if (!pc.current) return;
      await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
      pendingIce.current.forEach((c) => pc.current.addIceCandidate(c).catch(() => {}));
      pendingIce.current = [];
    });
    const offIce = signaling.on("webrtc_ice", async ({ candidate }) => {
      if (!candidate) return;
      const c = new RTCIceCandidate(candidate);
      if (pc.current && pc.current.remoteDescription) await pc.current.addIceCandidate(c).catch(() => {});
      else pendingIce.current.push(c);
    });
    const offEnd = signaling.on("call_end", () => endCall(false, true));

    return () => {
      mounted = false;
      clearInterval(retryTimer);
      clearTimeout(timeoutTimer);
      clearTimeout(hideTimer.current);
      offAccept(); offReject(); offAnswer(); offIce(); offEnd();
      cleanup();
    };
    // eslint-disable-next-line
  }, [providerId]);

  // Auto-hide controls 4s after connected
  useEffect(() => {
    if (phase !== "connected") return;
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(hideTimer.current);
  }, [phase]);

  const tapScreen = () => {
    if (phase !== "connected") return;
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  const startPeer = async (isCaller) => {
    const p = providerRef.current;
    pc.current = new RTCPeerConnection(ICE_CONFIG);
    if (localStream.current) localStream.current.getTracks().forEach((t) => pc.current.addTrack(t, localStream.current));
    pc.current.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteVideo.current && remoteVideo.current.srcObject !== e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
      }
    };
    pc.current.onicecandidate = (e) => {
      if (e.candidate && p) signaling.send("webrtc_ice", p.id, { candidate: e.candidate.toJSON() });
    };
    if (isCaller && p) {
      try {
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        signaling.send("webrtc_offer", p.id, { sdp: offer });
      } catch (err) {
        console.error("createOffer failed:", err);
      }
    }
  };

  // Attach remote stream to video element if it became available later
  useEffect(() => {
    if (phase === "connected" && remoteVideo.current && remoteStream.current && remoteVideo.current.srcObject !== remoteStream.current) {
      remoteVideo.current.srcObject = remoteStream.current;
    }
  });

  useEffect(() => {
    if (phase !== "connected" || !provider || ended) return;
    tickRef.current = setInterval(() => {
      setSeconds((s) => {
        const nxt = s + 1;
        secondsRef.current = nxt;
        // Auto-end when user's wallet runs out (calculated max sec)
        const maxSec = maxSecRef.current || 0;
        if (maxSec > 0 && nxt >= maxSec) {
          setTimeout(() => endCall(true), 0);
        }
        return nxt;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line
  }, [phase, provider, ended]);

  const cleanup = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (pc.current) { try { pc.current.close(); } catch {} pc.current = null; }
    if (localStream.current) localStream.current.getTracks().forEach((t) => t.stop());
  };

  const logSent = useRef(false);

  const endCall = (autoCutoff = false, fromRemote = false) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    setPhase("ended");
    const p = providerRef.current;
    if (!fromRemote && p) {
      // While still ringing this is a cancel (caller hung up before callee
      // answered) → tell callee to dismiss incoming dialog + Android UI.
      // Once connected, it's a mid-call hangup → call_end so server bills.
      const evt = phase === "connected" ? "call_end" : "call_cancel";
      signaling.send(evt, p.id);
    }
    cleanup();
    if (p && secondsRef.current > 0 && !logSent.current) {
      logSent.current = true;
      // Server is source of truth; we also send durationSec so server recomputes amount.
      api.saveCallLog({ providerId: p.id, durationSec: secondsRef.current, autoCutoff }).catch(() => {});
    }
    nav("/app");
  };

  const toggleMute = () => setMuted((m) => { const n = !m; localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !n)); return n; });
  const toggleCam = () => setCamOff((c) => { const n = !c; localStream.current?.getVideoTracks().forEach((t) => (t.enabled = !n)); return n; });

  if (!provider || !user) return null;
  const currentAmount = computeAmount(seconds, perMinRate);
  const maxSec = maxSecRef.current || 0;
  const remaining = Math.max(0, maxSec - seconds);
  const connected = phase === "connected";

  return (
    <MobileShell className="bg-black">
      <Toaster theme="dark" position="top-center" />
      <div className="relative w-full h-screen overflow-hidden bg-black" onClick={tapScreen}>
        {/* Remote video — always mounted so ontrack ref is stable */}
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover bg-black transition-opacity duration-300 ${connected ? "opacity-100" : "opacity-0"}`}
        />
        {/* Pre-connect placeholder */}
        {!connected && (
          <div className="absolute inset-0">
            <img src={provider.avatar} alt={provider.name} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
          </div>
        )}

        {/* Local PiP */}
        <div className="absolute top-5 right-5 w-24 h-32 rounded-2xl overflow-hidden border-2 border-white/20 bg-black shadow-xl z-20">
          <video ref={localVideo} autoPlay playsInline muted className={`w-full h-full object-cover ${camOff ? "hidden" : ""}`} />
          {camOff && <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60">CAM OFF</div>}
        </div>

        {/* Status (top) */}
        <div className={`absolute top-0 left-0 right-0 z-10 px-5 pt-5 transition-opacity duration-300 ${connected && !showControls ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-[#10B981] dot-pulse" : "bg-[#6FA8FF] dot-pulse"}`} />
            <span className="text-xs uppercase tracking-[0.2em] text-white/70 font-medium">
              {phase === "ringing" ? "Ringing..." : connected ? "In call · Encrypted" : "Ended"}
            </span>
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight mt-2 text-white drop-shadow">{provider.name}</h2>
        </div>

        {/* Bottom overlay with timer + controls (auto-hides when connected) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-24 left-5 right-5 z-[60] backdrop-blur-2xl bg-black/55 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 transition-all duration-300 ${connected && !showControls ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Duration</p>
              <p className="font-heading text-2xl font-bold tabular-nums" data-testid="call-timer">{formatDuration(seconds)}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{maxSec > 0 ? `Ends at ${formatDuration(maxSec)}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Charged</p>
              <p className="font-heading text-2xl font-bold text-[#6FA8FF] tabular-nums" data-testid="call-amount">{inr(currentAmount)}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{inr(perMinRate)}/min</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>Wallet {inr(user.wallet)}</span>
            <span>{formatDuration(remaining)} left</span>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Ctrl onClick={toggleMute} active={muted} data-testid="call-mute">{muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</Ctrl>
            <Ctrl onClick={toggleCam} active={camOff} data-testid="call-cam">{camOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}</Ctrl>
            <button data-testid="call-end" onClick={(e) => { e.stopPropagation(); endCall(false); }} className="w-16 h-16 rounded-full bg-[#EF4444] hover:bg-[#DC2626] flex items-center justify-center transition-transform active:scale-95 shadow-[0_8px_24px_rgba(239,68,68,0.45)]">
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Tap hint when controls hidden */}
        {connected && !showControls && (
          <div className="absolute bottom-6 left-0 right-0 z-10 text-center pointer-events-none">
            <span className="text-[11px] uppercase tracking-[0.25em] text-white/35">Tap screen to show controls</span>
          </div>
        )}

        {ended && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="text-center">
              <p className="font-heading text-2xl font-bold">Call ended</p>
              <p className="text-white/60 text-sm mt-2">Duration {formatDuration(seconds)} · Charged {inr(currentAmount)}</p>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

const Ctrl = ({ children, active, onClick, ...props }) => (
  <button
    {...props}
    onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
    className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${active ? "bg-white text-black border-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
  >
    {children}
  </button>
);
