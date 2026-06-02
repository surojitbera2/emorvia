import React, { useEffect, useState } from "react";
import { api } from "../../lib/store";
import { Input, Label } from "../../components/MobileShell";
import { inr, timeAgo } from "../../lib/format";
import { Check, X, Save, Plus } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SHARE = 60;

export default function AdminPayments() {
  const [settings, setSettings] = useState({ upi_id: "", qr_url: "" });
  const [billing, setBilling] = useState({ providerSharePct: DEFAULT_SHARE });
  const [whatsapp, setWhatsapp] = useState({ whatsappNumber: "" });
  const [upi, setUpi] = useState({ upiId: "", upiName: "EMORVIA", qrCodeUrl: "" });
  const [ext, setExt] = useState({ enabled: false, gatewayUrl: "", sharedSecret: "", label: "UPI / Net Banking / Card" });
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState({});
  const [uploadingQr, setUploadingQr] = useState(false);

  const refresh = async () => {
    try {
      const [s, b, w, u, e, q] = await Promise.all([
        api.getPaymentSettings(),
        api.adminGetBilling(),
        api.adminGetWhatsapp(),
        api.adminGetUpi(),
        api.adminGetExtPayment().catch(() => ({ enabled: false, gatewayUrl: "", sharedSecret: "", label: "UPI / Net Banking / Card" })),
        api.adminGetRecharges(),
      ]);
      setSettings(s);
      setBilling({ providerSharePct: Number(b?.providerSharePct ?? DEFAULT_SHARE) });
      setWhatsapp(w || { whatsappNumber: "" });
      setUpi(u || { upiId: "", upiName: "EMORVIA", qrCodeUrl: "" });
      setExt(e || { enabled: false, gatewayUrl: "", sharedSecret: "", label: "UPI / Net Banking / Card" });
      setRequests(q);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { refresh(); }, []);

  const savePaymentSettings = async () => {
    setBusy((b) => ({ ...b, upi: true }));
    try { await api.adminSavePayments(settings); toast.success("Payment settings saved"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, upi: false })); }
  };
  const saveBilling = async () => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(billing.providerSharePct) || 0)));
    setBusy((b) => ({ ...b, billing: true }));
    try {
      await api.adminSaveBilling({ providerSharePct: pct });
      toast.success(`Saved — Provider ${pct}% / Admin ${100 - pct}%`);
      await refresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, billing: false })); }
  };

  const saveWhatsapp = async () => {
    setBusy((b) => ({ ...b, whatsapp: true }));
    try { await api.adminSaveWhatsapp(whatsapp); toast.success("WhatsApp number saved"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, whatsapp: false })); }
  };

  const saveUpi = async () => {
    setBusy((b) => ({ ...b, upi: true }));
    try { await api.adminSaveUpi(upi); toast.success("UPI settings saved"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, upi: false })); }
  };

  const saveExt = async () => {
    if (ext.enabled && (!ext.gatewayUrl || !ext.sharedSecret)) {
      toast.error("Gateway URL and Shared Secret are required when enabled");
      return;
    }
    setBusy((b) => ({ ...b, ext: true }));
    try {
      await api.adminSaveExtPayment(ext);
      toast.success("External payment settings saved");
      await refresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy((b) => ({ ...b, ext: false })); }
  };

  const uploadQrCode = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }
    
    setUploadingQr(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const { urls } = await api.adminUpload(formData);
      if (urls && urls[0]) {
        setUpi({ ...upi, qrCodeUrl: urls[0] });
        toast.success("QR code uploaded successfully");
      }
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingQr(false);
    }
  };
  
  // const saveRzp = async () => { ... }; // REMOVED - Razorpay disabled
  const approve = async (id) => { try { await api.adminApproveRecharge(id); await refresh(); toast.success("Recharge approved"); } catch (e) { toast.error(e.message); } };
  const reject = async (id) => { try { await api.adminRejectRecharge(id); await refresh(); toast("Recharge rejected"); } catch (e) { toast.error(e.message); } };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Payments & Billing</h1>
        <p className="text-sm text-[#A9B1CC] mt-1">Configure payout split, per-minute call rates (per provider), and payment gateways.</p>
      </header>

      {/* Global Payout Split */}
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC]">Global payout split</h3>
            <p className="text-[11px] text-[#A9B1CC] mt-1 max-w-md">
              The % share of each call that goes to the listener. Admin keeps the rest. Individual listeners can be overridden in the Providers tab. Each listener sets their own ₹/min call rate from their profile (admin can also edit it).
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 items-end">
          <div>
            <Label>Provider share (%)</Label>
            <div className="flex items-center gap-3">
              <input
                data-testid="provider-share-slider"
                type="range"
                min={0}
                max={100}
                value={billing.providerSharePct}
                onChange={(e) => setBilling({ providerSharePct: Number(e.target.value) })}
                className="flex-1 accent-[#6FA8FF]"
              />
              <Input
                data-testid="provider-share-input"
                type="number"
                min={0}
                max={100}
                value={billing.providerSharePct}
                onChange={(e) => setBilling({ providerSharePct: e.target.value })}
                className="w-24"
              />
            </div>
            <p className="text-[10px] text-[#6E7694] mt-1">Default: 60% to listener, 40% to admin.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#3DDC97]/20 bg-[#3DDC97]/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#3DDC97] font-semibold">Provider</p>
              <p className="font-heading text-2xl font-bold mt-1 text-[#3DDC97] tabular-nums" data-testid="provider-share-display">
                {Math.max(0, Math.min(100, Number(billing.providerSharePct) || 0))}%
              </p>
            </div>
            <div className="rounded-xl border border-[#6FA8FF]/20 bg-[#6FA8FF]/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#6FA8FF] font-semibold">Admin</p>
              <p className="font-heading text-2xl font-bold mt-1 text-[#6FA8FF] tabular-nums" data-testid="admin-share-display">
                {100 - Math.max(0, Math.min(100, Number(billing.providerSharePct) || 0))}%
              </p>
            </div>
          </div>
        </div>

        <button data-testid="save-billing" disabled={busy.billing} onClick={saveBilling} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-[#101428] font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save payout split
        </button>
      </section>

      {/* WhatsApp Settings for Real Meet */}
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">WhatsApp for Real Meet</h3>
        <p className="text-[11px] text-[#A9B1CC] mb-4">Users clicking "Real Meet" will be redirected to this WhatsApp number.</p>
        <div className="max-w-md">
          <Label>WhatsApp Number (with country code)</Label>
          <Input 
            data-testid="whatsapp-number" 
            value={whatsapp.whatsappNumber} 
            onChange={(e) => setWhatsapp({ ...whatsapp, whatsappNumber: e.target.value.replace(/\D/g, "") })} 
            placeholder="919876543210 (no + or spaces)" 
          />
          <p className="text-[11px] text-[#6E7694] mt-1">Example: 919876543210 for +91 9876543210</p>
        </div>
        <button data-testid="save-whatsapp" disabled={busy.whatsapp} onClick={saveWhatsapp} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-white font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save WhatsApp
        </button>
      </section>

      {/* UPI Payment Settings */}
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">UPI Payment Settings</h3>
        <p className="text-[11px] text-[#A9B1CC] mb-4">Users will scan QR code or use UPI ID to pay. Upload your payment QR code and set UPI details.</p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: UPI Details */}
          <div className="space-y-4">
            <div>
              <Label>UPI ID</Label>
              <Input 
                data-testid="upi-id" 
                value={upi.upiId} 
                onChange={(e) => setUpi({ ...upi, upiId: e.target.value })} 
                placeholder="yourname@paytm, yourname@ybl, etc." 
              />
              <p className="text-[10px] text-[#6E7694] mt-1">Your UPI ID (e.g., 9876543210@paytm)</p>
            </div>
            <div>
              <Label>UPI Name</Label>
              <Input 
                data-testid="upi-name" 
                value={upi.upiName} 
                onChange={(e) => setUpi({ ...upi, upiName: e.target.value })} 
                placeholder="Your Name or Business Name" 
              />
              <p className="text-[10px] text-[#6E7694] mt-1">Name shown to users during payment</p>
            </div>
          </div>

          {/* Right: QR Code Upload */}
          <div>
            <Label>Payment QR Code</Label>
            <div className="mt-2">
              {upi.qrCodeUrl ? (
                <div className="relative inline-block">
                  <img 
                    src={upi.qrCodeUrl} 
                    alt="Payment QR Code" 
                    className="w-48 h-48 object-contain bg-white rounded-xl border-2 border-[#6FA8FF]/30"
                  />
                  <button
                    onClick={() => setUpi({ ...upi, qrCodeUrl: "" })}
                    className="absolute -top-2 -right-2 p-1.5 rounded-full bg-[#EF4444] text-white hover:bg-[#DC2626]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#6FA8FF]/50 transition-colors bg-white/[0.02]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadQrCode}
                    disabled={uploadingQr}
                    className="hidden"
                  />
                  {uploadingQr ? (
                    <p className="text-sm text-[#6FA8FF]">Uploading...</p>
                  ) : (
                    <>
                      <Plus className="w-8 h-8 text-[#A9B1CC] mb-2" />
                      <p className="text-xs text-[#A9B1CC]">Click to upload</p>
                      <p className="text-[10px] text-[#6E7694] mt-1">PNG, JPG (max 5MB)</p>
                    </>
                  )}
                </label>
              )}
            </div>
            <p className="text-[10px] text-[#6E7694] mt-2">Upload your UPI payment QR code image</p>
          </div>
        </div>

        <button data-testid="save-upi" disabled={busy.upi} onClick={saveUpi} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-white font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save UPI Settings
        </button>
        
        <div className="mt-4 p-4 bg-[#6FA8FF]/10 border border-[#6FA8FF]/20 rounded-xl">
          <p className="text-xs text-[#A9B1CC]">
            <strong className="text-[#6FA8FF]">How it works:</strong> Users see your QR code and UPI ID on the recharge page. They scan the QR code or use UPI ID to pay, then submit payment confirmation. You verify and approve from "Recharge Requests" below.
          </p>
        </div>
      </section>

      {/* Razorpay - REMOVED
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        ...
      </section>
      */}

      {/* External Payment Gateway (PHP: Cashfree / Razorpay) */}
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">UPI / Net Banking / Card (External Gateway)</h3>
        <p className="text-[11px] text-[#A9B1CC] mb-4">
          Redirects users to your external PHP-hosted payment page (e.g., <code className="text-[#6FA8FF]">https://yourdomain.com/payment</code>).
          On the PHP side you can configure Cashfree and/or Razorpay. Wallet credits automatically on successful payment via signed webhook.
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              data-testid="ext-enabled"
              type="checkbox"
              checked={!!ext.enabled}
              onChange={(e) => setExt({ ...ext, enabled: e.target.checked })}
              className="w-5 h-5 rounded accent-[#6FA8FF]"
            />
            <span className="text-sm text-white">Enable "UPI / Net Banking / Card" payment option for users</span>
          </label>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Display Label</Label>
              <Input
                data-testid="ext-label"
                value={ext.label || ""}
                onChange={(e) => setExt({ ...ext, label: e.target.value })}
                placeholder="UPI / Net Banking / Card"
              />
              <p className="text-[10px] text-[#6E7694] mt-1">Shown to users on the recharge page</p>
            </div>
            <div>
              <Label>PHP Gateway URL</Label>
              <Input
                data-testid="ext-url"
                value={ext.gatewayUrl || ""}
                onChange={(e) => setExt({ ...ext, gatewayUrl: e.target.value })}
                placeholder="https://yourdomain.com/payment"
              />
              <p className="text-[10px] text-[#6E7694] mt-1">User will be redirected to this URL with ?order_id=...</p>
            </div>
            <div className="md:col-span-2">
              <Label>Shared Secret (Webhook signing key)</Label>
              <Input
                data-testid="ext-secret"
                value={ext.sharedSecret || ""}
                onChange={(e) => setExt({ ...ext, sharedSecret: e.target.value })}
                placeholder="Long random string, e.g., openssl rand -hex 32"
              />
              <p className="text-[10px] text-[#6E7694] mt-1">
                Used by the PHP gateway to authenticate webhooks back to this server.
                Set the exact same value on the PHP admin → Node.js Settings page. Leave the masked value to keep current.
              </p>
            </div>
          </div>

          <button
            data-testid="save-ext-payment"
            disabled={busy.ext}
            onClick={saveExt}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-white font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Gateway Settings
          </button>
        </div>

        <div className="mt-4 p-4 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl">
          <p className="text-xs text-[#10B981] leading-relaxed">
            <strong>Setup tip:</strong> Deploy the bundled <code>/php-gateway</code> folder to your shared hosting under <code>/payment</code>, run <code>install.php</code> once, then log into the PHP admin to configure Cashfree / Razorpay keys and paste the same Shared Secret as above. After this, users will see two recharge options on the app.
          </p>
        </div>
      </section>

      {/* Manual UPI */}
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">Manual UPI fallback</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>UPI ID</Label>
            <Input data-testid="upi-id-input" value={settings.upi_id || ""} onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })} placeholder="yourbusiness@upi" />
          </div>
          <div>
            <Label>QR image URL</Label>
            <Input data-testid="upi-qr-input" value={settings.qr_url || ""} onChange={(e) => setSettings({ ...settings, qr_url: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <button data-testid="save-payment-settings" disabled={busy.upi} onClick={saveUpi} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-black font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50">
          <Save className="w-4 h-4" /> Save UPI
        </button>
        {settings.qr_url && <img src={settings.qr_url} alt="qr preview" className="mt-5 w-32 h-32 object-cover rounded-xl border border-white/10" />}
      </section>

      {/* Recharge requests */}
      <section>
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">Recharge requests</h3>
        <div className="bg-[#171C33] border border-white/5 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0B0F22] text-[#A9B1CC]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Ref</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#A9B1CC]">No requests yet.</td></tr>}
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white">{r.userName || "—"}</td>
                  <td className="px-4 py-3 text-[#6FA8FF] font-heading font-semibold">{inr(r.amount)}</td>
                  <td className="px-4 py-3 text-[#A9B1CC] text-xs">{(r.refNote || "").includes(":") ? r.refNote.split(":").slice(1).join(":").trim() : r.refNote}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" : r.status === "rejected" ? "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20" : "bg-[#6FA8FF]/10 text-[#6FA8FF] border border-[#6FA8FF]/20"}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#A9B1CC]">{timeAgo(new Date(r.at).getTime())}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" && (
                      <div className="inline-flex gap-2">
                        <button data-testid={`approve-${r.id}`} onClick={() => approve(r.id)} className="text-[#10B981] p-2 rounded-lg hover:bg-[#10B981]/10"><Check className="w-4 h-4" /></button>
                        <button data-testid={`reject-${r.id}`} onClick={() => reject(r.id)} className="text-[#EF4444] p-2 rounded-lg hover:bg-[#EF4444]/10"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
