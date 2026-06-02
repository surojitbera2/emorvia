import React, { useEffect, useRef, useState } from "react";
import { api } from "../../lib/store";
import { Input } from "../../components/MobileShell";
import { Plus, Trash2, Upload, X, Image as ImageIcon, CheckCircle, Hourglass, Edit3, Languages as LangIcon, Save } from "lucide-react";
import { inr } from "../../lib/format";
import { toast } from "sonner";

// ---------- Reusable image picker (browse + upload + preview + reorder/remove) ----------
function ImageUploader({ value, onChange, compact = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFiles = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    // Client-side size sanity: 8MB per file
    for (const f of files) {
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} exceeds 8 MB`); return; }
    }
    setBusy(true);
    try {
      const { urls } = await api.adminUploadImages(files);
      onChange([...(value || []), ...urls]);
      toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} uploaded`);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (i) => onChange((value || []).filter((_, idx) => idx !== i));
  const moveFirst = (i) => {
    if (i === 0) return;
    const arr = [...(value || [])];
    const [it] = arr.splice(i, 1);
    arr.unshift(it);
    onChange(arr);
  };

  const list = value || [];

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={onFiles}
        className="hidden"
        data-testid="provider-image-input"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          data-testid="provider-image-browse"
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#6FA8FF]/40 text-[#6FA8FF] hover:bg-[#6FA8FF]/10 text-xs font-semibold disabled:opacity-50 ${compact ? "" : ""}`}
        >
          <Upload className="w-3.5 h-3.5" /> {busy ? "Uploading…" : "Browse images"}
        </button>
        <span className="text-[11px] text-[#A9B1CC]">
          {list.length === 0 ? "JPG / PNG / WEBP — max 8 MB each. First image is the cover." : `${list.length} image${list.length > 1 ? "s" : ""} selected`}
        </span>
      </div>

      {list.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {list.map((url, i) => (
            <div key={url + i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-[#101428]">
              <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#6FA8FF] text-black px-1.5 py-0.5 rounded">COVER</span>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                data-testid={`provider-image-remove-${i}`}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-[#EF4444] rounded-full text-white flex items-center justify-center"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => moveFirst(i)}
                  className="absolute bottom-1 right-1 text-[9px] bg-black/70 hover:bg-white/20 text-white px-1.5 py-0.5 rounded"
                  title="Make cover"
                >
                  Make cover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProviders() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", mobile: "", password: "", bio: "", age: 30, avatars: [] });
  const [busy, setBusy] = useState(false);
  const [allLangs, setAllLangs] = useState([]);
  const [edit, setEdit] = useState(null);  // full edit modal state

  const refresh = async () => {
    try { setList(await api.adminGetProviders()); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => {
    refresh();
    api.adminGetLanguages().then(setAllLangs).catch(() => {});
  }, []);

  const add = async () => {
    if (!form.name || !form.mobile) return toast.error("Name and mobile required");
    if (!form.password || form.password.length < 6) return toast.error("Password (min 6 characters) required");
    setBusy(true);
    try {
      await api.adminAddProvider({
        name: form.name, mobile: form.mobile, password: form.password, bio: form.bio,
        age: Number(form.age),
        avatars: form.avatars, avatar: form.avatars[0] || "",
      });
      setForm({ name: "", mobile: "", password: "", bio: "", age: 30, avatars: [] });
      await refresh();
      toast.success("Provider added");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this provider?")) return;
    try { await api.adminDeleteProvider(id); await refresh(); toast("Provider removed"); } catch (e) { toast.error(e.message); }
  };
  const updateRate = null; // removed — rates are now global packages, set in Payments
  const setStatus = async (id, status) => {
    try { await api.adminUpdateProvider(id, { status }); await refresh(); toast.success(`Provider ${status === "active" ? "approved" : "rejected"}`); }
    catch (e) { toast.error(e.message); }
  };
  const openEdit = (p) => setEdit({
    id: p.id,
    name: p.name || "",
    mobile: p.mobile || "",
    bio: p.bio || "",
    age: p.age || 25,
    status: p.status || "active",
    avatars: (p.avatars && p.avatars.length ? p.avatars : (p.avatar ? [p.avatar] : [])),
    languages: Array.isArray(p.languages) ? p.languages : [],
    realMeetEnabled: p.realMeetEnabled || false,
    videoCallEnabled: p.videoCallEnabled !== false,
    online: p.online || false,
    password: "",  // Always start empty for security
    perMinRate: p.perMinRate ?? 20,
    sharePctOverride: p.sharePctOverride ?? "",
  });
  const saveEdit = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error("Name required");
    if (edit.password && edit.password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      const payload = {
        name: edit.name.trim(),
        mobile: edit.mobile,
        bio: edit.bio,
        age: Number(edit.age),
        status: edit.status,
        avatars: edit.avatars,
        languages: edit.languages,
        realMeetEnabled: edit.realMeetEnabled,
        videoCallEnabled: edit.videoCallEnabled,
        online: edit.online,
        perMinRate: Math.max(0, Number(edit.perMinRate) || 0),
        sharePctOverride: edit.sharePctOverride === "" || edit.sharePctOverride === null
          ? null
          : Math.max(0, Math.min(100, Number(edit.sharePctOverride))),
      };
      if (edit.password) {
        payload.password = edit.password;
      }
      await api.adminUpdateProvider(edit.id, payload);
      setEdit(null);
      await refresh();
      toast.success("Provider updated");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Providers</h1>
        <p className="text-sm text-[#A9B1CC] mt-1">Manage listeners, their per-minute rate, and payout share override.</p>
      </header>

      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-4 sm:p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">Add provider</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input data-testid="add-pr-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input data-testid="add-pr-mobile" placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input data-testid="add-pr-password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input data-testid="add-pr-age" placeholder="Age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </div>
        <div className="mt-3">
          <Input data-testid="add-pr-bio" placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide uppercase text-[#A9B1CC] mb-2 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Provider images</p>
          <ImageUploader value={form.avatars} onChange={(arr) => setForm({ ...form, avatars: arr })} />
        </div>
        <button data-testid="add-pr-btn" disabled={busy} onClick={add} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-white font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add provider
        </button>
      </section>

      <section className="bg-[#171C33] border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-[#0B0F22] text-[#A9B1CC]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Mobile</th>
              <th className="px-4 py-3 text-left font-medium">Rate / Share</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Earnings</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.avatar
                      ? <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-lg object-cover" />
                      : <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#A9B1CC]"><ImageIcon className="w-4 h-4" /></div>}
                    <div className="min-w-0">
                      <p className="text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-[#A9B1CC]">Age {p.age} · {(p.avatars || []).length || (p.avatar ? 1 : 0)} img · {(p.languages || []).length} lang</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#A9B1CC]">+91 {p.mobile}</td>
                <td className="px-4 py-3 text-[#A9B1CC] tabular-nums">
                  ₹{p.perMinRate ?? 20}/min
                  {p.sharePctOverride != null && (
                    <span className="ml-1 text-[10px] text-[#6FA8FF]">· {p.sharePctOverride}%</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5 items-start">
                    {p.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#6FA8FF]/10 text-[#6FA8FF] border border-[#6FA8FF]/20"><Hourglass className="w-2.5 h-2.5" /> PENDING</span>
                    ) : p.status === "rejected" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20">REJECTED</span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.online ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" : "bg-white/5 text-[#A9B1CC] border border-white/10"}`}>
                        {p.online ? "ONLINE" : "OFFLINE"}
                      </span>
                    )}
                    {p.status === "pending" && (
                      <button onClick={() => setStatus(p.id, "active")} data-testid={`approve-${p.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/20">
                        <CheckCircle className="w-2.5 h-2.5" /> Approve
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#10B981] font-heading font-semibold">{inr(p.earnings || 0)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button data-testid={`edit-pr-${p.id}`} onClick={() => openEdit(p)} className="text-[#6FA8FF] p-2 rounded-lg hover:bg-[#6FA8FF]/10" title="Edit profile">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button data-testid={`del-pr-${p.id}`} onClick={() => remove(p.id)} className="text-[#EF4444] p-2 rounded-lg hover:bg-[#EF4444]/10" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#A9B1CC]">No providers yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* Full Edit Dialog */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="provider-edit-dlg">
          <div className="w-full max-w-2xl bg-[#0F141C] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between p-5 sm:p-6 border-b border-white/5">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6FA8FF] font-semibold">Edit provider</p>
                <h3 className="font-heading text-xl font-bold mt-1">{edit.name || "Untitled"}</h3>
              </div>
              <button onClick={() => setEdit(null)} className="p-1.5 -mr-1 rounded-lg hover:bg-white/5 text-[#A9B1CC]"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Name</label>
                  <Input data-testid="edit-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Mobile (10 digits)</label>
                  <Input data-testid="edit-mobile" value={edit.mobile} onChange={(e) => setEdit({ ...edit, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Bio</label>
                <textarea
                  data-testid="edit-bio"
                  value={edit.bio}
                  onChange={(e) => setEdit({ ...edit, bio: e.target.value })}
                  rows={3} maxLength={300}
                  className="w-full bg-[#101428] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-[#6E7694] focus:outline-none focus:border-[#6FA8FF] text-sm"
                />
                <p className="text-[10px] text-[#6E7694] mt-1">{(edit.bio || "").length}/300</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Age</label>
                  <Input data-testid="edit-age" type="number" min={18} max={99} value={edit.age} onChange={(e) => setEdit({ ...edit, age: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Status</label>
                  <select
                    data-testid="edit-status"
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                    className="w-full bg-[#101428] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#6FA8FF]"
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Per-min rate (₹/min)</label>
                  <Input
                    data-testid="edit-permin-rate"
                    type="number"
                    min={0}
                    max={10000}
                    value={edit.perMinRate}
                    onChange={(e) => setEdit({ ...edit, perMinRate: e.target.value })}
                    placeholder="e.g. 20"
                  />
                  <p className="text-[10px] text-[#6E7694] mt-1">What users pay per minute. Provider can also set this from their profile.</p>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Payout share override (%)</label>
                  <Input
                    data-testid="edit-share-override"
                    type="number"
                    min={0}
                    max={100}
                    value={edit.sharePctOverride}
                    onChange={(e) => setEdit({ ...edit, sharePctOverride: e.target.value })}
                    placeholder="Leave blank for global default"
                  />
                  <p className="text-[10px] text-[#6E7694] mt-1">Provider's % share of each call. Leave blank to use the global setting from Payments page.</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Change Password (optional)</label>
                <Input 
                  data-testid="edit-password" 
                  type="password" 
                  value={edit.password || ""} 
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })} 
                  placeholder="Leave blank to keep current password"
                />
                <p className="text-[10px] text-[#6E7694] mt-1">Minimum 6 characters. Only fill if you want to change.</p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-2 flex items-center gap-1.5"><LangIcon className="w-3 h-3" /> Languages</p>
                {allLangs.length === 0 ? (
                  <p className="text-xs text-[#6E7694]">No languages configured. Add some in the Languages tab.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allLangs.map((lang) => {
                      const active = edit.languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setEdit({
                            ...edit,
                            languages: active ? edit.languages.filter((x) => x !== lang) : [...edit.languages, lang],
                          })}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                            active ? "bg-[#6FA8FF] text-black border-[#6FA8FF]" : "bg-white/5 text-[#A9B1CC] border-white/10 hover:border-[#6FA8FF]/40"
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-3">Features</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-[#6FA8FF]/30">
                    <input
                      type="checkbox"
                      checked={edit.videoCallEnabled}
                      onChange={(e) => setEdit({ ...edit, videoCallEnabled: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 bg-[#101428] checked:bg-[#6FA8FF] checked:border-[#6FA8FF] focus:ring-2 focus:ring-[#6FA8FF]/30"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Video Call Enabled</p>
                      <p className="text-xs text-[#A9B1CC]">Users can make video calls to this provider</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-[#6FA8FF]/30">
                    <input
                      type="checkbox"
                      checked={edit.realMeetEnabled}
                      onChange={(e) => setEdit({ ...edit, realMeetEnabled: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 bg-[#101428] checked:bg-[#6FA8FF] checked:border-[#6FA8FF] focus:ring-2 focus:ring-[#6FA8FF]/30"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Real Meet Enabled</p>
                      <p className="text-xs text-[#A9B1CC]">Users can request real meet via WhatsApp</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-[#10B981]/30">
                    <input
                      type="checkbox"
                      checked={edit.online}
                      onChange={(e) => setEdit({ ...edit, online: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 bg-[#101428] checked:bg-[#10B981] checked:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/30"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Provider Online</p>
                      <p className="text-xs text-[#A9B1CC]">Set provider as online/offline (users see this status)</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-2">Profile images</p>
                <ImageUploader value={edit.avatars} onChange={(arr) => setEdit({ ...edit, avatars: arr })} compact />
              </div>
            </div>
            <div className="flex gap-3 p-5 sm:p-6 border-t border-white/5">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#A9B1CC] text-sm font-semibold">Cancel</button>
              <button onClick={saveEdit} disabled={busy} data-testid="edit-save" className="flex-1 py-2.5 rounded-xl bg-[#6FA8FF] hover:bg-[#5B92F5] text-black text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
