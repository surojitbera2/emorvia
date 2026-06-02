import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Phone, Trash2 } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav, SecondaryButton } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession, clearSession } from "../lib/auth";
import { inr } from "../lib/format";
import { toast, Toaster } from "sonner";

export default function UserProfile() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [txnCount, setTxnCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "user") { nav("/register"); return; }
    (async () => {
      try {
        const [me, t] = await Promise.all([api.getMe(), api.getMyTxns()]);
        setUser(me); setTxnCount(t.length);
      } catch { nav("/register"); }
    })();
    // eslint-disable-next-line
  }, []);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteMe();
      toast.success("Account deleted");
      clearSession();
      setTimeout(() => nav("/"), 400);
    } catch (e) {
      toast.error(e.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  if (!user) return null;
  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader title="Profile" />
      <div className="px-5 pt-6 pb-32 space-y-5">
        <div className="flex items-center gap-4 p-5 bg-[#171C33] border border-white/5 rounded-2xl fade-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6FA8FF] to-[#5B92F5] flex items-center justify-center font-heading font-bold text-2xl text-black">
            {user.name[0]}
          </div>
          <div>
            <p className="font-heading text-xl font-semibold">{user.name}</p>
            <p className="text-sm text-[#A9B1CC] flex items-center gap-1.5"><Phone className="w-3 h-3" /> +91 {user.mobile}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 fade-up delay-1">
          <Tile label="Wallet" value={inr(user.wallet)} />
          <Tile label="Transactions" value={txnCount} />
        </div>
        <SecondaryButton data-testid="logout-btn" onClick={() => { clearSession(); nav("/"); }}>
          <LogOut className="w-4 h-4" /> Sign out
        </SecondaryButton>

        <button
          data-testid="delete-account-btn"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 font-semibold text-sm transition-colors fade-up delay-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete account"}
        </button>
      </div>

      <BottomNav role="user" />
    </MobileShell>
  );
}

const Tile = ({ label, value }) => (
  <div className="bg-[#171C33] border border-white/5 rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">{label}</p>
    <p className="font-heading font-bold text-lg text-white mt-1">{value}</p>
  </div>
);
