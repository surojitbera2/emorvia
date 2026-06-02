import React, { useEffect, useState } from "react";
import { useNavigate, NavLink, Routes, Route, useLocation } from "react-router-dom";
import { Users, UserCog, CreditCard, BarChart3, LogOut, Video, Menu, ChevronDown, Wallet, Languages, Settings as SettingsIcon } from "lucide-react";
import { getSession, clearSession } from "../lib/auth";
import { Toaster } from "sonner";
import AdminUsers from "./admin/AdminUsers";
import AdminProviders from "./admin/AdminProviders";
import AdminPayments from "./admin/AdminPayments";
import AdminPayouts from "./admin/AdminPayouts";
import AdminLanguages from "./admin/AdminLanguages";
import AdminReports from "./admin/AdminReports";
import AdminSettings from "./admin/AdminSettings";

const links = [
  { to: "/admin/reports", label: "Overview", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/providers", label: "Providers", icon: UserCog },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/languages", label: "Languages", icon: Languages },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "admin") nav("/admin/login");
  }, [nav]);

  // Close drawer on route change
  useEffect(() => { setDrawer(false); }, [location.pathname]);

  // Lock scroll when drawer open
  useEffect(() => {
    if (drawer) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  const currentLabel = links.find((l) => location.pathname.startsWith(l.to))?.label || "Overview";

  const SidebarContent = ({ onItemClick }) => (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-8 px-1">
        <div className="w-9 h-9 rounded-xl bg-[#6FA8FF] flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4)]">
          <Video className="w-5 h-5 text-black" />
        </div>
        <div>
          <p className="font-heading text-base font-bold leading-none">EMORVIA</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#6FA8FF] mt-1">Admin</p>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-[#6E7694] font-semibold mb-2 px-1">Manage</p>
      <nav className="space-y-1 flex-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={onItemClick}
            data-testid={`admin-nav-${l.label.toLowerCase()}`}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                isActive
                  ? "bg-[#6FA8FF]/10 text-[#6FA8FF] border border-[#6FA8FF]/25 shadow-[0_4px_20px_-8px_rgba(245,158,11,0.4)]"
                  : "text-[#A9B1CC] hover:bg-white/[0.04] hover:text-white border border-transparent"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#6FA8FF] rounded-r-full" />}
                <l.icon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{l.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2.5 px-1 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6FA8FF] to-[#5B92F5] flex items-center justify-center text-black text-xs font-bold">A</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">admindash</p>
            <p className="text-[10px] text-[#6E7694]">Administrator</p>
          </div>
        </div>
        <button
          data-testid="admin-logout"
          onClick={() => { clearSession(); nav("/"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#A9B1CC] hover:text-[#EF4444] hover:bg-[#EF4444]/5 border border-transparent hover:border-[#EF4444]/15 transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#101428] text-white">
      <Toaster theme="dark" position="top-right" />

      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#6FA8FF]/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[#10B981]/[0.04] blur-[120px]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:block sticky top-0 h-screen border-r border-white/5 bg-[#0B0F22]/80 backdrop-blur-xl p-5">
          <SidebarContent />
        </aside>

        {/* MOBILE DRAWER */}
        {drawer && (
          <>
            <div
              onClick={() => setDrawer(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
              data-testid="admin-drawer-backdrop"
            />
            <aside
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-[#0B0F22] border-r border-white/10 z-50 p-5 lg:hidden shadow-2xl"
              style={{ animation: "slideInLeft 0.25s ease-out" }}
              data-testid="admin-drawer"
            >
              <SidebarContent onItemClick={() => setDrawer(false)} />
            </aside>
          </>
        )}

        <main className="min-w-0">
          {/* MOBILE TOPBAR */}
          <header className="lg:hidden sticky top-0 z-30 bg-[#101428]/85 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
            <button
              data-testid="admin-menu-toggle"
              onClick={() => setDrawer(true)}
              className="p-2 -ml-1 rounded-lg hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#6FA8FF] flex items-center justify-center">
                <Video className="w-4 h-4 text-black" />
              </div>
              <div className="flex items-center gap-1.5">
                <p className="font-heading text-sm font-bold">EMORVIA</p>
                <ChevronDown className="w-3 h-3 text-[#6E7694]" />
                <p className="text-sm text-[#6FA8FF] font-semibold">{currentLabel}</p>
              </div>
            </div>
            <span className="ml-auto text-[10px] px-2 py-1 rounded-md bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 font-semibold tracking-wider">LIVE</span>
          </header>

          {/* DESKTOP TOPBAR */}
          <header className="hidden lg:flex sticky top-0 z-20 bg-[#101428]/85 backdrop-blur-xl border-b border-white/5 px-8 py-4 items-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#6E7694]">
              <span className="text-[#6FA8FF]">Admin</span> · <span className="text-white">{currentLabel}</span>
            </p>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 font-semibold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] dot-pulse" /> LIVE
            </span>
          </header>

          <div className="p-4 sm:p-6 lg:p-10 max-w-6xl">
            <Routes>
              <Route index element={<AdminReports />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="providers" element={<AdminProviders />} />
              <Route path="payouts" element={<AdminPayouts />} />
              <Route path="languages" element={<AdminLanguages />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="settings" element={<AdminSettings />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* keyframe inline */}
      <style>{`
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
