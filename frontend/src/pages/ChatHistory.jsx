import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MessageCircle, Loader2 } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { toast, Toaster } from "sonner";

/**
 * Chat history — works for both Users and Providers.
 * Lists the most recent threads (per peer) with last message preview.
 * Tap a row → opens full message history with that peer in a modal.
 */
export default function ChatHistory() {
  const nav = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("user");
  const [open, setOpen] = useState(null); // selected thread

  useEffect(() => {
    const s = getSession();
    if (!s) { nav("/"); return; }
    setRole(s.role);
    (async () => {
      try {
        const t = await api.chatThreads();
        setThreads(t || []);
      } catch (e) {
        if (e?.isAuthError) nav("/");
        else toast.error(e?.message || "Could not load chats");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  const isProvider = role === "provider";

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader
        title="Your chats"
        left={
          <button data-testid="chats-back" onClick={() => nav(isProvider ? "/provider" : "/app")} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-5 pt-4 pb-28">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-6 h-6 text-[#6FA8FF] animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-7 h-7 text-[#6E7694]" />
            </div>
            <p className="font-heading text-base font-semibold text-[#F2F5FF]">No chats yet</p>
            <p className="text-sm text-[#A9B1CC] mt-1">
              {isProvider ? "Conversations from users will appear here." : "Tap 'Start Chat' on any listener's profile."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="chat-thread-list">
            {threads.map((t) => (
              <li key={t.threadKey}>
                <button
                  data-testid={`chat-thread-${t.peerId}`}
                  onClick={() => setOpen(t)}
                  className="w-full flex items-start gap-3 p-3.5 rounded-xl bg-[#171C33] border border-white/5 hover:border-[#6FA8FF]/30 hover:bg-[#1B2140] transition-all text-left"
                >
                  {/* Avatar / initials */}
                  {isProvider ? (
                    <div className="w-11 h-11 rounded-full bg-[#6FA8FF]/15 border border-[#6FA8FF]/30 flex items-center justify-center text-[#6FA8FF] font-bold text-sm shrink-0">
                      {(t.peer?.name || "U").charAt(0).toUpperCase()}
                    </div>
                  ) : t.peer?.avatar ? (
                    <img src={t.peer.avatar} alt={t.peer.name}
                         className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#3DDC97]/15 border border-[#3DDC97]/30 flex items-center justify-center text-[#3DDC97] font-bold shrink-0">
                      {(t.peer?.name || "L").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-heading text-sm font-semibold text-[#F2F5FF] truncate">
                        {t.peer?.name || (isProvider ? `User ${(t.peer?.mobile || "").slice(-4)}` : "Listener")}
                      </p>
                      <span className="text-[10px] text-[#6E7694] shrink-0">{timeAgo(new Date(t.lastAt))}</span>
                    </div>
                    <p className="text-xs text-[#A9B1CC] truncate mt-0.5">
                      {t.lastSender === (isProvider ? "provider" : "user") ? "You: " : ""}
                      {t.lastMessage}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav role={isProvider ? "provider" : "user"} />

      {open && (
        <ThreadModal thread={open} isProvider={isProvider} onClose={() => setOpen(null)} onStartChat={() => {
          if (!isProvider) nav(`/chat/${open.peerId}`);
          else setOpen(null);
        }} />
      )}
    </MobileShell>
  );
}

const ThreadModal = ({ thread, isProvider, onClose, onStartChat }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.chatMessages(thread.peerId, 100);
        setMessages(m || []);
      } catch (e) {
        toast.error(e?.message || "Failed to load messages");
      } finally { setLoading(false); }
    })();
  }, [thread.peerId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-[#101428] border-t border-white/10 sm:rounded-2xl sm:border max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#171C33] border-b border-white/10 px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 -ml-1 rounded-lg hover:bg-white/5">
              <ChevronLeft className="w-5 h-5 text-[#F2F5FF]" />
            </button>
            <div>
              <p className="font-heading text-sm font-semibold text-[#F2F5FF]">{thread.peer?.name || "Chat history"}</p>
              <p className="text-[10px] text-[#A9B1CC]">{messages.length} messages</p>
            </div>
          </div>
          {!isProvider && (
            <button
              data-testid="chats-resume"
              onClick={onStartChat}
              className="px-3 py-1.5 rounded-full bg-[#3DDC97]/10 border border-[#3DDC97]/40 text-[#3DDC97] text-xs font-semibold hover:bg-[#3DDC97]/20"
            >
              Resume chat
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-[#6FA8FF] animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-[#6E7694] py-10">No messages.</p>
          ) : (
            messages.map((m) => (
              <Bubble key={m.id} mine={m.mine} text={m.text} at={m.at} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Bubble = ({ mine, text, at }) => (
  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${mine ? "bg-[#6FA8FF] text-[#101428] rounded-br-sm" : "bg-[#171C33] text-[#F2F5FF] rounded-bl-sm border border-white/5"}`}>
      <p className="text-sm whitespace-pre-wrap break-words leading-snug">{text}</p>
      <p className={`text-[9px] mt-1 ${mine ? "text-[#101428]/60" : "text-[#6E7694]"}`}>
        {new Date(at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
      </p>
    </div>
  </div>
);
