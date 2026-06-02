import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, KeyRound, Loader2, ShieldCheck, Headphones } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, Input, Label } from "../components/MobileShell";
import { PrivacyFooter } from "../components/PermissionNotice";
import { api } from "../lib/store";
import { getSession, setSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

/**
 * Provider OTP auth (works for both register and login).
 *  - mode="register"  → CTA label "Create Listener Account"
 *  - mode="login"     → CTA label "Sign in"
 * Backend behaviour is identical: /api/auth/otp/verify with role="provider" returns
 * an existing provider OR creates a pending provider record.
 */
export default function ProviderAuth({ mode = "login" }) {
  const nav = useNavigate();
  const isRegister = mode === "register";
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [agreed, setAgreed] = useState(true);
  const codeRef = useRef(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return;
    if (s.role === "provider") nav("/provider", { replace: true });
    else if (s.role === "user") nav("/app", { replace: true });
    else if (s.role === "admin") nav("/admin", { replace: true });
  }, [nav]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    if (mobile.length !== 10) return toast.error("Enter a valid 10-digit mobile");
    if (!agreed) return toast.error("Please accept the Privacy Policy to continue");
    setBusy(true);
    try {
      await api.otpSend({ mobile, role: "provider" });
      toast.success(`OTP sent to +91 ${mobile}`);
      setStep(2);
      setResendIn(60);
      setTimeout(() => codeRef.current?.focus(), 100);
    } catch (e) {
      // Surface the friendly 60s cooldown message if backend returns 429
      toast.error(e?.message || "Could not send OTP");
      if (e?.status === 429 && e?.message?.match(/(\d+)s/)) {
        const m = e.message.match(/(\d+)s/);
        if (m) setResendIn(Number(m[1]));
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length < 4) return toast.error("Enter the OTP");
    setBusy(true);
    try {
      const r = await api.otpVerify({ mobile, code, role: "provider" });
      if (!r?.token) throw new Error("Verification failed — request a new OTP");
      if (r.provider?.id) {
        setSession({ role: "provider", id: r.provider.id, token: r.token });
        toast.success(r.isNew ? "Listener account created" : "Welcome back");
        setTimeout(() => nav("/provider", { replace: true }), 400);
        return;
      }
      // Edge case: backend returned user (mobile already registered as user)
      toast.error("This mobile is already registered as a user. Use a different number for listener account.");
    } catch (e) {
      toast.error(e?.message || "OTP verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader
        title={isRegister ? "Become a Listener" : "Listener Sign in"}
        left={
          <button
            data-testid="prov-auth-back"
            onClick={() => (step === 2 ? setStep(1) : nav("/"))}
            className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-6 pt-8 pb-10 space-y-6 fade-up">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#3DDC97]/15 border border-[#3DDC97]/30 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-[#3DDC97]" />
          </div>
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight text-[#F2F5FF]">
              {step === 1
                ? (isRegister ? "Earn as a Listener" : "Listener sign in")
                : "Verify your number"}
            </p>
            <p className="text-[#A9B1CC] text-sm mt-1">
              {step === 1
                ? (isRegister
                  ? "Sign up to start receiving paid calls and chats from users."
                  : `Sign in to your listener dashboard.`)
                : `We sent a code to +91 ${mobile}. Check your SMS.`}
            </p>
          </div>
        </div>

        {step === 1 ? (
          <>
            <div>
              <Label>Mobile number</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#6E7694] font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> +91
                </span>
                <Input
                  data-testid="prov-mobile"
                  inputMode="numeric"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98XXXXXXXX"
                  className="!pl-16 tabular-nums tracking-wide"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 text-xs text-[#A9B1CC] cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                data-testid="prov-consent"
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-[#101428] accent-[#3DDC97]"
              />
              <span>
                I agree to EMORVIA's{" "}
                <a
                  href="https://emorvia.in/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3DDC97] hover:underline"
                >
                  Privacy Policy
                </a>{" "}
                and consent to receive a one-time SMS code.
              </span>
            </label>

            <PrimaryButton
              data-testid="prov-send-otp"
              disabled={busy || mobile.length !== 10 || !agreed}
              onClick={sendOtp}
              className="!bg-[#3DDC97] hover:!bg-[#34c486] !shadow-[0_8px_24px_rgba(61,220,151,0.30)]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
            </PrimaryButton>

            <div className="flex items-center gap-2 text-[11px] text-[#6E7694] pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3DDC97]" />
              <span>One-tap auth — OTP delivered by MessageCentral.</span>
            </div>

            <p className="text-center text-sm text-[#A9B1CC] pt-2">
              {isRegister ? (
                <>
                  Already a listener?{" "}
                  <Link to="/provider/login" data-testid="prov-go-login" className="text-[#3DDC97] font-semibold hover:underline">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Want to become a listener?{" "}
                  <Link to="/provider/register" data-testid="prov-go-register" className="text-[#3DDC97] font-semibold hover:underline">
                    Create account
                  </Link>
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <div>
              <Label>6-digit OTP</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694]" />
                <Input
                  ref={codeRef}
                  data-testid="prov-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="!pl-10 tabular-nums tracking-[0.5em] text-center text-lg font-semibold"
                />
              </div>
            </div>
            <PrimaryButton
              data-testid="prov-verify-otp"
              disabled={busy || code.length < 4}
              onClick={verifyOtp}
              className="!bg-[#3DDC97] hover:!bg-[#34c486] !shadow-[0_8px_24px_rgba(61,220,151,0.30)]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
            </PrimaryButton>
            <div className="text-center text-sm">
              {resendIn > 0 ? (
                <span className="text-[#A9B1CC]">Resend OTP in {resendIn}s</span>
              ) : (
                <button
                  data-testid="prov-resend"
                  onClick={sendOtp}
                  disabled={busy}
                  className="text-[#3DDC97] font-semibold hover:underline"
                >
                  Resend OTP
                </button>
              )}
            </div>
          </>
        )}

        <PrivacyFooter />
      </div>
    </MobileShell>
  );
}
