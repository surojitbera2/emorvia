import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, ShieldCheck, Globe2, Sparkles, Phone, Headphones, Heart } from "lucide-react";
import { MobileShell } from "../components/MobileShell";
import { getSession } from "../lib/auth";

export default function Welcome() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (s?.token && s?.role === "user") { nav("/app", { replace: true }); return; }
    if (s?.token && s?.role === "provider") { nav("/provider", { replace: true }); return; }
    setChecking(false);
  }, [nav]);

  if (checking) {
    return (
      <MobileShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#6FA8FF] spin" />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="relative min-h-screen overflow-hidden" data-testid="welcome-page">
        {/* Layered ambient backdrop — subtle blue/teal aurora */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-40 -left-20 w-[460px] h-[460px] rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(closest-side, #6FA8FF, transparent 70%)" }}
          />
          <div
            className="absolute top-1/3 -right-32 w-[380px] h-[380px] rounded-full blur-3xl opacity-30"
            style={{ background: "radial-gradient(closest-side, #3DDC97, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full blur-3xl opacity-25"
            style={{ background: "radial-gradient(closest-side, #7DB6FF, transparent 70%)" }}
          />
          <div className="absolute inset-0 dot-grid opacity-50" />
        </div>
        <div className="grain" />

        {/* Top brand bar */}
        <div className="relative z-10 px-6 pt-7 flex items-center justify-between">
          <div className="flex items-center gap-2.5" data-testid="brand-logo">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6FA8FF] to-[#3A6BD6] flex items-center justify-center glow-ring">
              <Heart className="w-5 h-5 text-[#101428]" strokeWidth={2.5} fill="#101428" />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-[15px] font-extrabold tracking-[0.18em] text-[#F2F5FF]">EMORVIA</p>
              <p className="text-[9px] uppercase tracking-[0.28em] text-[#6E7694]">Talk it out</p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#A9B1CC] font-medium">
            Private • Verified
          </span>
        </div>

        {/* Hero block */}
        <div className="relative z-10 px-6 pt-12 pb-6 fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl">
            <Sparkles className="w-3.5 h-3.5 text-[#3DDC97]" />
            <span className="text-[11px] tracking-wide text-[#F2F5FF]/85 font-medium">
              ₹50 free credit on signup
            </span>
          </div>

          <h1 className="mt-5 font-heading text-[44px] leading-[1.02] font-extrabold tracking-tight text-[#F2F5FF]">
            Real talk,
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#DCE9FF] via-[#A7CDFF] to-[#6FA8FF]">
              real listeners.
            </span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#A9B1CC] max-w-[320px]">
            Connect 1-on-1 with verified listeners — anytime, anywhere. Crystal-clear calls, private and on your terms.
          </p>
        </div>

        {/* Feature strip */}
        <div className="relative z-10 px-6 mt-6 grid grid-cols-3 gap-2.5 fade-up delay-1">
          <FeaturePill icon={ShieldCheck} label="Verified" />
          <FeaturePill icon={Headphones} label="HD audio" />
          <FeaturePill icon={Globe2} label="Multilingual" />
        </div>

        {/* CTA stack */}
        <div className="relative z-10 px-6 mt-10 space-y-3 fade-up delay-2">
          <Link
            to="/register"
            data-testid="welcome-register"
            className="group relative block w-full overflow-hidden rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#6FA8FF] via-[#5B92F5] to-[#3A6BD6]" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-[#7DB6FF] to-[#5B92F5]" />
            <div className="relative flex items-center justify-between px-5 py-4">
              <span className="font-heading font-semibold text-[#101428] text-[15px] tracking-tight">
                Continue with mobile number
              </span>
              <span className="flex items-center gap-2 text-[#101428]/85">
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </Link>
          <p className="text-center text-[11px] text-[#6E7694] pt-1">
            One-tap sign in or sign up — we'll text you an OTP.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 px-6 mt-6 pb-10 fade-up delay-3">
          <div className="flex items-center justify-center gap-2 text-[11px] text-[#6E7694]">
            <span>By continuing you agree to our</span>
            <a
              href="https://emorvia.in/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#A9B1CC] hover:text-[#6FA8FF] underline-offset-2 hover:underline"
              data-testid="welcome-privacy-link"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

const FeaturePill = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
    <Icon className="w-4 h-4 text-[#3DDC97]" />
    <span className="text-[11px] text-[#F2F5FF]/80 tracking-wide font-medium">{label}</span>
  </div>
);
