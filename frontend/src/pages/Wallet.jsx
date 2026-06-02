import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowDownLeft, ArrowUpRight, ChevronLeft } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav, PrimaryButton } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr, timeAgo } from "../lib/format";

export default function Wallet() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/login"); return; }
    (async () => {
      try {
        const [me, list] = await Promise.all([api.getMe(), api.getMyTxns()]);
        setUser(me); setTxns(list);
      } catch { nav("/login"); }
    })();
  }, [nav]);

  if (!user) return null;
  return (
    <MobileShell>
      <GlassHeader title="Wallet" left={
        <button data-testid="wallet-back" onClick={() => nav(-1)} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" /></button>
      } />
      <div className="px-5 pt-5 pb-32">
        <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-[#1E2433] via-[#171C33] to-[#101428] border border-white/10 fade-up">
          <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-[#6FA8FF]/15 blur-3xl" />
          <p className="text-xs uppercase tracking-[0.2em] text-[#A9B1CC]">Available balance</p>
          <p className="font-heading text-5xl font-bold text-[#6FA8FF] mt-2 tracking-tight tabular-nums" data-testid="wallet-balance">{inr(user.wallet)}</p>
          {user.bonusBalance > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/20" data-testid="wallet-bonus">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <p className="text-[11px] text-[#10B981] font-semibold">Includes {inr(user.bonusBalance)} free trial credit</p>
            </div>
          )}
          <p className="text-xs text-[#A9B1CC] mt-2">Auto-deducts during calls.</p>
          <div className="mt-5">
            <PrimaryButton data-testid="wallet-recharge" onClick={() => nav("/recharge")}>
              <Plus className="w-4 h-4" /> Recharge wallet
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-7 fade-up delay-1">
          <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-3">Transaction history</h3>
          {txns.length === 0 ? (
            <div className="text-sm text-[#A9B1CC] p-6 text-center bg-white/[0.02] border border-white/5 rounded-xl">No transactions yet.</div>
          ) : (
            <div className="space-y-2.5">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3.5 bg-[#171C33] border border-white/5 rounded-xl">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.type === "credit" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                    {t.type === "credit" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.note}</p>
                    <p className="text-[11px] text-[#A9B1CC]">{timeAgo(new Date(t.at).getTime())}</p>
                  </div>
                  <p className={`font-heading font-semibold ${t.type === "credit" ? "text-[#10B981]" : "text-white"}`}>
                    {t.type === "credit" ? "+" : "−"}{inr(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav role="user" />
    </MobileShell>
  );
}
