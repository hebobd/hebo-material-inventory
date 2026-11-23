"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Settings = { company_name: string; company_email: string; company_phone: string; address: string; currency: string };
const defaults: Settings = { company_name: "HEBO", company_email: "", company_phone: "", address: "", currency: "BDT" };

export default function SettingsPanel() {
  const [form, setForm] = useState<Settings>(defaults);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessage("Please sign in."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
      const admin = profile?.role === "admin" && profile?.is_active === true;
      setIsAdmin(admin);
      const { data, error } = await supabase.from("company_settings").select("company_name,company_email,company_phone,address,currency").eq("id", 1).maybeSingle();
      if (error) setMessage(error.message);
      else if (data) setForm({
        company_name: data.company_name ?? defaults.company_name,
        company_email: data.company_email ?? "",
        company_phone: data.company_phone ?? "",
        address: data.address ?? "",
        currency: data.currency ?? defaults.currency,
      });
      setLoading(false);
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!isAdmin) return;
    setSaving(true); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("company_settings").upsert({ id: 1, ...form, updated_at: new Date().toISOString(), updated_by: user?.id }, { onConflict: "id" });
    setSaving(false); setMessage(error ? error.message : "Company settings saved.");
  }

  const field = "mt-1 w-full rounded-xl border border-[#E5E9E1] bg-[#FAFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#82947B]";
  if (loading) return <p className="text-sm text-[#92998E]">Loading settings…</p>;
  if (!isAdmin) return <div className="rounded-2xl border border-[#E9EAE3] bg-white p-5 text-sm text-[#92998E]">Settings are available to Admin users only.</div>;

  return <form onSubmit={save} className="max-w-2xl space-y-4 rounded-2xl border border-[#E9EAE3] bg-white p-5">
    <div><h2 className="font-semibold">Company Settings</h2><p className="mt-1 text-xs text-[#92998E]">Manage HEBO business information and default currency.</p></div>
    <label className="block text-xs font-medium">Company name<input className={field} required value={form.company_name ?? ""} onChange={e => setForm({ ...form, company_name: e.target.value })} /></label>
    <label className="block text-xs font-medium">Company email<input type="email" className={field} value={form.company_email ?? ""} onChange={e => setForm({ ...form, company_email: e.target.value })} /></label>
    <label className="block text-xs font-medium">Company phone<input className={field} value={form.company_phone ?? ""} onChange={e => setForm({ ...form, company_phone: e.target.value })} /></label>
    <label className="block text-xs font-medium">Address<textarea rows={2} className={field} value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
    <label className="block text-xs font-medium">Currency<select className={field} value={form.currency ?? "BDT"} onChange={e => setForm({ ...form, currency: e.target.value })}><option value="BDT">BDT — Bangladeshi Taka</option><option value="USD">USD — US Dollar</option></select></label>
    <button disabled={saving} className="rounded-xl bg-[#314B37] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Settings"}</button>
    {message && <p role="status" className="text-sm text-[#536D53]">{message}</p>}
  </form>;
}
