import React, { useState } from "react";
import { api } from "../../lib/store";
import { Input } from "../../components/MobileShell";
import { Lock, Save, ShieldCheck, KeyRound, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const changePassword = async () => {
    if (!pwd.current) return toast.error("Enter current password");
    if (!pwd.next) return toast.error("Enter new password");
    if (pwd.next.length < 6) return toast.error("New password must be at least 6 characters");
    if (pwd.next !== pwd.confirm) return toast.error("New password and confirmation do not match");
    if (pwd.next === pwd.current) return toast.error("New password must be different from current");

    setBusy(true);
    try {
      await api.adminChangePassword(pwd.current, pwd.next);
      toast.success("Admin password changed successfully");
      setPwd({ current: "", next: "", confirm: "" });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[#A9B1CC] mt-1">Manage your admin account and security.</p>
      </header>

      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5 sm:p-6 max-w-xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-[#6FA8FF]" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold tracking-tight">Change Admin Password</h3>
            <p className="text-[12px] text-[#A9B1CC] mt-1">Update the password used to sign into the admin console.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs tracking-[0.08em] uppercase text-[#A9B1CC] font-medium mb-2 block">Current password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6E7694] z-10" />
              <Input
                data-testid="admin-current-password"
                type={showCurrent ? "text" : "password"}
                value={pwd.current}
                onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                placeholder="Enter current password"
                className="pl-9 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-[#6FA8FF] hover:text-[#5B92F5] font-semibold"
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs tracking-[0.08em] uppercase text-[#A9B1CC] font-medium mb-2 block">New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6E7694] z-10" />
              <Input
                data-testid="admin-new-password"
                type={showNext ? "text" : "password"}
                value={pwd.next}
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                placeholder="Min 6 characters"
                className="pl-9 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowNext((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-[#6FA8FF] hover:text-[#5B92F5] font-semibold"
              >
                {showNext ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-[11px] text-[#6E7694] mt-1.5">At least 6 characters. Avoid using personal info.</p>
          </div>

          <div>
            <label className="text-xs tracking-[0.08em] uppercase text-[#A9B1CC] font-medium mb-2 block">Confirm new password</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6E7694] z-10" />
              <Input
                data-testid="admin-confirm-password"
                type={showNext ? "text" : "password"}
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                placeholder="Re-enter new password"
                className="pl-9"
              />
            </div>
            {pwd.confirm && pwd.next !== pwd.confirm && (
              <p className="text-[11px] text-[#EF4444] mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Passwords do not match
              </p>
            )}
          </div>

          <button
            data-testid="admin-change-password-btn"
            disabled={busy || !pwd.current || !pwd.next || !pwd.confirm}
            onClick={changePassword}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-white font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" /> {busy ? "Saving..." : "Save new password"}
          </button>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-[#6FA8FF]/5 border border-[#6FA8FF]/15">
          <p className="text-[11px] text-[#6FA8FF] font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> Security tip
          </p>
          <p className="text-[11px] text-[#A9B1CC] mt-1.5 leading-relaxed">
            After changing your password, you'll need to use the new one next time you sign in. Existing sessions on this device stay active until you sign out.
          </p>
        </div>
      </section>
    </div>
  );
}
