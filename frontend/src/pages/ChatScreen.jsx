import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Send, Phone, MoreVertical, Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { signaling } from "../lib/signaling";
import { inr, formatDuration } from "../lib/format";

const GRACE_SEC = 10;
const computeAmount = (sec, rate) => {
  if (!sec || sec < GRACE_SEC) return 0;
  return Math.ceil(sec / 60) * Math.max(0, Number(rate) || 0);
};

/**
 * User-side ChatScreen — initiates and conducts a paid 1-on-1 chat with a provider.
 * Same billing as a video call: amount = ceil(sec/60) × provider.perMinRate;
 * provider earns amount × effective sharePct%.
 *
 * Flow:
 *   1) Mount → load provider + user → check wallet
 *   2) Send "chat_request" via socket → show "Ringing…" state
 *   3) On "chat_accept" → start timer, allow message exchange
 *   4) On "chat_reject" or timeout (60s) → back to provider profile
 *   5) On "chat_end" or user End → POST /api/call/log with channel="chat"
 */
export default function ChatScreen() {
  const nav = useNavigate();
  const { id: providerId } = useParams();

  const [provider, setProvider] = useState(null);
  const [me, setMe] = useState(null);
  const [perMinRate, setPerMinRate] = useState(0);
  const [phase, setPhase] = useState("ringing"); // ringing | connected | ended
  const [seconds, setSeconds] = useState(0);
  const [maxSec, setMaxSec] = useState(0);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [ended, setEnded] = useState(false);

  const tickRef = useRef(null);
  const ringTimer = useRef(null);
  const typingTimer = useRef(null);
  const scrollRef = useRef(null);
  const secondsRef = useRef(0);
  const maxSecRef = useRef(0);
  const perMinRateRef = useRef(0);
  const endedRef = useRef(false);

  // Mount
  useEffect(() => {
    let mounted = true;
    const s = getSession();
    if (!s || s.role !== "user") { nav("/"); return; }

    const init = async () => {
      try {
        const [p, u, history] = await Promise.all([
          api.getProvider(providerId),
          api.getMe(),
          api.chatMessages(providerId, 50).catch(() => []),
        ]);
        if (!mounted) return;
        const rate = Math.max(0, Number(p?.chatPerMinRate ?? Math.round((p?.perMinRate ?? 0) / 2)) || 0);
        if (rate <= 0) { toast.error("Listener hasn't set a chat rate yet"); nav(-1); return; }
        if (u.wallet < rate) { toast.error(`Need ${inr(rate)} minimum to start. Recharge first.`); nav("/wallet"); return; }
        const ms = Math.floor(u.wallet / rate) * 60;
        setProvider(p); setMe(u); setPerMinRate(rate); setMaxSec(ms);
        perMinRateRef.current = rate; maxSecRef.current = ms;

        // Preload historical messages so the user sees continuity.
        if (Array.isArray(history) && history.length) {
          setMessages(history.map((m) => ({
            from: m.mine ? "me" : "them",
            text: m.text,
            at: new Date(m.at).getTime(),
            historical: true,
          })));
          // Scroll to bottom after loading history
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 100);
        }

        signaling.connect(s.id, "user");
        // Send chat request to provider - use name if available, otherwise generate username from mobile
        const displayName = u.name || `User${u.mobile?.slice(-4) || ""}`;
        signaling.send("chat_request", providerId, { fromName: displayName });

        // 60s ringing timeout
        ringTimer.current = setTimeout(() => {
          if (phaseRef.current === "ringing") {
            toast.error("Listener didn't respond");
            cleanupAndExit();
          }
        }, 60000);
      } catch (e) {
        toast.error("Could not start chat");
        nav("/app");
      }
    };

    init();

    const offAccept = signaling.on("chat_accept", (m) => {
      if (m.from !== providerId) return;
      if (ringTimer.current) clearTimeout(ringTimer.current);
      setPhase("connected");
      phaseRef.current = "connected";
      // Start ticking
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          const nxt = s + 1;
          secondsRef.current = nxt;
          if (maxSecRef.current > 0 && nxt >= maxSecRef.current) {
            setTimeout(() => endChat(true), 0);
          }
          return nxt;
        });
      }, 1000);
    });

    const offReject = signaling.on("chat_reject", (m) => {
      if (m.from && m.from !== providerId) return;
      const reason = m.reason || "rejected";
      toast.error(reason === "busy" ? "Listener is on another session" :
                  reason === "insufficient_balance" ? "Not enough balance" :
                  reason === "offline" ? "Listener went offline" :
                  "Listener declined");
      cleanupAndExit();
    });

    const offMsg = signaling.on("chat_message", (m) => {
      if (m.from !== providerId) return;
      setMessages((arr) => [...arr, { from: "them", text: m.text, at: m.at || Date.now() }]);
    });

    const offTyping = signaling.on("chat_typing", (m) => {
      if (m.from !== providerId) return;
      setPeerTyping(!!m.typing);
    });

    const offEnd = signaling.on("chat_end", (m) => {
      if (m.from && m.from !== providerId) return;
      if (endedRef.current) return;
      endChat(false, m.reason === "disconnect");
    });

    return () => {
      mounted = false;
      offAccept(); offReject(); offMsg(); offTyping(); offEnd();
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line
  }, [providerId]);

  const phaseRef = useRef("ringing");

  const cleanupAndExit = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (ringTimer.current) clearTimeout(ringTimer.current);
    setTimeout(() => nav(-1), 400);
  };

  const endChat = async (auto = false, peerDisconnected = false) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    setPhase("ended");
    if (tickRef.current) clearInterval(tickRef.current);

    // Notify provider
    if (!peerDisconnected) {
      signaling.send("chat_end", providerId, { reason: auto ? "auto" : "user_ended" });
    }

    // Backend will charge via socket chat_end too, but we POST /api/call/log to be sure
    // (the in-flight dedup protects against double-charge with channel "chat").
    const durationSec = secondsRef.current;
    if (durationSec >= GRACE_SEC) {
      try {
        await api.callLog({ providerId, durationSec, autoCutoff: auto, channel: "chat" });
      } catch { /* socket path already charged */ }
    }
    setTimeout(() => nav("/app"), 1200);
  };

  // Auto-scroll to bottom (WhatsApp-style) - scroll after render completes
  useEffect(() => {
    if (scrollRef.current) {
      // Use setTimeout to ensure DOM is fully updated before scrolling
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [messages, peerTyping]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || phase !== "connected") return;
    const at = Date.now();
    setMessages((arr) => [...arr, { from: "me", text, at }]);
    signaling.send("chat_message", providerId, { text });
    setDraft("");
    signaling.send("chat_typing", providerId, { typing: false });
    // Immediately scroll to bottom when user sends message (instant feedback)
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  };

  const onDraftChange = (e) => {
    setDraft(e.target.value);
    if (phase !== "connected") return;
    signaling.send("chat_typing", providerId, { typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      signaling.send("chat_typing", providerId, { typing: false });
    }, 1500);
  };

  if (!provider || !me) return null;
  const currentAmount = computeAmount(seconds, perMinRate);
  const remaining = Math.max(0, maxSec - seconds);

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#101428]">
      <Toaster theme="dark" position="top-center" />
      <div className="max-w-md w-full min-h-screen bg-[#101428] flex flex-col" data-testid="chat-screen">
        {/* Header — provider + live billing meter */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#171C33]/95 border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button data-testid="chat-back" onClick={() => endChat(false)} className="p-1.5 -ml-1 rounded-lg hover:bg-white/5">
                <ChevronLeft className="w-5 h-5 text-[#F2F5FF]" />
              </button>
              <img src={provider.avatar || provider.avatars?.[0]} alt={provider.name}
                   className="w-10 h-10 rounded-full object-cover border border-white/10" />
              <div className="leading-tight">
                <p className="font-heading text-sm font-semibold text-[#F2F5FF]">{provider.name}</p>
                {phase === "connected" ? (
                  <p className="text-[10px] text-[#3DDC97] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3DDC97] dot-pulse" />
                    Connected · {formatDuration(seconds)}
                  </p>
                ) : phase === "ringing" ? (
                  <p className="text-[10px] text-[#6FA8FF]">Ringing…</p>
                ) : (
                  <p className="text-[10px] text-[#A9B1CC]">Ended</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">Charged</p>
              <p className="font-heading text-base font-bold text-[#6FA8FF] tabular-nums" data-testid="chat-amount">{inr(currentAmount)}</p>
              <p className="text-[9px] text-[#6E7694]">{inr(perMinRate)}/min</p>
            </div>
          </div>
          {phase === "connected" && (
            <div className="px-4 pb-2 flex items-center justify-between text-[10px] text-[#A9B1CC]">
              <span>Auto-ends at {formatDuration(maxSec)}</span>
              <span>· {formatDuration(remaining)} left</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-2 no-scrollbar" data-testid="chat-messages">
          {phase === "ringing" && (
            <div className="flex flex-col items-center justify-center py-16 fade-up">
              <div className="w-20 h-20 rounded-full bg-[#6FA8FF]/10 border border-[#6FA8FF]/30 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-[#6FA8FF] animate-spin" />
              </div>
              <p className="font-heading text-lg font-semibold text-[#F2F5FF]">Waiting for {provider.name}…</p>
              <p className="text-sm text-[#A9B1CC] mt-1">Billing starts when they accept</p>
            </div>
          )}

          {phase !== "ringing" && messages.length === 0 && (
            <p className="text-center text-xs text-[#6E7694] py-8">Say hi 👋</p>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} mine={m.from === "me"} text={m.text} at={m.at} />
          ))}

          {peerTyping && (
            <div className="flex items-center gap-1.5 px-3 py-2 max-w-fit rounded-2xl bg-[#171C33] text-[#A9B1CC] text-xs">
              <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" /> typing
            </div>
          )}

          {phase === "ended" && (
            <div className="text-center py-10 fade-up">
              <p className="font-heading text-lg font-semibold text-[#F2F5FF]">Chat ended</p>
              <p className="text-sm text-[#A9B1CC] mt-1">Total: {inr(currentAmount)} · {formatDuration(seconds)}</p>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 bg-[#101428] border-t border-white/10 p-3 pb-5">
          <div className="flex items-center gap-2">
            <button
              data-testid="chat-end"
              onClick={() => endChat(false)}
              disabled={phase === "ended"}
              className="w-12 h-12 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/40 hover:bg-[#EF4444]/25 flex items-center justify-center transition-all shrink-0"
              title="End chat"
            >
              <Phone className="w-4 h-4 text-[#EF4444] rotate-[135deg]" />
            </button>
            <input
              data-testid="chat-input"
              type="text"
              value={draft}
              onChange={onDraftChange}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder={phase === "connected" ? "Type a message…" : phase === "ringing" ? "Waiting to connect…" : "Chat ended"}
              disabled={phase !== "connected"}
              className="flex-1 bg-[#171C33] border border-white/10 rounded-2xl px-4 py-3 text-sm text-[#F2F5FF] placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] disabled:opacity-50"
            />
            <button
              data-testid="chat-send"
              onClick={sendMessage}
              disabled={!draft.trim() || phase !== "connected"}
              className="w-12 h-12 rounded-full bg-[#6FA8FF] hover:bg-[#5B92F5] disabled:opacity-40 flex items-center justify-center transition-all active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4 text-[#101428]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Bubble = ({ mine, text, at }) => (
  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${mine ? "bg-[#6FA8FF] text-[#101428] rounded-br-sm" : "bg-[#171C33] text-[#F2F5FF] rounded-bl-sm border border-white/5"}`}>
      <p className="text-sm whitespace-pre-wrap break-words leading-snug">{text}</p>
      <p className={`text-[9px] mt-1 ${mine ? "text-[#101428]/60" : "text-[#6E7694]"}`}>
        {new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  </div>
);

const Dot = ({ delay = "0s" }) => (
  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: delay }} />
);
