import React, { useEffect, useState } from "react";
import { api } from "../../lib/store";
import { inr, formatDuration, timeAgo } from "../../lib/format";
import { TrendingUp, Users, Phone, Wallet } from "lucide-react";

export default function AdminReports() {
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [u, p, l] = await Promise.all([api.adminGetUsers(), api.adminGetProviders(), api.adminGetCalls()]);
        setUsers(u); setProviders(p); setLogs(l);
      } catch {}
    })();
  }, []);

  // Total revenue = real money spent (bonus credit is house money, not revenue)
  const totalRevenue = logs.reduce((s, l) => s + (l.realUsed != null ? l.realUsed : l.amount), 0);
  const onlineProviders = providers.filter((p) => p.online).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-[#A9B1CC] mt-1">Live platform metrics.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total revenue" value={inr(totalRevenue)} accent icon={TrendingUp} />
        <Kpi label="Total calls" value={logs.length} icon={Phone} />
        <Kpi label="Users" value={users.length} icon={Users} />
        <Kpi label="Online providers" value={`${onlineProviders}/${providers.length}`} icon={Wallet} />
      </div>

      <section>
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-3">Recent calls</h3>
        <div className="bg-[#171C33] border border-white/5 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-[#0B0F22] text-[#A9B1CC]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#A9B1CC]">No calls recorded yet.</td></tr>}
              {logs.slice(0, 20).map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white">{l.userName || "—"}</td>
                  <td className="px-4 py-3 text-white">{l.providerName || "—"}</td>
                  <td className="px-4 py-3 text-[#A9B1CC]">{formatDuration(l.durationSec)}</td>
                  <td className="px-4 py-3 text-[#6FA8FF] font-heading font-semibold">{inr(l.amount)}</td>
                  <td className="px-4 py-3 text-[#A9B1CC]">{timeAgo(new Date(l.at).getTime())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const Kpi = ({ label, value, accent, icon: Icon }) => (
  <div className="relative overflow-hidden bg-[#171C33] border border-white/5 rounded-2xl p-5">
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wider text-[#A9B1CC]">{label}</p>
      <Icon className="w-4 h-4 text-[#A9B1CC]" />
    </div>
    <p className={`font-heading font-bold text-2xl sm:text-3xl mt-2 tracking-tight ${accent ? "text-[#6FA8FF]" : "text-white"}`}>{value}</p>
  </div>
);
