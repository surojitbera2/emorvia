import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, KeyRound, Loader2 } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, Input, Label } from "../components/MobileShell";
import PermissionNotice, { PrivacyFooter } from "../components/PermissionNotice";
import { api } from "../lib/store";
import { getSession, setSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

/**
 * Single OTP-based auth screen for both user and provider.
 * - Step 1: enter 10-digit mobile → request OTP
 * - Step 2: enter 6-digit OTP → verify + auto-create account if new
 */
export default function OtpAuth({ role = "user" }) {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef(null);

  // Already logged in? Bounce to the right dashboard regardless of which screen they hit.
  useEffect(() => {
    const s = getSession();
    if (!s) return;
    if (s.role === "provider") nav("/provider", { replace: true });
    else if (s.role === "user") nav("/app", { replace: true });
    else if (s.role === "admin") nav("/admin", { replace: true });
  }, [nav]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    if (mobile.length !== 10) return toast.error("Enter a valid 10-digit mobile");
    setBusy(true);
    try {
      await api.otpSend({ mobile, role });
      toast.success("OTP sent to +91 " + mobile);
      setStep(2);
      setResendIn(30);
      setTimeout(() => codeRef.current?.focus(), 100);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    if (code.length < 4) return toast.error("Enter the OTP");
    setBusy(true);
    try {
      const r = await api.otpVerify({ mobile, code, role });
      if (!r || !r.token) {
        throw new Error("Login failed — please request a new OTP");
      }
      // Backend may auto-route a user-role login to a provider session if the
      // mobile is registered as a provider. Detect from response shape.
      if (r.provider && r.provider.id) {
        setSession({ role: "provider", id: r.provider.id, token: r.token });
        toast.success(r.isNew ? "Welcome to EMORVIA — complete your profile" : "Welcome back");
        setTimeout(() => nav(r.isNew ? "/provider/profile/edit" : "/provider", { replace: true }), 250);
      } else if (r.user && r.user.id) {
        setSession({ role: "user", id: r.user.id, token: r.token });
        toast.success(r.isNew ? "Account created — ₹50 free trial credit added!" : "Welcome back");
        setTimeout(() => nav("/app", { replace: true }), 250);
      } else {
        throw new Error("Unexpected server response");
      }
    } catch (e) {
      toast.error(e?.message || "OTP verification failed");
    } finally { setBusy(false); }
  };

  const title = role === "provider" ? "Become a Listener" : "Sign in / Register";
  const intro = role === "provider"
    ? "Earn while you listen. Verify your mobile to get started."
    : "Sign in with your mobile — users and listeners use the same login.";

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <PermissionNotice />
      <GlassHeader
        title={title}
        left={
          <button data-testid="otp-back" onClick={() => (step === 2 ? setStep(1) : nav("/"))} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-6 pt-8 pb-10 space-y-6 fade-up">
        <div>
          <p className="font-heading text-3xl font-bold tracking-tight">
            {step === 1 ? title : "Enter OTP"}
          </p>
          <p className="text-[#A9B1CC] text-sm mt-1">
            {step === 1 ? intro : `Sent to +91 ${mobile} · check your SMS.`}
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
                  data-testid="otp-mobile"
                  inputMode="numeric"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98XXXXXXXX"
                  className="!pl-16 tabular-nums tracking-wide"
                />
              </div>
            </div>
            <PrimaryButton data-testid="otp-send-btn" disabled={busy || mobile.length !== 10} onClick={sendOtp}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
            </PrimaryButton>
            {role === "user" ? (
              <p className="text-center text-sm text-[#A9B1CC] pt-2">
                New listener?{" "}
                <button type="button" data-testid="goto-listener" onClick={() => nav("/provider/register")} className="text-[#6FA8FF] font-semibold hover:underline">
                  Register as Listener
                </button>
              </p>
            ) : (
              <p className="text-center text-sm text-[#A9B1CC] pt-2">
                Already registered?{" "}
                <button type="button" onClick={() => nav("/register")} className="text-[#6FA8FF] font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </>
        ) : (
          <>
            <div>
              <Label>6-digit OTP</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694]" />
                <Input
                  ref={codeRef}
                  data-testid="otp-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="!pl-10 tabular-nums tracking-[0.5em] text-center text-lg font-semibold"
                />
              </div>
            </div>
            <PrimaryButton data-testid="otp-verify-btn" disabled={busy || code.length < 4} onClick={verifyOtp}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
            </PrimaryButton>
            <div className="text-center text-sm">
              {resendIn > 0 ? (
                <span className="text-[#A9B1CC]">Resend OTP in {resendIn}s</span>
              ) : (
                <button data-testid="otp-resend" onClick={sendOtp} disabled={busy} className="text-[#6FA8FF] font-semibold hover:underline">
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
