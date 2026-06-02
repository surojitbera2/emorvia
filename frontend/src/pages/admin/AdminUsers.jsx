import React, { useEffect, useState } from "react";
import { api } from "../../lib/store";
import { Input } from "../../components/MobileShell";
import { Plus, Trash2, Edit, X, Save, Lock, User as UserIcon } from "lucide-react";
import { inr } from "../../lib/format";
import { toast } from "sonner";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", mobile: "", password: "", wallet: 0 });
  const [adj, setAdj] = useState({});
  const [busy, setBusy] = useState(false);
  const [editDlg, setEditDlg] = useState(null); // { id, name, mobile, password }
  const [editBusy, setEditBusy] = useState(false);

  const refresh = async () => {
    try { setUsers(await api.adminGetUsers()); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!form.name || form.mobile.length !== 10) return toast.error("Name + 10-digit mobile required");
    setBusy(true);
    try {
      await api.adminAddUser({ ...form, wallet: Number(form.wallet) || 0 });
      setForm({ name: "", mobile: "", password: "", wallet: 0 });
      await refresh();
      toast.success("User added");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try { await api.adminDeleteUser(id); await refresh(); toast("User removed"); } catch (e) { toast.error(e.message); }
  };
  const adjust = async (id, delta) => {
    const d = Number(delta);
    if (!d) return;
    try { await api.adminAdjustUser(id, d, "Admin adjustment"); setAdj({ ...adj, [id]: "" }); await refresh(); toast.success("Wallet adjusted"); }
    catch (e) { toast.error(e.message); }
  };

  const openEdit = (u) => setEditDlg({ id: u.id, name: u.name || "", mobile: u.mobile || "", password: "" });
  const saveEdit = async () => {
    if (!editDlg) return;
    const patch = {};
    if (editDlg.name && editDlg.name.trim()) patch.name = editDlg.name.trim();
    if (editDlg.mobile && editDlg.mobile.trim()) patch.mobile = editDlg.mobile.trim();
    if (editDlg.password) {
      if (editDlg.password.length < 6) return toast.error("Password must be at least 6 characters");
      patch.password = editDlg.password;
    }
    if (Object.keys(patch).length === 0) return toast.error("Change at least one field");
    setEditBusy(true);
    try {
      await api.adminUpdateUser(editDlg.id, patch);
      toast.success("User updated");
      setEditDlg(null);
      await refresh();
    } catch (e) { toast.error(e.message); } finally { setEditBusy(false); }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-[#A9B1CC] mt-1">Manage app users and wallet balances.</p>
      </header>

      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-4 sm:p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">Add user</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input data-testid="add-user-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input data-testid="add-user-mobile" placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input data-testid="add-user-password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input data-testid="add-user-wallet" placeholder="Wallet" type="number" value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} />
        </div>
        <button data-testid="add-user-btn" disabled={busy} onClick={add} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#6FA8FF] text-white font-semibold rounded-xl hover:bg-[#5B92F5] disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add
        </button>
      </section>

      <section className="bg-[#171C33] border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-[#0B0F22] text-[#A9B1CC]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Mobile</th>
              <th className="px-4 py-3 text-left font-medium">Wallet</th>
              <th className="px-4 py-3 text-left font-medium">Adjust (₹)</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{u.name}</td>
                <td className="px-4 py-3 text-[#A9B1CC]">+91 {u.mobile}</td>
                <td className="px-4 py-3 text-[#6FA8FF] font-heading font-semibold">{inr(u.wallet)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Input data-testid={`adj-${u.id}`} placeholder="±amount" value={adj[u.id] || ""} onChange={(e) => setAdj({ ...adj, [u.id]: e.target.value })} className="!py-2 max-w-[120px]" />
                    <button data-testid={`adj-apply-${u.id}`} onClick={() => adjust(u.id, adj[u.id])} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white">Apply</button>
                  </div>
                  <p className="text-[10px] text-[#6E7694] mt-1">Use + or - prefix (e.g. -50)</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      data-testid={`edit-user-${u.id}`}
                      onClick={() => openEdit(u)}
                      className="text-[#6FA8FF] p-2 rounded-lg hover:bg-[#6FA8FF]/10"
                      title="Edit user"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`del-user-${u.id}`}
                      onClick={() => remove(u.id)}
                      className="text-[#EF4444] p-2 rounded-lg hover:bg-[#EF4444]/10"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#A9B1CC]">No users yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* Edit User dialog */}
      {editDlg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="edit-user-dlg">
          <div className="w-full max-w-md bg-[#0F141C] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6FA8FF] font-semibold">Edit user</p>
                <h3 className="font-heading text-xl font-bold mt-1">Update profile</h3>
              </div>
              <button onClick={() => setEditDlg(null)} className="p-1.5 -mr-2 -mt-1 rounded-lg hover:bg-white/5 text-[#A9B1CC]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block flex items-center gap-1.5">
                  <UserIcon className="w-3 h-3" /> Name
                </label>
                <Input
                  data-testid="edit-user-name"
                  value={editDlg.name}
                  onChange={(e) => setEditDlg({ ...editDlg, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block">Mobile</label>
                <Input
                  data-testid="edit-user-mobile"
                  value={editDlg.mobile}
                  onChange={(e) => setEditDlg({ ...editDlg, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="10-digit mobile"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#A9B1CC] font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> New Password (optional)
                </label>
                <Input
                  data-testid="edit-user-password"
                  type="text"
                  value={editDlg.password}
                  onChange={(e) => setEditDlg({ ...editDlg, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                />
                <p className="text-[10px] text-[#6E7694] mt-1">Min 6 characters. Only filled if you want to reset it.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditDlg(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#A9B1CC] text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  data-testid="edit-user-save"
                  onClick={saveEdit}
                  disabled={editBusy}
                  className="flex-1 py-2.5 rounded-xl bg-[#6FA8FF] hover:bg-[#5B92F5] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
