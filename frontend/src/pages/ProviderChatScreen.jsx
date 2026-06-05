import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Send, Phone, Loader2 } from "lucide-react";
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
 * Provider-side ChatScreen — entered after accepting an incoming chat_request.
 * Shows live earnings meter (amount × effectiveSharePct%).
 */
export default function ProviderChatScreen() {
  const nav = useNavigate();
  const { userId } = useParams();
  const location = useLocation();
  const userName = location.state?.userName || "User";

  const [me, setMe] = useState(null);
  const [perMinRate, setPerMinRate] = useState(0);
  const [sharePct, setSharePct] = useState(60);
  const [phase, setPhase] = useState("connected"); // we arrive already accepted
  const [seconds, setSeconds] = useState(0);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  const tickRef = useRef(null);
  const typingTimer = useRef(null);
  const scrollRef = useRef(null);
  const endedRef = useRef(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "provider") { nav("/"); return; }

    (async () => {
      try {
        const [p, b, history] = await Promise.all([
          api.getProviderMe(),
          api.getPublicBilling().catch(() => ({ providerSharePct: 60 })),
          api.chatMessages(userId, 50).catch(() => []),
        ]);
        setMe(p);
        setPerMinRate(Math.max(0, Number(p.chatPerMinRate ?? Math.round((p.perMinRate ?? 0) / 2)) || 0));
        const globalPct = Number(b?.providerSharePct ?? 60);
        const override = p?.sharePctOverride;
        setSharePct(override != null && !isNaN(Number(override)) ? Number(override) : globalPct);
        if (Array.isArray(history) && history.length) {
          setMessages(history.map((m) => ({
            from: m.mine ? "me" : "them",
            text: m.text,
            at: new Date(m.at).getTime(),
            historical: true,
          })));
        }
        signaling.connect(p.id, "provider");
      } catch (e) { nav("/provider"); return; }
    })();

    // Start timer (already accepted before entering this screen)
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    const offMsg = signaling.on("chat_message", (m) => {
      if (m.from !== userId) return;
      setMessages((arr) => [...arr, { from: "them", text: m.text, at: m.at || Date.now() }]);
    });

    const offTyping = signaling.on("chat_typing", (m) => {
      if (m.from !== userId) return;
      setPeerTyping(!!m.typing);
    });

    const offEnd = signaling.on("chat_end", (m) => {
      if (m.from && m.from !== userId) return;
      if (endedRef.current) return;
      endChat(false, m.reason === "disconnect");
    });

    return () => {
      offMsg(); offTyping(); offEnd();
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line
  }, [userId]);

  const endChat = (sendEnd = true, peerDisconnected = false) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setPhase("ended");
    if (tickRef.current) clearInterval(tickRef.current);
    if (sendEnd && !peerDisconnected) {
      signaling.send("chat_end", userId, { reason: "provider_ended" });
    }
    setTimeout(() => nav("/provider"), 1200);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, peerTyping]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || phase !== "connected") return;
    const at = Date.now();
    setMessages((arr) => [...arr, { from: "me", text, at }]);
    signaling.send("chat_message", userId, { text });
    setDraft("");
    signaling.send("chat_typing", userId, { typing: false });
  };

  const onDraftChange = (e) => {
    setDraft(e.target.value);
    if (phase !== "connected") return;
    signaling.send("chat_typing", userId, { typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      signaling.send("chat_typing", userId, { typing: false });
    }, 1500);
  };

  if (!me) return null;
  const grossAmount = computeAmount(seconds, perMinRate);
  const myEarning = Math.round((grossAmount * sharePct) / 100 * 100) / 100;

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#101428]">
      <Toaster theme="dark" position="top-center" />
      <div className="max-w-md w-full min-h-screen flex flex-col" data-testid="provider-chat-screen">
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#171C33]/95 border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => endChat(true)} className="p-1.5 -ml-1 rounded-lg hover:bg-white/5">
                <ChevronLeft className="w-5 h-5 text-[#F2F5FF]" />
              </button>
              <div className="w-10 h-10 rounded-full bg-[#6FA8FF]/15 border border-[#6FA8FF]/30 flex items-center justify-center text-[#6FA8FF] font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="font-heading text-sm font-semibold text-[#F2F5FF]">{userName}</p>
                {phase === "connected" ? (
                  <p className="text-[10px] text-[#3DDC97] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3DDC97] dot-pulse" />
                    Connected · {formatDuration(seconds)}
                  </p>
                ) : (
                  <p className="text-[10px] text-[#A9B1CC]">Ended</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">Your earnings</p>
              <p className="font-heading text-base font-bold text-[#3DDC97] tabular-nums" data-testid="provider-chat-earnings">{inr(myEarning)}</p>
              <p className="text-[9px] text-[#6E7694]">{sharePct}% of {inr(perMinRate)}/min</p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-2 no-scrollbar">
          {messages.length === 0 && phase === "connected" && (
            <p className="text-center text-xs text-[#6E7694] py-8">Send the first message 👋</p>
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
              <p className="text-sm text-[#A9B1CC] mt-1">Earned: {inr(myEarning)} · {formatDuration(seconds)}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#101428] border-t border-white/10 p-3 pb-5">
          <div className="flex items-center gap-2">
            <input
              data-testid="provider-chat-input"
              type="text"
              value={draft}
              onChange={onDraftChange}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder={phase === "connected" ? "Type a message…" : "Chat ended"}
              disabled={phase !== "connected"}
              className="flex-1 bg-[#171C33] border border-white/10 rounded-2xl px-4 py-3 text-sm text-[#F2F5FF] placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] disabled:opacity-50"
            />
            <button
              data-testid="provider-chat-send"
              onClick={sendMessage}
              disabled={!draft.trim() || phase !== "connected"}
              className="w-12 h-12 rounded-full bg-[#6FA8FF] hover:bg-[#5B92F5] disabled:opacity-40 flex items-center justify-center transition-all active:scale-95"
            >
              <Send className="w-4 h-4 text-[#101428]" />
            </button>
            <button
              data-testid="provider-chat-end"
              onClick={() => endChat(true)}
              disabled={phase === "ended"}
              className="w-12 h-12 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/40 hover:bg-[#EF4444]/25 flex items-center justify-center transition-all"
              title="End chat"
            >
              <Phone className="w-4 h-4 text-[#EF4444] rotate-[135deg]" />
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
