import React, { useEffect, useState } from "react";
import { Download, Smartphone, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
   window.navigator.standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

const DISMISS_KEY = "emorvia_install_dismissed_at";

export default function InstallAppPrompt({ autoPromptDelayMs = 2500 }) {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const dismissedRecently = last && (Date.now() - last < 7 * 24 * 60 * 60 * 1000); // 7 days

    const onBefore = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (!dismissedRecently) setTimeout(() => setShow(true), autoPromptDelayMs);
    };
    const onInstalled = () => { setInstalled(true); setShow(false); toast.success("App installed"); };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);

    // iOS: no beforeinstallprompt — show manual help banner once
    if (isIOS() && !dismissedRecently) setTimeout(() => setShow(true), autoPromptDelayMs);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [autoPromptDelayMs]);

  const install = async () => {
    if (deferred) {
      try {
        deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setShow(false);
        setDeferred(null);
      } catch { /* ignore */ }
    } else if (isIOS()) {
      setIosHelp(true);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (installed) return null;
  if (!show && !iosHelp) {
    // Show small floating install button always (when installable) so user
    // can install on demand even after dismissing the auto-prompt.
    if (deferred || isIOS()) {
      return (
        <button
          data-testid="install-fab"
          onClick={() => { setShow(true); setIosHelp(false); }}
          className="fixed top-4 right-4 z-30 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#6FA8FF] hover:bg-[#5B92F5] text-black text-xs font-bold shadow-lg shadow-black/30 transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
      );
    }
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 pointer-events-none" data-testid="install-prompt">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-[#0F141C] border border-[#6FA8FF]/30 rounded-2xl shadow-2xl shadow-black/50 p-5 backdrop-blur-xl">
          {!iosHelp ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#6FA8FF]/15 border border-[#6FA8FF]/30 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-[#6FA8FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-base font-bold">Install EMORVIA</p>
                  <p className="text-xs text-[#A9B1CC] mt-0.5">Add to home screen — get instant call alerts even when the browser is closed.</p>
                </div>
                <button onClick={dismiss} data-testid="install-close" className="p-1.5 -mt-1 -mr-1 rounded-lg text-[#A9B1CC] hover:text-white hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={dismiss} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#A9B1CC] text-sm font-semibold">Maybe later</button>
                <button onClick={install} data-testid="install-btn" className="flex-1 py-2.5 rounded-xl bg-[#6FA8FF] hover:bg-[#5B92F5] text-black text-sm font-bold inline-flex items-center justify-center gap-1.5">
                  <Download className="w-4 h-4" /> Install
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#6FA8FF]/15 border border-[#6FA8FF]/30 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-[#6FA8FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-base font-bold">Add to Home Screen</p>
                  <p className="text-xs text-[#A9B1CC] mt-0.5">In Safari, tap the <strong className="text-white">Share</strong> icon → <strong className="text-white">Add to Home Screen</strong>.</p>
                </div>
                <button onClick={() => { setIosHelp(false); dismiss(); }} data-testid="install-ios-close" className="p-1.5 -mt-1 -mr-1 rounded-lg text-[#A9B1CC] hover:text-white hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => { setIosHelp(false); dismiss(); }} className="mt-4 w-full py-2.5 rounded-xl bg-[#6FA8FF] text-black text-sm font-bold inline-flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Got it
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
