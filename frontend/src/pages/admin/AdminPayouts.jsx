import React, { useEffect, useMemo, useState } from "react";
import { Download, Calendar, Search, ChevronDown, ChevronUp, IndianRupee, Phone, Users, Clock, CheckCircle2, History, X, Trash2, AlertCircle } from "lucide-react";
import { api } from "../../lib/store";
import { Input } from "../../components/MobileShell";
import { inr, formatDuration } from "../../lib/format";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const presets = [
  { label: "Today", from: todayISO(), to: todayISO() },
  { label: "Last 7d", from: daysAgoISO(7), to: todayISO() },
  { label: "Last 30d", from: daysAgoISO(30), to: todayISO() },
  { label: "Last 90d", from: daysAgoISO(90), to: todayISO() },
];

export default function AdminPayouts() {
  const [providers, setProviders] = useState([]);
  const [data, setData] = useState({ summary: [], rows: [], totals: null });
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [providerId, setProviderId] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [expanded, setExpanded] = useState({}); // {providerId: bool}
  const [loading, setLoading] = useState(false);
  const [token] = useState(() => localStorage.getItem("emorvia_token") || "");
  const [payoutDlg, setPayoutDlg] = useState(null);  // { providerId, providerName, amount, note }
  const [historyDlg, setHistoryDlg] = useState(null); // { providerName, list }

  useEffect(() => { (async () => {
    try { setProviders(await api.adminGetProviders()); } catch (e) { toast.error(e.message); }
  })(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = new Date(from).toISOString();
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); params.to = t.toISOString(); }
      if (providerId) params.providerId = providerId;
      const d = await api.adminGetPayouts(params);
      setData(d); setExpanded({});
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to, providerId]); // eslint-disable-line

  // Download CSV via authed fetch (avoids leaking token in URL)
  const downloadCsv = async () => {
    try {
      const params = { from: new Date(from).toISOString() };
      const t = new Date(to); t.setHours(23, 59, 59, 999);
      params.to = t.toISOString();
      if (providerId) params.providerId = providerId;
      const url = api.adminPayoutsCsvUrl(params);
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`Download failed (${r.status})`);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `emorvia-payouts-${from}-to-${to}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast.error(e.message); }
  };

  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers;
    const q = providerSearch.toLowerCase();
    return providers.filter((p) => p.name?.toLowerCase().includes(q) || (p.mobile || "").includes(providerSearch));
  }, [providers, providerSearch]);

  const groupRows = (pid) => data.rows.filter((r) => data.summary.find((s) => s.providerId === pid)?.providerName === r.providerName);

  const openPayout = (g) => setPayoutDlg({
    providerId: g.providerId,
    providerName: g.providerName,
    amount: g.pendingBalance > 0 ? g.pendingBalance.toFixed(2) : g.payout.toFixed(2),
    note: "",
  });
  const submitPayout = async () => {
    if (!payoutDlg) return;
    const amount = Number(payoutDlg.amount);
    if (!(amount > 0)) return toast.error("Enter a positive amount");
    try {
      await api.adminMarkPayoutDone({
        providerId: payoutDlg.providerId,
        amount,
        note: payoutDlg.note,
        fromDate: from ? new Date(from).toISOString() : undefined,
        toDate: to ? new Date(to).toISOString() : undefined,
      });
      toast.success(`Marked ₹${amount.toFixed(2)} paid to ${payoutDlg.providerName}`);
      setPayoutDlg(null);
      await load();
    } catch (e) { toast.error(e.message); }
  };
  const openHistory = async (g) => {
    try {
      const list = await api.adminPayoutHistory(g.providerId);
      setHistoryDlg({ providerId: g.providerId, providerName: g.providerName, isDeleted: !!g.isDeleted, list });
    } catch (e) { toast.error(e.message); }
  };

  const clearProviderPayouts = async (providerId, providerName) => {
    if (!window.confirm(`Clear ALL payout history and call logs for "${providerName}"? This cannot be undone.`)) return;
    try {
      const r = await api.adminClearProviderPayouts(providerId);
      toast.success(`Cleared ${r.payoutsDeleted} payout(s) and ${r.callLogsDeleted} call log(s)`);
      setHistoryDlg(null);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Provider Payouts</h1>
          <p className="text-sm text-[#A9B1CC] mt-1">Per-provider, per-call earnings — net of admin commission.</p>
        </div>
        <button
          onClick={downloadCsv}
          data-testid="payouts-csv"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6FA8FF] hover:bg-[#5B92F5] text-black font-semibold text-sm transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </header>

      {/* Filters */}
      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694] pointer-events-none" />
              <Input type="date" data-testid="payouts-from" value={from} onChange={(e) => setFrom(e.target.value)} className="!pl-10" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694] pointer-events-none" />
              <Input type="date" data-testid="payouts-to" value={to} onChange={(e) => setTo(e.target.value)} className="!pl-10" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Provider</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7694] pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by name or mobile"
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                className="!pl-10"
                data-testid="payouts-search"
              />
            </div>
            {providerSearch && (
              <div className="mt-1.5 bg-[#101428] border border-white/10 rounded-lg max-h-44 overflow-y-auto">
                <button onClick={() => { setProviderId(""); setProviderSearch(""); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-[#A9B1CC]">All providers</button>
                {filteredProviders.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setProviderId(p.id); setProviderSearch(p.name); }}
                    data-testid={`payouts-pick-${p.id}`}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between"
                  >
                    <span className="text-white">{p.name}</span>
                    <span className="text-[#6E7694]">+91 {p.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setFrom(p.from); setTo(p.to); }}
              data-testid={`payouts-preset-${p.label.replace(/\s/g, "")}`}
              className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 text-[#A9B1CC] hover:text-white hover:border-[#6FA8FF]/40 transition-colors"
            >
              {p.label}
            </button>
          ))}
          {providerId && (
            <button
              onClick={() => { setProviderId(""); setProviderSearch(""); }}
              className="text-[11px] px-3 py-1.5 rounded-full bg-[#6FA8FF]/10 text-[#6FA8FF] border border-[#6FA8FF]/30"
            >
              × Clear provider filter
            </button>
          )}
        </div>
      </section>

      {/* Totals */}
      {data.totals && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi label="Provider payout" value={inr(data.totals.payout)} icon={IndianRupee} accent />
          <Kpi label="Admin share" value={inr(data.totals.adminShare)} icon={IndianRupee} />
          <Kpi label="Calls" value={data.totals.calls} icon={Phone} />
          <Kpi label="Total duration" value={formatDuration(data.totals.durationSec)} icon={Clock} />
        </section>
      )}

      {/* Per-provider summary with expandable per-call rows */}
      <section>
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> By provider
        </h3>
        <div className="bg-[#171C33] border border-white/5 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-[#0B0F22] text-[#A9B1CC]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-right font-medium">Calls</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-[#10B981]">Period payout</th>
                <th className="px-4 py-3 text-right font-medium text-[#6FA8FF]">Pending balance</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#A9B1CC]">Loading…</td></tr>}
              {!loading && data.summary.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#A9B1CC]">No payouts in this range.</td></tr>
              )}
              {!loading && data.summary.map((g) => (
                <React.Fragment key={g.providerId}>
                  <tr className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{g.providerName}</p>
                        {g.isDeleted && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 font-semibold">
                            <AlertCircle className="w-3 h-3" /> DELETED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#A9B1CC]">{g.providerMobile ? `+91 ${g.providerMobile}` : "Provider no longer exists"}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{g.calls}</td>
                    <td className="px-4 py-3 text-right text-[#A9B1CC] tabular-nums">{formatDuration(g.durationSec)}</td>
                    <td className="px-4 py-3 text-right text-[#A9B1CC] tabular-nums">{inr(g.gross)}</td>
                    <td className="px-4 py-3 text-right font-heading font-semibold text-[#10B981] tabular-nums">{inr(g.payout)}</td>
                    <td className="px-4 py-3 text-right">
                      <p className={`font-heading font-bold tabular-nums ${g.pendingBalance > 0 ? "text-[#6FA8FF]" : "text-[#6E7694]"}`}>{inr(g.pendingBalance || 0)}</p>
                      <p className="text-[10px] text-[#6E7694]">unpaid balance</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!g.isDeleted && (
                          <button
                            data-testid={`payout-done-${g.providerId}`}
                            onClick={() => openPayout(g)}
                            disabled={g.pendingBalance <= 0 && g.payout <= 0}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mark payout done"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Payout done
                          </button>
                        )}
                        {g.isDeleted && (
                          <button
                            data-testid={`clear-payouts-${g.providerId}`}
                            onClick={() => clearProviderPayouts(g.providerId, g.providerName)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/20"
                            title="Clear all payout history & call logs for this deleted provider"
                          >
                            <Trash2 className="w-3 h-3" /> Clear logs
                          </button>
                        )}
                        <button
                          data-testid={`payout-history-${g.providerId}`}
                          onClick={() => openHistory(g)}
                          className="p-1.5 rounded-md text-[#A9B1CC] hover:text-white hover:bg-white/5"
                          title="Payout history"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          data-testid={`payouts-expand-${g.providerId}`}
                          onClick={() => setExpanded((e) => ({ ...e, [g.providerId]: !e[g.providerId] }))}
                          className="text-[11px] inline-flex items-center gap-1 text-[#6FA8FF] hover:underline"
                        >
                          {expanded[g.providerId] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded[g.providerId] && (
                    <tr className="bg-[#0B0F22]/50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs min-w-[760px]">
                            <thead className="text-[#6E7694]">
                              <tr>
                                <th className="px-2 py-2 text-left font-medium">When</th>
                                <th className="px-2 py-2 text-left font-medium">User</th>
                                <th className="px-2 py-2 text-right font-medium">Duration</th>
                                <th className="px-2 py-2 text-right font-medium">Gross</th>
                                <th className="px-2 py-2 text-right font-medium">Bonus</th>
                                <th className="px-2 py-2 text-right font-medium">Real</th>
                                <th className="px-2 py-2 text-right font-medium">Share %</th>
                                <th className="px-2 py-2 text-right font-medium text-[#10B981]">Payout</th>
                                <th className="px-2 py-2 text-right font-medium">Admin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupRows(g.providerId).map((r) => (
                                <tr key={r.id} className="border-t border-white/5">
                                  <td className="px-2 py-2 text-[#A9B1CC] whitespace-nowrap">{new Date(r.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                                  <td className="px-2 py-2 text-white">{r.userName}<br /><span className="text-[10px] text-[#6E7694]">+91 {r.userMobile}</span></td>
                                  <td className="px-2 py-2 text-right tabular-nums text-[#A9B1CC]">{formatDuration(r.durationSec)}{r.autoCutoff && <span className="ml-1 text-[10px] text-[#6FA8FF]">·auto</span>}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.gross)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums text-[#A9B1CC]">{r.bonusUsed > 0 ? inr(r.bonusUsed) : "—"}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.realUsed)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums text-[#A9B1CC]">{r.sharePct}%</td>
                                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-[#10B981]">{inr(r.payout)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums text-[#A9B1CC]">{inr(r.adminShare)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payout Done dialog */}
      {payoutDlg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="payout-dlg">
          <div className="w-full max-w-md bg-[#0F141C] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#10B981] font-semibold">Mark payout done</p>
                <h3 className="font-heading text-xl font-bold mt-1">{payoutDlg.providerName}</h3>
              </div>
              <button onClick={() => setPayoutDlg(null)} className="p-1.5 -mr-2 -mt-1 rounded-lg hover:bg-white/5 text-[#A9B1CC]"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Amount paid (₹)</label>
                <Input data-testid="payout-amount" type="number" step="0.01" value={payoutDlg.amount} onChange={(e) => setPayoutDlg({ ...payoutDlg, amount: e.target.value })} />
                <p className="text-[10px] text-[#6E7694] mt-1">Confirms what you've already transferred to the provider's bank/UPI.</p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Note (UTR / bank ref — optional)</label>
                <Input data-testid="payout-note" type="text" placeholder="e.g., UTR123456789 · IDFC" value={payoutDlg.note} onChange={(e) => setPayoutDlg({ ...payoutDlg, note: e.target.value })} />
              </div>
              <div className="p-3 rounded-xl bg-[#6FA8FF]/5 border border-[#6FA8FF]/20">
                <p className="text-[11px] text-[#6FA8FF] font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> After confirming
                </p>
                <p className="text-[11px] text-[#A9B1CC] mt-1">Provider's unpaid balance will reset to ₹0. This is recorded in payout history.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setPayoutDlg(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#A9B1CC] text-sm font-semibold">Cancel</button>
                <button onClick={submitPayout} data-testid="payout-confirm" className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#0EA371] text-black text-sm font-bold">
                  Confirm payout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout history dialog */}
      {historyDlg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="history-dlg">
          <div className="w-full max-w-lg bg-[#0F141C] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6FA8FF] font-semibold">Payout history</p>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="font-heading text-xl font-bold">{historyDlg.providerName}</h3>
                  {historyDlg.isDeleted && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 font-semibold">
                      <AlertCircle className="w-3 h-3" /> DELETED
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setHistoryDlg(null)} className="p-1.5 -mr-2 -mt-1 rounded-lg hover:bg-white/5 text-[#A9B1CC]"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto -mx-2 px-2 flex-1">
              {historyDlg.list.length === 0 ? (
                <p className="text-sm text-[#A9B1CC] py-8 text-center">No payouts recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyDlg.list.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-[#171C33] border border-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-heading font-bold text-[#10B981] tabular-nums">{inr(p.amount)}</p>
                          <p className="text-[11px] text-[#A9B1CC] mt-0.5">{new Date(p.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                      </div>
                      {p.note && <p className="text-[11px] text-[#A9B1CC] mt-2 italic">Note: {p.note}</p>}
                      {(p.fromDate || p.toDate) && (
                        <p className="text-[10px] text-[#6E7694] mt-1">
                          Period: {p.fromDate ? new Date(p.fromDate).toLocaleDateString("en-IN") : "—"} → {p.toDate ? new Date(p.toDate).toLocaleDateString("en-IN") : "—"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {historyDlg.isDeleted && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="p-3 rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/20 mb-3">
                  <p className="text-[11px] text-[#EF4444] font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Provider deleted
                  </p>
                  <p className="text-[11px] text-[#A9B1CC] mt-1">This provider has been removed. You can clear all their payout history and call logs.</p>
                </div>
                <button
                  data-testid="history-clear-payouts"
                  onClick={() => clearProviderPayouts(historyDlg.providerId, historyDlg.providerName)}
                  className="w-full py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Clear all payouts & call logs
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Kpi = ({ label, value, icon: Icon, accent = false }) => (
  <div className="bg-[#171C33] border border-white/5 rounded-2xl p-4 sm:p-5">
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC] font-semibold">{label}</p>
      <Icon className={`w-4 h-4 ${accent ? "text-[#6FA8FF]" : "text-[#6E7694]"}`} />
    </div>
    <p className={`font-heading font-bold text-xl sm:text-2xl mt-2 tracking-tight ${accent ? "text-[#6FA8FF]" : "text-white"}`}>{value}</p>
  </div>
);
