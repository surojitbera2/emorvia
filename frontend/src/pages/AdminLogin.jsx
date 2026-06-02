import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, User as UserIcon, Eye, EyeOff, Video, ArrowLeft, BarChart3, Users, CreditCard } from "lucide-react";
import { api } from "../lib/store";
import { getSession, setSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

export default function AdminLogin() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // Skip login form if admin session is already saved.
  useEffect(() => {
    const s = getSession();
    if (s?.role === "admin") nav("/admin", { replace: true });
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await api.adminLogin(u, p);
      setSession({ role: "admin", token });
      toast.success("Welcome, admin");
      setTimeout(() => nav("/admin"), 250);
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-full bg-[#101428] text-white relative overflow-hidden">
      <Toaster theme="dark" position="top-center" />

      {/* Animated background grid + amber glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#6FA8FF]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full bg-[#10B981]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* LEFT — Brand / showcase (hidden on mobile) */}
        <div className="hidden lg:flex flex-col justify-between p-12 border-r border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#6FA8FF] flex items-center justify-center shadow-[0_8px_30px_rgba(245,158,11,0.35)]">
              <Video className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="font-heading text-xl font-bold leading-none">EMORVIA</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6FA8FF] mt-1">Admin Console</p>
            </div>
          </div>

          <div className="space-y-8 max-w-md">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#6FA8FF] font-semibold">Manage with control</p>
              <h2 className="font-heading text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05] mt-3">
                Everything your <span className="text-[#6FA8FF]">platform</span><br/>needs — in one place.
              </h2>
              <p className="text-sm text-[#A9B1CC] leading-relaxed mt-5">
                Configure rates, approve payments, manage providers and watch the platform breathe — all from a single console.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ShowcaseTile icon={BarChart3} label="Live KPIs" />
              <ShowcaseTile icon={Users} label="User control" />
              <ShowcaseTile icon={CreditCard} label="Payments" />
            </div>
          </div>

          <p className="text-[11px] text-[#6E7694]">© {new Date().getFullYear()} EMORVIA. Restricted access.</p>
        </div>

        {/* RIGHT — Login form */}
        <div className="flex items-center justify-center px-5 py-10 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="lg:hidden flex flex-col items-center mb-8 fade-up">
              <div className="w-14 h-14 rounded-2xl bg-[#6FA8FF] flex items-center justify-center shadow-[0_10px_40px_rgba(245,158,11,0.35)]">
                <ShieldCheck className="w-7 h-7 text-black" />
              </div>
              <p className="font-heading text-2xl font-bold mt-4 tracking-tight">Admin Console</p>
              <p className="text-xs text-[#A9B1CC] mt-1">EMORVIA management portal</p>
            </div>

            <div className="hidden lg:block mb-8 fade-up">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6FA8FF] font-semibold">Sign in</p>
              <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Welcome back, admin.</h1>
              <p className="text-sm text-[#A9B1CC] mt-2">Use your console credentials to continue.</p>
            </div>

            <form onSubmit={submit} className="relative p-6 lg:p-8 rounded-3xl bg-[#0F141C]/80 backdrop-blur-xl border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] space-y-5 fade-up">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694]" />
                  <input
                    data-testid="admin-username"
                    autoComplete="username"
                    value={u}
                    onChange={(e) => setU(e.target.value)}
                    placeholder="admindash"
                    className="w-full bg-[#101428] border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] focus:ring-2 focus:ring-[#6FA8FF]/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694]" />
                  <input
                    data-testid="admin-password"
                    autoComplete="current-password"
                    type={showPw ? "text" : "password"}
                    value={p}
                    onChange={(e) => setP(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#101428] border border-white/10 rounded-xl pl-10 pr-11 py-3.5 text-sm text-white placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] focus:ring-2 focus:ring-[#6FA8FF]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6E7694] hover:text-white"
                    data-testid="admin-toggle-pw"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                data-testid="admin-login-submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl bg-[#6FA8FF] hover:bg-[#5B92F5] active:scale-[0.98] transition-all text-black font-bold text-sm tracking-wide shadow-[0_10px_30px_-5px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Signing in…" : "Sign in to Console"}
              </button>

              <div className="flex items-center gap-2 pt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                <p className="text-[11px] text-[#A9B1CC]">
                  Restricted area — all sessions are logged.
                </p>
              </div>
            </form>

            <button
              onClick={() => nav("/")}
              data-testid="admin-back-home"
              className="mt-6 w-full inline-flex items-center justify-center gap-1.5 text-xs text-[#A9B1CC] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back to app
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ShowcaseTile = ({ icon: Icon, label }) => (
  <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 hover:border-[#6FA8FF]/30 transition-colors">
    <Icon className="w-4 h-4 text-[#6FA8FF]" />
    <p className="text-xs text-[#A9B1CC] mt-2 font-medium">{label}</p>
  </div>
);
