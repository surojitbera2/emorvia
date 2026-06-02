import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Wallet as WalletIcon, ArrowRight } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr } from "../lib/format";

export default function UserDashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [providers, setProviders] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/login"); return; }
    (async () => {
      try {
        const [me, list] = await Promise.all([
          api.getMe(),
          api.getProviders(),
        ]);
        setUser(me); setProviders(list);
      } catch { nav("/login"); }
    })();
    // eslint-disable-next-line
  }, []);

  if (!user) return null;
  const filtered = providers.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.bio || "").toLowerCase().includes(q.toLowerCase()));
  const online = filtered.filter((p) => p.online);
  const offline = filtered.filter((p) => !p.online);

  return (
    <MobileShell>
      <GlassHeader
        title="EMORVIA"
        right={
          <button data-testid="header-wallet" onClick={() => nav("/wallet")} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 text-[#6FA8FF]">
            <WalletIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{inr(user.wallet)}</span>
          </button>
        }
      />
      <div className="px-5 pt-5 pb-32">
        <div className="fade-up">
          <p className="text-xs tracking-[0.15em] uppercase text-[#A9B1CC] mb-1">Hi {user.name.split(" ")[0]}</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Who do you want to talk to?</h1>
        </div>



       <div className="mt-5 fade-up delay-1">
  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
    <span className="text-[#A9B1CC] font-medium">
      For Support:
    </span>

    <a
      href="tel:+917980052977"
      className="px-3 py-1 rounded-full bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 text-[#6FA8FF] font-semibold hover:bg-[#6FA8FF]/20 transition-all"
    >
      +91 7980052977
    </a>

    <a
      href="tel:+919674442673"
      className="px-3 py-1 rounded-full bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 text-[#6FA8FF] font-semibold hover:bg-[#6FA8FF]/20 transition-all"
    >
      +91 9674442673
    </a>
  </div>

  <div className="relative">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694]" />

    <input
      data-testid="search-providers"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search by name or speciality"
      className="w-full bg-[#101428] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF]/50 transition-all"
    />
  </div>
</div>

        {online.length > 0 && (
          <div className="mt-6 fade-up delay-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC]">Online now · {online.length}</h3>
              <span className="text-xs text-[#10B981]">● Live</span>
            </div>
            <div className="space-y-3">
              {online.map((p) => <ProviderCard key={p.id} p={p} onClick={() => nav(`/provider/${p.id}`)} />)}
            </div>
          </div>
        )}

        {offline.length > 0 && (
          <div className="mt-7 fade-up delay-3">
            <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-3">Currently offline</h3>
            <div className="space-y-3 opacity-70">
              {offline.map((p) => <ProviderCard key={p.id} p={p} onClick={() => nav(`/provider/${p.id}`)} />)}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="mt-10 text-sm text-[#A9B1CC] text-center">No providers match your search.</div>
        )}
      </div>
      <BottomNav role="user" />
    </MobileShell>
  );
}

const ProviderCard = ({ p, onClick }) => (
  <button
    onClick={onClick}
    data-testid={`provider-card-${p.id}`}
    className="w-full text-left flex gap-4 p-3.5 bg-[#171C33] rounded-2xl border border-white/5 items-center hover:bg-[#1A1F2B] hover:border-white/10 transition-all active:scale-[0.99]"
  >
    <div className="relative shrink-0">
      <img src={p.avatar} alt={p.name} className="w-14 h-14 rounded-xl object-cover" />
      {p.busy
        ? <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#EF4444] border-2 border-[#171C33]" />
        : p.online && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-[#171C33] dot-pulse" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h4 className="font-heading font-semibold text-white truncate">{p.name}</h4>
      </div>
      <p className="text-xs text-[#A9B1CC] truncate mt-0.5">{p.bio}</p>
      {p.languages?.length > 0 && (
        <p className="text-[10px] text-[#6E7694] mt-0.5 truncate">
          🗣 {p.languages.slice(0, 3).join(" · ")}{p.languages.length > 3 ? ` +${p.languages.length - 3}` : ""}
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        {p.busy ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 font-semibold">● BUSY</span>
        ) : (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.online ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" : "bg-white/5 text-[#A9B1CC] border border-white/10"}`}>
            {p.online ? "ONLINE" : "OFFLINE"}
          </span>
        )}
        {p.perMinRate > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#6FA8FF]/10 text-[#6FA8FF] border border-[#6FA8FF]/20 font-semibold tabular-nums">
            ₹{p.perMinRate}/min
          </span>
        )}
      </div>
    </div>
    <ArrowRight className="w-4 h-4 text-[#6E7694]" />
  </button>
);
