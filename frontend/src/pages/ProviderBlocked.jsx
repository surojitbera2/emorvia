import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShieldOff, UserX } from "lucide-react";
import { MobileShell, GlassHeader, BottomNav } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession } from "../lib/auth";
import { toast, Toaster } from "sonner";

export default function ProviderBlocked() {
  const nav = useNavigate();
  const [list, setList] = useState(null);

  const load = async () => {
    try { setList(await api.providerGetBlocks()); }
    catch (e) { toast.error(e.message); }
  };

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "provider") { nav("/register"); return; }
    load();
  }, [nav]);

  const unblock = async (id) => {
    if (!window.confirm("Unblock this user? They will be able to call you again.")) return;
    try {
      await api.providerUnblockUser(id);
      toast.success("User unblocked");
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (list === null) return null;

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader
        title="Blocked Users"
        left={<button data-testid="blocked-back" onClick={() => nav(-1)} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" /></button>}
      />
      <div className="px-5 pt-5 pb-32 space-y-3">
        <div className="bg-[#171C33] border border-white/5 rounded-2xl p-5 fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center">
              <ShieldOff className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div>
              <p className="font-heading text-lg font-bold">{list.length} blocked</p>
              <p className="text-xs text-[#A9B1CC]">These users cannot call you.</p>
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-sm text-[#A9B1CC] p-6 text-center bg-white/[0.02] border border-white/5 rounded-xl">
            You haven't blocked anyone yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {list.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3.5 bg-[#171C33] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#EF4444]/10 flex items-center justify-center">
                    <UserX className="w-4 h-4 text-[#EF4444]" />
                  </div>
                  <div>
                    <p className="text-sm text-white">{u.name}</p>
                    <p className="text-[11px] text-[#A9B1CC]">+91 {u.mobile}</p>
                  </div>
                </div>
                <button
                  data-testid={`unblock-${u.id}`}
                  onClick={() => unblock(u.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#6FA8FF]/10 border border-[#6FA8FF]/30 text-[#6FA8FF] hover:bg-[#6FA8FF]/20"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav role="provider" />
    </MobileShell>
  );
}
