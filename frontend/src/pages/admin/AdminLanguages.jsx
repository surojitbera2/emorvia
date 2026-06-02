import React, { useEffect, useState } from "react";
import { Plus, Trash2, Languages as LangIcon, X } from "lucide-react";
import { api } from "../../lib/store";
import { Input } from "../../components/MobileShell";
import { toast } from "sonner";

export default function AdminLanguages() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setList(await api.adminGetLanguages()); }
    catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const v = name.trim();
    if (!v) return toast.error("Enter a language name");
    setBusy(true);
    try {
      const next = await api.adminAddLanguage(v);
      setList(next); setName("");
      toast.success(`Added ${v}`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (lang) => {
    if (!window.confirm(`Delete "${lang}"? It will also be removed from all provider profiles.`)) return;
    try {
      const next = await api.adminDeleteLanguage(lang);
      setList(next);
      toast(`Removed ${lang}`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Languages</h1>
        <p className="text-sm text-[#A9B1CC] mt-1">Manage the master list of languages providers can pick from.</p>
      </header>

      <section className="bg-[#171C33] border border-white/5 rounded-2xl p-5">
        <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] mb-4">Add language</h3>
        <div className="flex gap-3">
          <Input
            data-testid="lang-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="e.g., Odia"
            maxLength={40}
          />
          <button
            data-testid="lang-add"
            onClick={add}
            disabled={busy || !name.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#6FA8FF] hover:bg-[#5B92F5] text-black font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#A9B1CC] flex items-center gap-2">
            <LangIcon className="w-3.5 h-3.5" /> Active list
          </h3>
          <span className="text-[11px] text-[#6E7694]">{list.length} language{list.length !== 1 && "s"}</span>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-[#A9B1CC] p-6 bg-[#171C33] border border-white/5 rounded-xl text-center">No languages yet. Add one above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((lang) => (
              <div
                key={lang}
                className="group inline-flex items-center gap-2 bg-[#171C33] border border-white/10 rounded-full pl-4 pr-2 py-1.5"
              >
                <span className="text-sm text-white font-medium">{lang}</span>
                <button
                  data-testid={`lang-remove-${lang}`}
                  onClick={() => remove(lang)}
                  className="w-6 h-6 rounded-full bg-white/5 hover:bg-[#EF4444]/20 text-[#A9B1CC] hover:text-[#EF4444] flex items-center justify-center transition-all"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
