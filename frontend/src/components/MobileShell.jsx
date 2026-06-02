import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Wallet, User } from "lucide-react";

export const MobileShell = ({ children, className = "" }) => (
  <div className="min-h-screen w-full flex justify-center">
    <div className={`max-w-md w-full min-h-screen bg-[#101428] relative overflow-hidden shadow-2xl shadow-black/60 border-x border-white/5 ${className}`}>
      {children}
    </div>
  </div>
);

export const GlassHeader = ({ title, right, left }) => (
  <div className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#101428]/80 px-5 py-4 flex justify-between items-center border-b border-white/5">
    <div className="flex items-center gap-2">{left}<h2 className="font-heading text-lg font-semibold tracking-tight text-[#F2F5FF]">{title}</h2></div>
    <div className="flex items-center gap-2">{right}</div>
  </div>
);

export const BottomNav = ({ role = "user" }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const items = role === "provider"
    ? [
        { to: "/provider", label: "Home", icon: Home },
        { to: "/provider/earnings", label: "Earnings", icon: Wallet },
        { to: "/provider/profile", label: "Profile", icon: User },
      ]
    : [
        { to: "/app", label: "Discover", icon: Home },
        { to: "/wallet", label: "Wallet", icon: Wallet },
        { to: "/profile", label: "Profile", icon: User },
      ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-md mx-auto px-4 pb-4 pointer-events-auto">
        <div className="backdrop-blur-2xl bg-[#171C33]/85 border border-white/10 rounded-2xl px-2 py-2 flex items-center justify-around shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">
          {items.map((it) => {
            const active = loc.pathname === it.to;
            const Icon = it.icon;
            return (
              <button
                key={it.to}
                onClick={() => nav(it.to)}
                data-testid={`nav-${it.label.toLowerCase()}`}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${active ? "text-[#6FA8FF] bg-[#6FA8FF]/10" : "text-[#A9B1CC] hover:text-[#F2F5FF]"}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-wide">{it.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const PrimaryButton = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`w-full bg-[#6FA8FF] hover:bg-[#5B92F5] disabled:opacity-50 text-[#101428] font-semibold py-4 rounded-xl flex justify-center items-center gap-2 transition-transform active:scale-[0.98] shadow-[0_8px_24px_rgba(111,168,255,0.30)] ${className}`}
  >
    {children}
  </button>
);

export const SecondaryButton = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`w-full bg-[#252B47] hover:bg-[#2F3656] text-[#F2F5FF] font-medium py-4 rounded-xl flex justify-center items-center gap-2 transition-transform active:scale-[0.98] ${className}`}
  >
    {children}
  </button>
);

export const Input = React.forwardRef(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    className={`w-full bg-[#101428] border border-white/10 rounded-xl px-4 py-3.5 text-[#F2F5FF] placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] focus:ring-1 focus:ring-[#6FA8FF]/40 transition-all ${className}`}
  />
));

export const Label = ({ children }) => (
  <label className="text-xs tracking-[0.08em] uppercase text-[#A9B1CC] font-medium mb-2 block">{children}</label>
);
