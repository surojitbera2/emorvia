import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Upload, X, Save, Hourglass, CheckCircle2, Languages, Trash2, Camera as CameraIcon } from "lucide-react";
import { MobileShell, GlassHeader, PrimaryButton, Input, Label } from "../components/MobileShell";
import { api } from "../lib/store";
import { getSession, clearSession } from "../lib/auth";
import { pickImagesFromGallery, takePhotoFromCamera } from "../lib/imagePicker";
import { toast, Toaster } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export default function ProviderProfileEdit() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ name: "", bio: "", age: 25, avatars: [], languages: [], callPerMinRate: 20, chatPerMinRate: 10, upiId: "" });
  const [limits, setLimits] = useState({ minRate: 20, maxRate: 80 });
  const [allLangs, setAllLangs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "provider") { nav("/register"); return; }
    (async () => {
      try {
        const [p, langs] = await Promise.all([api.getProviderMe(), api.getLanguages().catch(() => [])]);
        setMe(p);
        setAllLangs(langs);
        setForm({
          name: p.name?.startsWith("Listener") ? "" : (p.name || ""),
          bio: p.bio || "",
          age: p.age || 25,
          avatars: (p.avatars && p.avatars.length ? p.avatars : (p.avatar ? [p.avatar] : [])),
          languages: Array.isArray(p.languages) ? p.languages : [],
          callPerMinRate: p.callPerMinRate ?? p.perMinRate ?? 20,
          chatPerMinRate: p.chatPerMinRate ?? Math.max(1, Math.round((p.perMinRate ?? 20) / 2)),
          upiId: p.upiId || "",
        });
        // Load global rate limits (admin can change these)
        try {
          const b = await api.getPublicBilling();
          if (b?.minRate && b?.maxRate) setLimits({ minRate: Number(b.minRate), maxRate: Number(b.maxRate) });
        } catch (_e) { /* ignore — use defaults */ }
      } catch { nav("/register"); }
    })();
  }, [nav]);

  const onPickFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    await uploadFiles(Array.from(files));
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadFiles = async (files) => {
    if (!files?.length) return;
    for (const f of files) if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} > 8MB`); return; }
    setUploading(true);
    try {
      const { urls } = await api.providerUploadImages(files);
      setForm((s) => ({ ...s, avatars: [...s.avatars, ...urls].slice(0, 8) }));
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  // Native-friendly gallery picker — uses Capacitor Camera plugin on Android
  // (reliable on Android 13+), falls back to hidden <input type=file> on web.
  const pickFromGallery = async () => {
    const remaining = 8 - form.avatars.length;
    if (remaining <= 0) { toast.error("Maximum 8 images allowed"); return; }
    try {
      const picked = await pickImagesFromGallery(remaining);
      if (!picked.length) return;
      await uploadFiles(picked);
    } catch (e) { toast.error(e?.message || "Could not open gallery"); }
  };

  // Capture a photo with the device camera (native only).
  const pickFromCamera = async () => {
    if (form.avatars.length >= 8) { toast.error("Maximum 8 images allowed"); return; }
    try {
      const photo = await takePhotoFromCamera();
      if (!photo) return;
      await uploadFiles([photo]);
    } catch (e) { toast.error(e?.message || "Could not open camera"); }
  };

  const isNativeApp = (() => {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch { return false; }
  })();
  const removeImg = (i) => setForm((s) => ({ ...s, avatars: s.avatars.filter((_, idx) => idx !== i) }));
  const makeCover = (i) => setForm((s) => {
    if (i === 0) return s;
    const a = [...s.avatars]; const [it] = a.splice(i, 1); a.unshift(it);
    return { ...s, avatars: a };
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Please add your name");
    if (form.avatars.length === 0) return toast.error("Add at least one image");
    const callRate = Math.round(Number(form.callPerMinRate) || 0);
    const chatRate = Math.round(Number(form.chatPerMinRate) || 0);
    const { minRate, maxRate } = limits;
    if (callRate < minRate || callRate > maxRate) return toast.error(`Video call rate must be ₹${minRate}-₹${maxRate}`);
    if (chatRate < minRate || chatRate > maxRate) return toast.error(`Chat rate must be ₹${minRate}-₹${maxRate}`);
    setBusy(true);
    try {
      const updated = await api.providerUpdateProfile({
        name: form.name.trim(),
        bio: form.bio.trim(),
        age: Number(form.age),
        avatars: form.avatars,
        languages: form.languages,
        callPerMinRate: callRate,
        chatPerMinRate: chatRate,
        upiId: form.upiId.trim(),
      });
      setMe(updated);
      toast.success("Profile saved");
      if (updated.status === "active") setTimeout(() => nav("/provider"), 500);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProviderMe();
      toast.success("Account deleted");
      clearSession();
      setTimeout(() => nav("/"), 400);
    } catch (e) {
      toast.error(e.message || "Failed to delete account");
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (!me) return null;
  const pending = me.status === "pending";

  return (
    <MobileShell>
      <Toaster theme="dark" position="top-center" />
      <GlassHeader
        title="Edit profile"
        left={<button data-testid="pe-back" onClick={() => nav(-1)} className="mr-1 -ml-2 p-2 rounded-lg hover:bg-white/5"><ChevronLeft className="w-5 h-5" /></button>}
      />
      <div className="px-5 pt-5 pb-32 space-y-5">
        {pending ? (
          <div className="p-4 rounded-2xl bg-[#6FA8FF]/10 border border-[#6FA8FF]/30 flex items-start gap-3 fade-up">
            <Hourglass className="w-5 h-5 text-[#6FA8FF] shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-semibold text-[#6FA8FF]">Profile under review</p>
              <p className="text-xs text-[#A9B1CC] mt-1">Complete your details — admin will review and activate your listing. You won&apos;t appear in search until approved.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center gap-3 fade-up">
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
            <div>
              <p className="font-heading font-semibold text-[#10B981]">Profile active</p>
              <p className="text-xs text-[#A9B1CC]">Your listing is visible to users.</p>
            </div>
          </div>
        )}

        <div className="bg-[#171C33] border border-white/5 rounded-2xl p-5 space-y-4 fade-up delay-1">
          <div>
            <Label>Display name</Label>
            <Input data-testid="pe-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your professional name" />
          </div>
          <div>
            <Label>Bio</Label>
            <textarea
              data-testid="pe-bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="A short intro — your specialty and experience."
              rows={3}
              maxLength={300}
              className="w-full bg-[#101428] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] text-sm"
            />
            <p className="text-[10px] text-[#6E7694] mt-1">{form.bio.length}/300</p>
          </div>
          <div>
            <Label>Age</Label>
            <Input data-testid="pe-age" type="number" min={18} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Video call rate (₹/min)</Label>
              <Input
                data-testid="pe-call-rate"
                type="number"
                min={limits.minRate}
                max={limits.maxRate}
                value={form.callPerMinRate}
                onChange={(e) => setForm({ ...form, callPerMinRate: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder={`₹${limits.minRate}-${limits.maxRate}`}
              />
            </div>
            <div>
              <Label>Chat rate (₹/min)</Label>
              <Input
                data-testid="pe-chat-rate"
                type="number"
                min={limits.minRate}
                max={limits.maxRate}
                value={form.chatPerMinRate}
                onChange={(e) => setForm({ ...form, chatPerMinRate: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder={`₹${limits.minRate}-${limits.maxRate}`}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#6E7694] -mt-3">
            Both rates must be between ₹{limits.minRate} and ₹{limits.maxRate} per minute (set by admin). Earnings = rate × admin share %.
          </p>
          <div>
            <Label>UPI ID for payouts</Label>
            <Input
              data-testid="pe-upi-id"
              type="text"
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value.trim() })}
              placeholder="yourname@upi"
            />
            <p className="text-[10px] text-[#6E7694] mt-1">Admin uses this to send your earnings via Cashfree UPI payouts.</p>
          </div>
          <div>
            <Label>Mobile</Label>
            <Input value={`+91 ${me.mobile}`} readOnly className="opacity-70" />
            <p className="text-[10px] text-[#6E7694] mt-1">Mobile is locked to your verified number.</p>
          </div>
          <div>
            <Label><Languages className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /> Languages you speak</Label>
            {allLangs.length === 0 ? (
              <p className="text-xs text-[#6E7694] py-2">No languages available yet. Ask admin to add some.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {allLangs.map((lang) => {
                  const active = form.languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      data-testid={`lang-${lang}`}
                      onClick={() => setForm((s) => ({
                        ...s,
                        languages: active ? s.languages.filter((x) => x !== lang) : [...s.languages, lang],
                      }))}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        active
                          ? "bg-[#6FA8FF] text-black border-[#6FA8FF]"
                          : "bg-white/5 text-[#A9B1CC] border-white/10 hover:border-[#6FA8FF]/40 hover:text-white"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-[#6E7694] mt-2">Tap to select / deselect. Users see your languages on your profile.</p>
          </div>
        </div>

        <div className="bg-[#171C33] border border-white/5 rounded-2xl p-5 fade-up delay-2">
          <Label>Profile images <span className="text-[10px] text-[#A9B1CC]">(first = cover, up to 8, max 8MB each)</span></Label>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} data-testid="pe-file-input" />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={isNativeApp ? pickFromGallery : () => fileRef.current?.click()}
              disabled={uploading || form.avatars.length >= 8}
              data-testid="pe-browse"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#6FA8FF]/40 text-[#6FA8FF] hover:bg-[#6FA8FF]/10 text-sm font-semibold disabled:opacity-50 flex-1 justify-center min-w-[140px]"
            >
              <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Choose from gallery"}
            </button>
            {isNativeApp && (
              <button
                type="button"
                onClick={pickFromCamera}
                disabled={uploading || form.avatars.length >= 8}
                data-testid="pe-camera"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/10 text-sm font-semibold disabled:opacity-50 flex-1 justify-center min-w-[140px]"
              >
                <CameraIcon className="w-4 h-4" /> Take photo
              </button>
            )}
          </div>

          {form.avatars.length === 0 && (
            <p className="mt-3 text-xs text-[#6E7694]">No images yet. Add at least one cover photo so users can see your profile.</p>
          )}
          <p className="mt-2 text-[10px] text-[#6E7694]">{form.avatars.length} / 8 images · tap <X className="inline w-3 h-3 -mt-0.5" /> on any image to delete</p>

          {form.avatars.length > 0 && (
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {form.avatars.map((url, i) => (
                <div key={url + i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-[#101428] group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#6FA8FF] text-black px-1.5 py-0.5 rounded">COVER</span>}
                  <button onClick={() => removeImg(i)} data-testid={`pe-rm-${i}`} aria-label="Delete image" className="absolute top-1 right-1 w-7 h-7 bg-black/80 hover:bg-[#EF4444] rounded-full text-white flex items-center justify-center shadow-lg border border-white/20">
                    <X className="w-4 h-4" />
                  </button>
                  {i !== 0 && (
                    <button onClick={() => makeCover(i)} className="absolute bottom-1 right-1 text-[9px] bg-black/80 text-white px-1.5 py-0.5 rounded hover:bg-[#6FA8FF] hover:text-black">
                      Set cover
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <PrimaryButton data-testid="pe-save" onClick={save} disabled={busy}>
          <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save profile"}
        </PrimaryButton>

        <button
          type="button"
          data-testid="pe-delete-account-btn"
          onClick={() => setConfirmOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 font-semibold text-sm transition-colors fade-up delay-3"
        >
          <Trash2 className="w-4 h-4" /> Delete account
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          data-testid="pe-delete-confirm-dialog"
          className="bg-[#171C33] border border-white/10 text-white"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-heading">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A9B1CC]">
              This will permanently delete your provider profile, photos, call history and any pending earnings record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="pe-delete-cancel-btn"
              disabled={deleting}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="pe-delete-confirm-btn"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileShell>
  );
}
