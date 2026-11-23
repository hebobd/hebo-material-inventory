"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type Employee = {
  id: string;
  full_name: string | null;
  email: string;
  role: "admin" | "manager" | "staff";
  phone: string | null;
  is_active: boolean;
  created_at: string;
};

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "staff" });

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/employees", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to load employees.");
    else setEmployees(data.employees || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  async function createEmployee(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setError(data.error || "Unable to create employee."); return; }
    setForm({ full_name: "", email: "", phone: "", password: "", role: "staff" });
    setShowForm(false);
    await loadEmployees();
  }

  async function updateEmployee(employee: Employee, patch: { is_active?: boolean; role?: string }) {
    const response = await fetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: employee.id, ...patch }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to update employee.");
    else await loadEmployees();
  }

  const field = "w-full rounded-xl border border-[#E5E9E1] bg-[#FAFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#82947B]";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Employee Management</h2><p className="mt-1 text-xs text-[#92998E]">Create accounts and manage employee access.</p></div>
        <button onClick={() => setShowForm(v => !v)} className="rounded-xl bg-[#314B37] px-4 py-3 text-xs font-semibold text-white">{showForm ? "Close" : "+ Add Employee"}</button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && <form onSubmit={createEmployee} className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E9EAE3] bg-white p-5 md:grid-cols-2">
        <label className="text-xs font-medium">Full name<input required className={`${field} mt-1`} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label>
        <label className="text-xs font-medium">Email<input required type="email" className={`${field} mt-1`} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-xs font-medium">Phone (optional)<input className={`${field} mt-1`} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="text-xs font-medium">Temporary password (min. 10 characters)<input required minLength={10} type="password" autoComplete="new-password" className={`${field} mt-1`} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        <label className="text-xs font-medium">Role<select className={`${field} mt-1`} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
        <div className="flex items-end"><button disabled={saving} className="w-full rounded-xl bg-[#314B37] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Create Employee Account"}</button></div>
        <p className="text-xs text-[#92998E] md:col-span-2">New accounts are email-confirmed by the Admin-created workflow. Give the temporary password to the employee securely and ask them to change it after first login.</p>
      </form>}

      <div className="overflow-hidden rounded-2xl border border-[#E9EAE3] bg-white">
        {loading ? <p className="p-6 text-sm text-[#92998E]">Loading employees…</p> : employees.length === 0 ? <p className="p-6 text-sm text-[#92998E]">No employee accounts found.</p> : <div className="divide-y divide-[#F0F1EC]">
          {employees.map(employee => <div key={employee.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{employee.full_name || "Unnamed user"}</p><p className="mt-1 truncate text-xs text-[#92998E]">{employee.email} · {employee.phone || "No phone"} · {employee.role.toUpperCase()}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label={`Role for ${employee.full_name}`} value={employee.role} onChange={e => void updateEmployee(employee, { role: e.target.value })} className="rounded-lg border border-[#E5E9E1] bg-white px-2 py-2 text-xs" disabled={employee.role === "admin"}>
                <option value="admin">Admin</option><option value="manager">Manager</option><option value="staff">Staff</option>
              </select>
              <span className={`rounded-lg px-2.5 py-2 text-[10px] font-semibold ${employee.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{employee.is_active ? "Active" : "Inactive"}</span>
              <button onClick={() => void updateEmployee(employee, { is_active: !employee.is_active })} className="rounded-lg border border-[#E5E9E1] px-3 py-2 text-xs font-semibold">{employee.is_active ? "Deactivate" : "Activate"}</button>
            </div>
          </div>)}
        </div>}
      </div>
    </section>
  );
}
