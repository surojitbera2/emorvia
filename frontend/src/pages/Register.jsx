import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, Input, Label } from "../components/MobileShell";
import { PrivacyFooter } from "../components/PermissionNotice";
import { api } from "../lib/store";
import { getSession, setSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

/**
 * EMORVIA — Registration via SMS OTP (MessageCentral).
 *  Step 1: enter 10-digit mobile → send OTP via MessageCentral.
 *  Step 2: enter OTP → verify → backend creates user account if new
 *          (₹50 welcome bonus applied) and returns JWT.
 */
export default function Register() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [agreed, setAgreed] = useState(true);
  const codeRef = useRef(null);

  // Skip if already authenticated
  useEffect(() => {
    const s = getSession();
    if (!s) return;
    if (s.role === "provider") nav("/provider", { replace: true });
    else if (s.role === "user") nav("/app", { replace: true });
    else if (s.role === "admin") nav("/admin", { replace: true });
  }, [nav]);

  // Resend cooldown
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
      await api.otpSend({ mobile, role: "user" });
      toast.success(`OTP sent to +91 ${mobile}`);
      setStep(2);
      setResendIn(30);
      setTimeout(() => codeRef.current?.focus(), 100);
    } catch (e) {
      toast.error(e.message || "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length < 4) return toast.error("Enter the OTP");
    setBusy(true);
    try {
      const r = await api.otpVerify({ mobile, code, role: "user" });
      if (!r?.token) throw new Error("Verification failed — request a new OTP");
      if (r.provider?.id) {
        // mobile already exists as a listener
        setSession({ role: "provider", id: r.provider.id, token: r.token });
        toast.success("Welcome back, listener");
        setTimeout(() => nav("/provider", { replace: true }), 300);
        return;
      }
      setSession({ role: "user", id: r.user.id, token: r.token });
      toast.success(r.isNew ? "Account created — ₹50 welcome credit added!" : "Welcome back");
      setTimeout(() => nav("/app", { replace: true }), 400);
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
        title="Continue"
        left={
          <button
            data-testid="register-back"
            onClick={() => (step === 2 ? setStep(1) : nav("/"))}
            className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-6 pt-8 pb-10 space-y-6 fade-up">
        <div>
          <p className="font-heading text-3xl font-bold tracking-tight text-[#F2F5FF]">
            {step === 1 ? "Welcome to EMORVIA" : "Verify your number"}
          </p>
          <p className="text-[#A9B1CC] text-sm mt-1">
            {step === 1
              ? "Enter your mobile. New users get ₹50 free credit on signup."
              : `We sent a code to +91 ${mobile}. Check your SMS.`}
          </p>
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
                  data-testid="register-mobile"
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
                data-testid="register-consent"
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-[#101428] accent-[#6FA8FF]"
              />
              <span>
                I agree to EMORVIA's{" "}
                <a
                  href="https://emorvia.in/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="register-privacy-link"
                  className="text-[#6FA8FF] hover:underline"
                >
                  Privacy Policy
                </a>{" "}
                and consent to receive a one-time SMS code.
              </span>
            </label>

            <PrimaryButton
              data-testid="register-send-otp"
              disabled={busy || mobile.length !== 10 || !agreed}
              onClick={sendOtp}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
            </PrimaryButton>

            <div className="flex items-center gap-2 text-[11px] text-[#6E7694] pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3DDC97]" />
              <span>One-tap sign in or sign up. OTP delivered by MessageCentral.</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label>6-digit OTP</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694]" />
                <Input
                  ref={codeRef}
                  data-testid="register-otp"
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
              data-testid="register-verify-otp"
              disabled={busy || code.length < 4}
              onClick={verifyOtp}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
            </PrimaryButton>
            <div className="text-center text-sm">
              {resendIn > 0 ? (
                <span className="text-[#A9B1CC]">Resend OTP in {resendIn}s</span>
              ) : (
                <button
                  data-testid="register-resend"
                  onClick={sendOtp}
                  disabled={busy}
                  className="text-[#6FA8FF] font-semibold hover:underline"
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
