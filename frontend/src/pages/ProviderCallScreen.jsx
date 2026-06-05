import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { MobileShell } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr, formatDuration } from "../lib/format";
import { signaling, ICE_CONFIG } from "../lib/signaling";
import { Toaster } from "sonner";

const GRACE_SEC = 10;
const computeAmount = (durationSec, perMinRate) => {
  if (!durationSec || durationSec < GRACE_SEC) return 0;
  return Math.ceil(durationSec / 60) * Math.max(0, Number(perMinRate) || 0);
};

// Callee (provider) side.
export default function ProviderCallScreen() {
  const nav = useNavigate();
  const { userId } = useParams();
  const location = useLocation();
  const userName = location.state?.userName || "User";
  
  const [me, setMe] = useState(null);
  const [caller, setCaller] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [perMinRate, setPerMinRate] = useState(0);
  const [sharePct, setSharePct] = useState(60);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [phase, setPhase] = useState("connecting");
  const [ended, setEnded] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const pc = useRef(null);
  const tickRef = useRef(null);
  const pendingIce = useRef([]);
  const meRef = useRef(null);
  const userIdRef = useRef(null);
  const endedRef = useRef(false);
  const hideTimer = useRef(null);
  const readyPromise = useRef(null);
  const pendingOffer = useRef(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "provider") { nav("/register"); return; }
    (async () => {
      try {
        const [provider, billing] = await Promise.all([api.getProviderMe(), api.getPublicBilling().catch(() => ({ providerSharePct: 60 }))]);
        setMe(provider);
        // Effective share = override or global
        const globalPct = Number(billing?.providerSharePct ?? 60);
        const override = provider?.sharePctOverride;
        setSharePct(override != null && !isNaN(Number(override)) ? Number(override) : globalPct);
        setPerMinRate(Math.max(0, Number(provider?.perMinRate) || 0));
        setCaller({ id: userId, name: userName });
        meRef.current = provider; userIdRef.current = userId;
        signaling.connect(provider.id, "provider");
      } catch { nav("/register"); }
    })();
    let mounted = true;

    // Single init promise — getUserMedia + preparePeer — anything that wants
    // to use pc.current must await this first.
    readyPromise.current = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStream.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
      } catch (e) {
        console.warn("media error", e);
      }
      await preparePeer();
      // If the offer arrived before we were ready, handle it now.
      if (pendingOffer.current) {
        const sdp = pendingOffer.current;
        pendingOffer.current = null;
        await handleOffer(sdp);
      }
    })();

    const offOffer = signaling.on("webrtc_offer", async ({ sdp }) => {
      if (!localStream.current || !pc.current) {
        pendingOffer.current = sdp;
        return;
      }
      await handleOffer(sdp);
    });
    const offIce = signaling.on("webrtc_ice", async ({ candidate }) => {
      if (!candidate) return;
      const c = new RTCIceCandidate(candidate);
      if (pc.current && pc.current.remoteDescription) await pc.current.addIceCandidate(c).catch(() => {});
      else pendingIce.current.push(c);
    });
    const offEnd = signaling.on("call_end", () => endCall(true));

    return () => {
      mounted = false;
      clearTimeout(hideTimer.current);
      offOffer(); offIce(); offEnd();
      cleanup();
    };
    // eslint-disable-next-line
  }, [userId]);

  const preparePeer = async () => {
    if (pc.current) return;
    pc.current = new RTCPeerConnection(ICE_CONFIG);
    if (localStream.current) localStream.current.getTracks().forEach((t) => pc.current.addTrack(t, localStream.current));
    pc.current.ontrack = (e) => {
      remoteStream.current = e.streams[0];
      if (remoteVideo.current && remoteVideo.current.srcObject !== e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
      }
    };
    pc.current.onicecandidate = (e) => {
      if (e.candidate && userIdRef.current) signaling.send("webrtc_ice", userIdRef.current, { candidate: e.candidate.toJSON() });
    };
  };

  const handleOffer = async (sdp) => {
    try {
      await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
      pendingIce.current.forEach((c) => pc.current.addIceCandidate(c).catch(() => {}));
      pendingIce.current = [];
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      signaling.send("webrtc_answer", userIdRef.current, { sdp: answer });
      setPhase("connected");
    } catch (err) {
      console.error("answer failed", err);
    }
  };

  // Re-attach remote stream if video element mounts after ontrack fired
  useEffect(() => {
    if (phase === "connected" && remoteVideo.current && remoteStream.current && remoteVideo.current.srcObject !== remoteStream.current) {
      remoteVideo.current.srcObject = remoteStream.current;
    }
  });

  // Ensure local video is always attached
  useEffect(() => {
    if (localVideo.current && localStream.current && localVideo.current.srcObject !== localStream.current) {
      localVideo.current.srcObject = localStream.current;
    }
  });

  useEffect(() => {
    if (phase !== "connected" || !me || ended) return;
    tickRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [phase, me, ended]);

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

  const cleanup = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (pc.current) { try { pc.current.close(); } catch {} pc.current = null; }
    if (localStream.current) localStream.current.getTracks().forEach((t) => t.stop());
  };

  const endCall = (fromRemote = false) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true); setPhase("ended");
    if (!fromRemote && userIdRef.current) signaling.send("call_end", userIdRef.current);
    cleanup();
    // Server-side bookkeeping is done by the user side via /api/call/log
    nav("/provider");
  };

  const toggleMute = () => setMuted((m) => { const n = !m; localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !n)); return n; });
  const toggleCam = () => setCamOff((c) => { const n = !c; localStream.current?.getVideoTracks().forEach((t) => (t.enabled = !n)); return n; });

  if (!me || !caller) return null;
  const connected = phase === "connected";

  return (
    <MobileShell className="bg-black">
      <Toaster theme="dark" position="top-center" />
      <div className="relative w-full h-screen overflow-hidden bg-black" onClick={tapScreen}>
        {/* Remote video always mounted */}
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover bg-black transition-opacity duration-300 ${connected ? "opacity-100" : "opacity-0"}`}
          onLoadedMetadata={(e) => e.target.play().catch(() => {})}
        />
        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-white/20 border-t-[#6FA8FF] spin" />
          </div>
        )}

        <div className="absolute top-5 right-5 w-24 h-32 rounded-2xl overflow-hidden border-2 border-white/20 bg-black shadow-xl z-20">
          <video 
            ref={localVideo} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover ${camOff ? "hidden" : ""}`}
            onLoadedMetadata={(e) => e.target.play().catch(() => {})}
          />
          {camOff && <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60">CAM OFF</div>}
        </div>

        <div className={`absolute top-0 left-0 right-0 z-10 px-5 pt-5 transition-opacity duration-300 ${connected && !showControls ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-[#10B981] dot-pulse" : "bg-[#6FA8FF] dot-pulse"}`} />
            <span className="text-xs uppercase tracking-[0.2em] text-white/70 font-medium">
              {connected ? "Live · Earning" : "Connecting..."}
            </span>
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight mt-2 text-white drop-shadow">{caller.name}</h2>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-24 left-5 right-5 z-[60] backdrop-blur-2xl bg-black/55 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 transition-all duration-300 ${connected && !showControls ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Duration</p>
              <p className="font-heading text-2xl font-bold tabular-nums" data-testid="pcall-timer">{formatDuration(seconds)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Your earning</p>
              <p className="font-heading text-2xl font-bold text-[#10B981] tabular-nums" data-testid="pcall-earned">{inr((computeAmount(seconds, perMinRate) * sharePct) / 100)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>Total bill {inr(computeAmount(seconds, perMinRate))}</span>
            <span>You keep {sharePct}%</span>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Ctrl onClick={toggleMute} active={muted} data-testid="pcall-mute">{muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</Ctrl>
            <Ctrl onClick={toggleCam} active={camOff} data-testid="pcall-cam">{camOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}</Ctrl>
            <button data-testid="pcall-end" onClick={(e) => { e.stopPropagation(); endCall(false); }} className="w-16 h-16 rounded-full bg-[#EF4444] hover:bg-[#DC2626] flex items-center justify-center transition-transform active:scale-95 shadow-[0_8px_24px_rgba(239,68,68,0.45)]">
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {connected && !showControls && (
          <div className="absolute bottom-6 left-0 right-0 z-10 text-center pointer-events-none">
            <span className="text-[11px] uppercase tracking-[0.25em] text-white/35">Tap screen to show controls</span>
          </div>
        )}

        {ended && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="text-center">
              <p className="font-heading text-2xl font-bold">Call ended</p>
              <p className="text-white/60 text-sm mt-2">Duration {formatDuration(seconds)} · Earned {inr((computeAmount(seconds, perMinRate) * sharePct) / 100)}</p>
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
