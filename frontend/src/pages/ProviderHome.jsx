import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Phone, TrendingUp, X, Check, BellRing, UserCog, Hourglass } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav, PrimaryButton } from "../components/MobileShell";
import InstallAppPrompt from "../components/InstallAppPrompt";
import { api } from "../lib/store";
import { getSession, clearSession } from "../lib/auth";
import { inr } from "../lib/format";
import { signaling } from "../lib/signaling";
import { ringtone } from "../lib/ringtone";
import { notify } from "../lib/notify";
import { webPush } from "../lib/webPush";
import { toast, Toaster } from "sonner";

export default function ProviderHome() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const onlineRef = React.useRef(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "provider") { nav("/provider/login"); return; }
    (async () => {
      try {
        const p = await api.getProviderMe();
        setMe(p); onlineRef.current = p.online;
        signaling.connect(p.id);
      } catch { clearSession(); nav("/provider/login"); }
    })();

    const offReq = signaling.on("call_request", (m) => {
      setIncoming((cur) => {
        if (cur && cur.from === m.from) return cur;
        if (!onlineRef.current) {
          signaling.send("call_reject", m.from, { reason: "offline" });
          return cur;
        }
        ringtone.start();
        if (document.hidden) {
          notify.show("📞 Incoming call · EMORVIA", `${m.fromName || "Caller"} is calling you`, {
            tag: "incoming-call",
            requireInteraction: true,
            onClick: () => {},
          });
        }
        return { from: m.from, fromName: m.fromName, rate: m.rate };
      });
    });

    // Listen for Service Worker messages so push notifications can:
    //  - start the in-app ringtone even if the foreground tab missed the socket event
    //  - stop ringtone when user dismisses the notification
    //  - focus the call when user taps the notification
    const onSwMessage = (event) => {
      const m = event.data || {};
      if (m.type === "incoming-call-push" && onlineRef.current) {
        ringtone.start();
      } else if (m.type === "notification-dismiss") {
        ringtone.stop();
      } else if (m.type === "notification-click") {
        // App was already open — refocus, the incoming dialog should already show
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    return () => {
      offReq();
      ringtone.stop();
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
    // eslint-disable-next-line
  }, []);

  // When tab becomes visible again, ensure socket is reconnected (WebView throttling)
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && me?.id) signaling.connect(me.id);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [me]);

  // Auto-subscribe for web push so offline calls trigger phone alerts.
  useEffect(() => {
    if (!me) return;
    if (webPush.isSupported() && webPush.permission() === "granted") {
      webPush.subscribe().catch(() => {});
    }
  }, [me]);

  if (!me) return null;

  const toggleOnline = async () => {
    if (!me.online) {
      // Going online — request notification permission, subscribe to push, and
      // warm up the ringtone so it can autoplay later (browser autoplay policy
      // requires a user gesture to first interact with audio).
      ringtone.warmUp();
      const p = await notify.requestPermission();
      setNotifPerm(p);
      // Also subscribe for Web Push so calls can wake the device while offline.
      if (webPush.isSupported() && webPush.permission() === "granted") {
        webPush.subscribe().catch(() => {});
      }
    }
    try {
      const updated = await api.setProviderOnline(!me.online);
      setMe(updated); onlineRef.current = updated.online;
      toast.success(updated.online ? "You're online — you'll get call alerts" : "You're offline");
    } catch (e) { toast.error(e.message); }
  };

  const accept = () => {
    if (!incoming) return;
    ringtone.stop();
    signaling.send("call_accept", incoming.from);
    const userId = incoming.from;
    setIncoming(null);
    nav(`/provider/call/${userId}`);
  };
  const reject = () => {
    if (!incoming) return;
    ringtone.stop();
    signaling.send("call_reject", incoming.from);
    setIncoming(null);
    toast("Call rejected");
  };

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <InstallAppPrompt />
      <GlassHeader title="Provider" right={
        <button data-testid="provider-logout" onClick={() => { clearSession(); nav("/"); }} className="p-2 rounded-lg hover:bg-white/5"><LogOut className="w-4 h-4" /></button>
      } />
      <div className="px-5 pt-6 pb-32 space-y-5">
        {me.status === "pending" && (
          <button
            data-testid="pending-banner"
            onClick={() => nav("/provider/profile/edit")}
            className="w-full text-left p-4 rounded-2xl bg-[#6FA8FF]/10 border border-[#6FA8FF]/30 flex items-start gap-3 fade-up hover:bg-[#6FA8FF]/15"
          >
            <Hourglass className="w-5 h-5 text-[#6FA8FF] shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-semibold text-[#6FA8FF]">Profile under review</p>
              <p className="text-xs text-[#A9B1CC] mt-0.5">Complete your profile · admin will activate it after review. Tap to edit →</p>
            </div>
          </button>
        )}

        <div className="bg-[#171C33] border border-white/5 rounded-2xl p-5 fade-up">
          <div className="flex items-center gap-4">
            {me.avatar
              ? <img src={me.avatar} alt={me.name} className="w-16 h-16 rounded-2xl object-cover" />
              : <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#A9B1CC]"><UserCog className="w-6 h-6" /></div>}
            <div className="flex-1 min-w-0">
              <p className="font-heading text-xl font-semibold truncate">{me.name}</p>
              <p className="text-xs text-[#A9B1CC] flex items-center gap-1.5"><Phone className="w-3 h-3" /> +91 {me.mobile}</p>
            </div>
            <button data-testid="edit-profile" onClick={() => nav("/provider/profile/edit")} className="p-2 rounded-lg hover:bg-white/5 text-[#A9B1CC]" title="Edit profile">
              <UserCog className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`relative overflow-hidden bg-[#171C33] border rounded-2xl p-5 fade-up delay-1 ${me.online ? "border-[#10B981]/30" : "border-white/10"}`}>
          {me.online && <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#10B981]/15 blur-3xl" />}
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#A9B1CC]">Status</p>
              <p className={`font-heading text-2xl font-bold mt-1 ${me.online ? "text-[#10B981]" : "text-[#A9B1CC]"}`}>
                {me.online ? "● Online" : "Offline"}
              </p>
              <p className="text-xs text-[#A9B1CC] mt-1">{me.online ? "Accepting calls" : "Toggle on to receive calls"}</p>
            </div>
            <button data-testid="online-toggle" onClick={toggleOnline} className={`relative w-16 h-9 rounded-full border transition-all ${me.online ? "bg-[#10B981] border-[#10B981]" : "bg-[#252B47] border-white/10"}`}>
              <span className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${me.online ? "left-8" : "left-1"}`} />
            </button>
          </div>
        </div>

        {me.online && notifPerm !== "granted" && notifPerm !== "unsupported" && (
          <button data-testid="enable-notif" onClick={async () => {
            const p = await notify.requestPermission();
            setNotifPerm(p);
            if (p === "granted" && webPush.isSupported()) {
              webPush.subscribe().then(() => toast.success("Notifications enabled")).catch((e) => toast.error(e.message));
            }
          }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 text-left">
            <BellRing className="w-4 h-4 text-[#6FA8FF] shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Enable call notifications</p>
              <p className="text-[11px] text-[#A9B1CC]">Get alerted with sound when a user calls — even when this app is minimized.</p>
            </div>
          </button>
        )}

        {me.online && notifPerm === "granted" && (
          <button
            data-testid="test-notif"
            onClick={async () => {
              try {
                // Ensure subscription is fresh
                if (webPush.isSupported()) {
                  await webPush.subscribe().catch(() => {});
                }
                const r = await api.pushTest();
                if (r.delivered > 0) {
                  toast.success(`Test sent to ${r.delivered} device${r.delivered > 1 ? "s" : ""} — check your notifications`);
                } else {
                  toast.error("No active push subscriptions. Try re-enabling notifications.");
                }
              } catch (e) { toast.error(e.message); }
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#10B981]/8 border border-[#10B981]/20 text-left hover:bg-[#10B981]/15 transition-colors"
          >
            <BellRing className="w-4 h-4 text-[#10B981] shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Test notification</p>
              <p className="text-[11px] text-[#A9B1CC]">Send yourself a test alert to verify call notifications work.</p>
            </div>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3 fade-up delay-2">
          <Tile label="Total earnings" value={inr(me.earnings || 0)} accent />
          <Tile label="Today" value={inr(me.daily || 0)} />
        </div>

        <PrimaryButton data-testid="goto-earnings" onClick={() => nav("/provider/earnings")}>
          <TrendingUp className="w-4 h-4" /> View earnings
        </PrimaryButton>
      </div>

      {incoming && (
        <div className="fixed inset-0 z-[100] backdrop-blur-2xl bg-black/70 flex items-end justify-center">
          <div className="w-full max-w-md bg-[#171C33] rounded-t-3xl border-t border-white/10 p-6 pb-24 fade-up">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981] dot-pulse" />
              <p className="text-xs uppercase tracking-wider text-[#A9B1CC]">Incoming call</p>
            </div>
            <p className="font-heading text-2xl font-bold mt-1">{incoming.fromName || "Caller"}</p>
            <p className="text-sm text-[#A9B1CC]">Wants to talk with you</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button data-testid="reject-call" onClick={reject} className="py-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] font-semibold flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Reject
              </button>
              <button data-testid="accept-call" onClick={accept} className="py-4 rounded-xl bg-[#10B981] text-white font-semibold flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Accept
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav role="provider" />
    </MobileShell>
  );
}

const Tile = ({ label, value, accent }) => (
  <div className="bg-[#171C33] border border-white/5 rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">{label}</p>
    <p className={`font-heading font-bold text-lg mt-1 ${accent ? "text-[#6FA8FF]" : "text-white"}`}>{value}</p>
  </div>
);
