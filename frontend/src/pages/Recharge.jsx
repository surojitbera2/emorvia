import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, CheckCircle2, QrCode, CreditCard, Smartphone, X, User, Mail, Phone } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, SecondaryButton, Input, Label } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { inr } from "../lib/format";
import { toast, Toaster } from "sonner";

const presets = [300, 400, 500, 1000];

export default function Recharge() {
  const nav = useNavigate();
  const [amount, setAmount] = useState(300);
  const [step, setStep] = useState(1); // 1: Amount+Method, 2: Manual UPI, 3: Success
  const [method, setMethod] = useState("manual"); // 'ext' | 'manual'
  const [upiSettings, setUpiSettings] = useState({ upiId: "", upiName: "EMORVIA", qrCodeUrl: "" });
  const [extPayment, setExtPayment] = useState({ enabled: false, label: "UPI / Net Banking / Card" });
  const [transactionId, setTransactionId] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState(null);

  // Customer-details modal for external payment
  const [showCustModal, setShowCustModal] = useState(false);
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/register"); return; }
    (async () => {
      try {
        const [upi, u, ext] = await Promise.all([
          api.getUpiSettings(),
          api.getMe(),
          api.getExtPaymentEnabled().catch(() => ({ enabled: false, label: "UPI / Net Banking / Card" })),
        ]);
        setUpiSettings(upi);
        setMe(u);
        setExtPayment(ext);
        // Pick first available method
        if (ext?.enabled) setMethod("ext");
        else if (upi?.upiId) setMethod("manual");
      } catch {}
    })();
    // eslint-disable-next-line
  }, []);

  const handleProceed = async () => {
    if (amount < 10) {
      toast.error("Minimum recharge amount is ₹10");
      return;
    }
    if (method === "ext") {
      if (!extPayment.enabled) {
        toast.error("Online payment not available. Please choose Manual UPI.");
        return;
      }
      // Open details modal with empty fields — user must fill in fresh
      setCustName("");
      setCustEmail("");
      setCustPhone("");
      setShowCustModal(true);
      return;
    }
    // Manual UPI flow
    if (!upiSettings.upiId) {
      toast.error("Manual UPI not configured. Contact admin.");
      return;
    }
    const localRef = `RCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setTransactionId(localRef);
    setStep(2);
  };

  const submitExtPayment = async () => {
    const name = custName.trim();
    const email = custEmail.trim();
    const phone = custPhone.replace(/\D/g, "");
    if (!name) { toast.error("Please enter your name"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email"); return; }
    if (phone.length < 10) { toast.error("Please enter a valid phone number"); return; }
    setBusy(true);
    try {
      const { redirectUrl } = await api.initiateExtPayment(amount, {
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
      });
      if (!redirectUrl) throw new Error("No redirect URL");
      window.location.href = redirectUrl;
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  const submitPayment = async () => {
    if (!transactionRef.trim()) {
      toast.error("Please enter UPI transaction ID / reference number");
      return;
    }
    setBusy(true);
    try {
      await api.requestRecharge({ amount, refNote: `${transactionId}:${transactionRef}` });
      setStep(3);
      toast.success("Payment submitted for verification");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const manualAvailable = !!upiSettings.upiId;
  const extAvailable = !!extPayment.enabled;
  const noneAvailable = !manualAvailable && !extAvailable;

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader title="Recharge Wallet" left={
        <button data-testid="recharge-back" onClick={() => nav(-1)} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" /></button>
      } />
      <div className="px-5 pt-6 pb-10">
        {/* Step 1: Choose Amount + Payment Method */}
        {step === 1 && (
          <div className="space-y-6 fade-up">
            <div>
              <Label>Choose amount to recharge</Label>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {presets.map((a) => (
                  <button
                    key={a}
                    data-testid={`preset-${a}`}
                    onClick={() => setAmount(a)}
                    className={`py-4 rounded-xl font-heading font-semibold border transition-all ${
                      amount === a
                        ? "bg-[#6FA8FF] text-white border-[#6FA8FF] shadow-lg shadow-[#6FA8FF]/30"
                        : "bg-[#171C33] text-white border-white/10 hover:border-[#6FA8FF]/50"
                    }`}
                  >
                    {inr(a)}
                  </button>
                ))}
              </div>
              <Input
                data-testid="custom-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                placeholder="Custom amount (min ₹10)"
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <Label>Payment Method</Label>
              <div className="space-y-2.5">
                {extAvailable && (
                  <button
                    data-testid="method-ext"
                    onClick={() => setMethod("ext")}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      method === "ext"
                        ? "bg-[#6FA8FF]/15 border-[#6FA8FF] shadow-lg shadow-[#6FA8FF]/20"
                        : "bg-[#171C33] border-white/10 hover:border-[#6FA8FF]/40"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === "ext" ? "bg-[#6FA8FF]" : "bg-white/5"}`}>
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-heading font-semibold text-white">{extPayment.label}</p>
                      <p className="text-[11px] text-[#A9B1CC]">Instant credit · Secure gateway</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === "ext" ? "border-[#6FA8FF] bg-[#6FA8FF]" : "border-white/30"}`}>
                      {method === "ext" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                )}
                {manualAvailable && (
                  <button
                    data-testid="method-manual"
                    onClick={() => setMethod("manual")}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      method === "manual"
                        ? "bg-[#6FA8FF]/15 border-[#6FA8FF] shadow-lg shadow-[#6FA8FF]/20"
                        : "bg-[#171C33] border-white/10 hover:border-[#6FA8FF]/40"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === "manual" ? "bg-[#6FA8FF]" : "bg-white/5"}`}>
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-heading font-semibold text-white">Manual UPI</p>
                      <p className="text-[11px] text-[#A9B1CC]">Scan QR · Admin verifies</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === "manual" ? "border-[#6FA8FF] bg-[#6FA8FF]" : "border-white/30"}`}>
                      {method === "manual" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                )}
              </div>
              {noneAvailable && (
                <p className="text-xs text-[#EF4444] mt-2">No payment methods configured. Please contact admin.</p>
              )}
            </div>

            <div className="p-4 bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 rounded-xl">
              <p className="text-xs text-[#A9B1CC] leading-relaxed">
                {method === "ext" ? (
                  <>
                    <strong className="text-[#6FA8FF]">How it works:</strong> Choose amount → Pay via secure gateway (UPI / Card / Net Banking) → Wallet credited instantly.
                  </>
                ) : (
                  <>
                    <strong className="text-[#6FA8FF]">How it works:</strong> Choose amount → Scan QR or use UPI ID to pay → Submit payment reference → Admin verifies and credits your wallet.
                  </>
                )}
              </p>
            </div>

            <PrimaryButton
              data-testid="proceed-to-payment"
              disabled={amount < 10 || noneAvailable || busy}
              onClick={handleProceed}
            >
              {method === "ext" ? <CreditCard className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
              {busy ? "Please wait..." : (method === "ext" ? `Pay ${inr(amount)}` : "Proceed to Payment")}
            </PrimaryButton>
          </div>
        )}

        {/* Step 2: Manual UPI QR + Reference Submission */}
        {step === 2 && (
          <div className="space-y-5 fade-up">
            <div className="text-center">
              <p className="text-xl font-heading font-bold text-white">Pay {inr(amount)}</p>
              <p className="text-sm text-[#A9B1CC] mt-1">Scan QR code or use UPI ID</p>
            </div>

            {upiSettings.qrCodeUrl && (
              <div className="bg-[#171C33] border border-white/10 rounded-2xl p-6">
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl">
                    <img src={upiSettings.qrCodeUrl} alt="Payment QR Code" className="w-64 h-64 object-contain" />
                  </div>
                </div>
                <p className="text-center text-xs text-[#A9B1CC] mt-4">Scan with any UPI app to pay</p>
              </div>
            )}

            <div className="bg-[#171C33] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-[#A9B1CC] mb-2">Or pay using UPI ID</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-base font-semibold text-white">{upiSettings.upiId}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(upiSettings.upiId); toast.success("UPI ID copied"); }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#A9B1CC]">Amount:</span>
                  <span className="font-heading text-lg font-bold text-[#6FA8FF]">{inr(amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#A9B1CC]">Pay to:</span>
                  <span className="text-white font-medium">{upiSettings.upiName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#A9B1CC]">Reference ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-white">{transactionId}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(transactionId); toast.success("Copied!"); }}
                      className="p-1 rounded bg-white/5 hover:bg-white/10"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label>UPI Transaction ID / Reference Number</Label>
              <Input
                data-testid="transaction-ref"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Enter transaction ID from your payment app"
              />
              <p className="text-[10px] text-[#6E7694] mt-1">You can find this in your UPI app's transaction history</p>
            </div>

            <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl">
              <p className="text-xs text-[#10B981] leading-relaxed">
                <strong>Note:</strong> After payment, enter your UPI transaction ID above and submit. We'll verify and credit your wallet within a few minutes.
              </p>
            </div>

            <PrimaryButton data-testid="submit-payment" onClick={submitPayment} disabled={busy || !transactionRef.trim()}>
              <CheckCircle2 className="w-4 h-4" />
              {busy ? "Submitting..." : "Submit Payment Confirmation"}
            </PrimaryButton>

            <SecondaryButton data-testid="back-to-amount" onClick={() => setStep(1)}>
              Change Amount
            </SecondaryButton>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="pt-10 text-center fade-up">
            <div className="w-20 h-20 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
            </div>
            <h2 className="font-heading text-2xl font-bold mt-6">Payment Submitted!</h2>
            <p className="text-sm text-[#A9B1CC] mt-2 max-w-sm mx-auto">
              Your recharge of {inr(amount)} has been submitted for verification. Admin will verify and credit your wallet shortly.
            </p>

            <div className="mt-6 p-4 bg-[#171C33] border border-white/10 rounded-xl inline-block">
              <p className="text-xs text-[#A9B1CC]">Reference ID</p>
              <p className="font-mono text-sm font-semibold text-white mt-1">{transactionId}</p>
            </div>

            <div className="mt-8 max-w-xs mx-auto space-y-3">
              <PrimaryButton data-testid="go-to-wallet" onClick={() => nav("/wallet")}>
                Back to Wallet
              </PrimaryButton>
              <SecondaryButton onClick={() => nav("/app")}>
                Go Home
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>

      {/* Customer details modal for external payment */}
      {showCustModal && (
        <div
          data-testid="cust-modal"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm fade-up"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setShowCustModal(false); }}
        >
          <div className="w-full sm:max-w-md bg-[#171C33] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-white">Payment Details</h3>
                <p className="text-xs text-[#A9B1CC] mt-1">Amount: <span className="text-[#6FA8FF] font-semibold">{inr(amount)}</span></p>
              </div>
              <button
                data-testid="cust-close"
                onClick={() => !busy && setShowCustModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#A9B1CC]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694] pointer-events-none" />
                  <Input
                    data-testid="cust-name"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Your full name"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694] pointer-events-none" />
                  <Input
                    data-testid="cust-email"
                    type="email"
                    inputMode="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694] pointer-events-none" />
                  <Input
                    data-testid="cust-phone"
                    type="tel"
                    inputMode="numeric"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit mobile number"
                    className="pl-10"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 rounded-lg">
              <p className="text-[11px] text-[#A9B1CC] leading-relaxed">
                These details are used by the payment gateway for the transaction. They are sent securely and not stored anywhere else.
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <PrimaryButton
                data-testid="cust-submit"
                onClick={submitExtPayment}
                disabled={busy}
              >
                <CreditCard className="w-4 h-4" />
                {busy ? "Redirecting..." : `Continue · Pay ${inr(amount)}`}
              </PrimaryButton>
              <SecondaryButton
                data-testid="cust-cancel"
                onClick={() => !busy && setShowCustModal(false)}
                disabled={busy}
              >
                Cancel
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
