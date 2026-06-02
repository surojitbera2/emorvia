import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShieldOff, Ban } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr, formatDuration, timeAgo } from "../lib/format";
import { toast } from "sonner";

export default function ProviderEarnings() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [logs, setLogs] = useState([]);
  const [sharePct, setSharePct] = useState(60);
  const [blockedIds, setBlockedIds] = useState(new Set());

  const refreshBlocks = async () => {
    try {
      const list = await api.providerGetBlocks();
      setBlockedIds(new Set(list.map((b) => b.id)));
    } catch { /* silent */ }
  };

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "provider") { nav("/provider/login"); return; }
    (async () => {
      try {
        const [p, l, b] = await Promise.all([
          api.getProviderMe(),
          api.getProviderMyCalls(),
          api.getPublicBilling().catch(() => ({ providerSharePct: 60 })),
        ]);
        setMe(p); setLogs(l);
        const globalPct = Number(b?.providerSharePct ?? 60);
        const override = p?.sharePctOverride;
        setSharePct(override != null && !isNaN(Number(override)) ? Number(override) : globalPct);
        await refreshBlocks();
      } catch { nav("/provider/login"); }
    })();
  }, [nav]);

  const blockUser = async (userId, name) => {
    if (!userId) return;
    if (!window.confirm(`Block ${name || "this user"}? They won't be able to call you again.`)) return;
    try {
      await api.providerBlockUser(userId);
      toast.success(`Blocked ${name || ""}`);
      await refreshBlocks();
    } catch (e) { toast.error(e.message); }
  };

  if (!me) return null;
  return (
    <MobileShell>
      <GlassHeader title="Earnings" left={
        <button data-testid="earnings-back" onClick={() => nav(-1)} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" /></button>
      } />
      <div className="px-5 pt-5 pb-32 space-y-5">
        <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-[#1E2433] via-[#171C33] to-[#101428] border border-white/10 fade-up">
          <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-[#6FA8FF]/15 blur-3xl" />
          <p className="text-xs uppercase tracking-[0.2em] text-[#A9B1CC]">Total earnings</p>
          <p className="font-heading text-5xl font-bold text-[#6FA8FF] mt-2 tracking-tight tabular-nums">{inr(me.earnings || 0)}</p>
          <p className="text-xs text-[#A9B1CC] mt-1">From {logs.length} call{logs.length === 1 ? "" : "s"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 fade-up delay-1">
          <div className="bg-[#171C33] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">Today</p>
            <p className="font-heading font-bold text-lg text-white mt-1">{inr(me.daily || 0)}</p>
          </div>
          <div className="bg-[#171C33] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">Your share</p>
            <p className="font-heading font-bold text-lg text-[#6FA8FF] mt-1">{sharePct}%</p>
            <p className="text-[10px] text-[#6E7694] mt-0.5">You keep {sharePct}% of every billed call</p>
          </div>
        </div>

        <div className="fade-up delay-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC]">Recent calls</h3>
            <button
              data-testid="goto-blocked"
              onClick={() => nav("/provider/blocked")}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#6FA8FF] hover:underline"
            >
              <ShieldOff className="w-3 h-3" /> Blocked users ({blockedIds.size})
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="text-sm text-[#A9B1CC] p-6 text-center bg-white/[0.02] border border-white/5 rounded-xl">No calls yet.</div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((l) => {
                const net = (l.providerEarnings != null)
                  ? l.providerEarnings
                  : Math.round((l.amount * sharePct) / 100 * 100) / 100;
                const isBlocked = blockedIds.has(l.userId);
                return (
                  <div key={l.id} className="flex items-center justify-between p-3.5 bg-[#171C33] border border-white/5 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{l.userName || "User"} · {formatDuration(l.durationSec)}</p>
                      <p className="text-[11px] text-[#A9B1CC]">{timeAgo(new Date(l.at).getTime())} {l.autoCutoff ? "· auto-end" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-heading font-semibold text-[#10B981]">+{inr(net)}</p>
                      {isBlocked ? (
                        <span className="text-[10px] px-2 py-1 rounded-md bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20">Blocked</span>
                      ) : (
                        <button
                          data-testid={`block-${l.userId}`}
                          onClick={() => blockUser(l.userId, l.userName)}
                          title="Block this user"
                          className="p-1.5 rounded-md hover:bg-[#EF4444]/10 text-[#A9B1CC] hover:text-[#EF4444]"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav role="provider" />
    </MobileShell>
  );
}
