"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function ProfileSettings() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email || "");
      const { data } = await supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle();
      setFullName(data?.full_name || String(user.user_metadata?.full_name || ""));
      setPhone(data?.phone || "");
    })();
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() }).eq("id", userId);
    setBusy(false); setMessage(error ? error.message : "Profile updated successfully.");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message); else { setPassword(""); setMessage("Password changed successfully."); }
  }

  const field = "mt-1 w-full rounded-xl border border-[#E5E9E1] bg-[#FAFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#82947B]";
  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
    <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-[#E9EAE3] bg-white p-5">
      <div><h2 className="font-semibold">My Profile</h2><p className="mt-1 text-xs text-[#92998E]">Update your personal information.</p></div>
      <label className="block text-xs font-medium">Email (managed by authentication)<input disabled value={email} className={`${field} opacity-60`} /></label>
      <label className="block text-xs font-medium">Full name<input required value={fullName} onChange={e => setFullName(e.target.value)} className={field} /></label>
      <label className="block text-xs font-medium">Phone<input value={phone} onChange={e => setPhone(e.target.value)} className={field} /></label>
      <button disabled={busy} className="rounded-xl bg-[#314B37] px-4 py-3 text-xs font-semibold text-white">Save Profile</button>
    </form>
    <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-[#E9EAE3] bg-white p-5">
      <div><h2 className="font-semibold">Change Password</h2><p className="mt-1 text-xs text-[#92998E]">Choose a strong password you have not used elsewhere.</p></div>
      <label className="block text-xs font-medium">New password<input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={field} /></label>
      <button disabled={busy || password.length < 10} className="rounded-xl bg-[#314B37] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">Update Password</button>
    </form>
    {message && <p role="status" className="rounded-xl bg-[#EDF1E9] p-3 text-sm text-[#314B37] xl:col-span-2">{message}</p>}
  </div>;
}
