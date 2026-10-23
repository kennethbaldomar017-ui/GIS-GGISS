"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  UserPlus,
  Key,
  Trash2,
  Edit2,
  X,
  Check,
  X as CrossIcon,
  Lock,
  Unlock
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import PasswordConfirmModal from "@/components/admin/PasswordConfirmModal";

type GateAction = "create" | "edit" | "reset" | "lock" | "unlock" | "delete";

function isInvalidPassword(err: any): boolean {
  return err?.response?.status === 403 && err?.response?.data?.detail === "INVALID_PASSWORD";
}

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && user.role !== "super_admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Step-up password gate: every sensitive action must pass this first.
  const [gate, setGate] = useState<{ action: GateAction; user?: any } | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [authorizedPw, setAuthorizedPw] = useState("");

  // Inline validation errors for the add / edit forms.
  const [addError, setAddError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "Admin@123",
    role: "admin",
    barangay_id: "",
  });

  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "admin",
    barangay_id: "",
  });

  const q = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
  });

  const barangays = useQuery({
    queryKey: ["users-barangays"],
    queryFn: () => api.get("/api/barangays").then((r) => r.data),
  });

  const stats = useMemo(() => {
    const list = q.data || [];
    return { total: list.length, admins: list.filter((u: any) => u.role === "admin" && u.is_active).length, superAdmins: list.filter((u: any) => u.role === "super_admin").length, locked: list.filter((u: any) => u.account_status === "locked").length };
  }, [q.data]);

  // Barangays already occupied by an active admin — one admin per barangay.
  const adminBarangayIds = useMemo(() => {
    const taken = new Set<string>();
    (q.data || []).forEach((u: any) => {
      if (u.role === "admin" && u.is_active && u.barangay_id) taken.add(String(u.barangay_id));
    });
    return taken;
  }, [q.data]);

  // Only one active Super Admin is allowed.
  const activeSuperIds = useMemo(() => {
    const ids = new Set<string>();
    (q.data || []).forEach((u: any) => {
      if (u.role === "super_admin" && u.is_active) ids.add(String(u.id));
    });
    return ids;
  }, [q.data]);

  const addSuperBlocked = activeSuperIds.size > 0;
  const editSuperBlocked = Array.from(activeSuperIds).some((id) => id !== String(selectedUser?.id));

  // Filtered users
  const filteredUsers = useMemo(() => {
    let list = q.data || [];
    if (search) {
      const query = search.toLowerCase();
      list = list.filter((u: any) => u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.role.toLowerCase().includes(query));
    }
    return list;
  }, [q.data, search]);

  // Create User
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/users", {
        ...form,
        barangay_id: form.role === "admin" && form.barangay_id ? form.barangay_id : undefined,
        current_password: authorizedPw,
      });
      setForm({ username: "", email: "", password: "Admin@123", role: "admin", barangay_id: "" });
      setShowAddForm(false);
      setAuthorizedPw("");
      q.refetch();
      alert("User account created successfully!");
    } catch (err: any) {
      console.error(err);
      if (isInvalidPassword(err)) {
        setShowAddForm(false);
        setGate({ action: "create" });
        setGateError("Incorrect password. Please try again.");
      } else if (err?.response?.status === 409) {
        const detail = err?.response?.data?.detail;
        if (detail === "SUPER_ADMIN_EXISTS") {
          setAddError("A Super Admin account already exists. Only one Super Admin is allowed.");
          setForm((f) => ({ ...f, role: "admin", barangay_id: f.barangay_id }));
        } else {
          setAddError("This barangay already has an active admin. Pick a different barangay, or deactivate the existing admin first.");
          setForm((f) => ({ ...f, barangay_id: "" }));
        }
      } else {
        alert("Error creating user.");
      }
    }
  }

  // Update User
  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.put(`/api/users/${selectedUser.id}`, {
        ...editForm,
        barangay_id: editForm.role === "admin" && editForm.barangay_id ? editForm.barangay_id : undefined,
        current_password: authorizedPw,
      });
      setSelectedUser(null);
      setAuthorizedPw("");
      q.refetch();
      alert("User account updated successfully!");
    } catch (err: any) {
      console.error(err);
      if (isInvalidPassword(err)) {
        const target = selectedUser;
        setSelectedUser(null);
        setGate({ action: "edit", user: target });
        setGateError("Incorrect password. Please try again.");
      } else if (err?.response?.status === 409) {
        const detail = err?.response?.data?.detail;
        // Keep the edit form open so the pick can be corrected.
        if (detail === "SUPER_ADMIN_EXISTS") {
          setEditError("A Super Admin account already exists. Only one Super Admin is allowed.");
          setEditForm((f) => ({ ...f, role: "admin", barangay_id: "" }));
        } else {
          setEditError("This barangay already has an active admin. Pick a different barangay, or deactivate the existing admin first.");
          setEditForm((f) => ({ ...f, barangay_id: "" }));
        }
      } else {
        alert("Error updating user.");
      }
    }
  }

  // Reset Password — throws so the password gate can surface the error.
  async function handleResetPassword(userId: string, password: string) {
    const res = await api.post(`/api/users/${userId}/reset-password`, { current_password: password });
    setTempPassword(res.data.temporary_password);
    q.refetch();
  }

  // Deactivate User — throws so the password gate can surface the error.
  async function handleDeactivateUser(userId: string, password: string) {
    await api.delete(`/api/users/${userId}`, { data: { current_password: password } });
    q.refetch();
  }

  // Update Account Status (lock/unlock) — throws so the password gate can surface the error.
  async function handleUpdateAccountStatus(userId: string, status: string, password: string) {
    await api.patch(`/api/users/${userId}/account-status`, {
      account_status: status,
      current_password: password,
    });
    q.refetch();
  }

  // Central handler for the password-gate modal.
  async function handleGateConfirm(password: string) {
    if (!gate) return;
    const { action, user: target } = gate;
    setGateLoading(true);
    setGateError(null);
    try {
      if (action === "create") {
        await api.post("/api/auth/verify-password", { password });
        setAuthorizedPw(password);
        setGate(null);
        setAddError(null);
        setShowAddForm(true);
        return;
      }
      if (action === "edit") {
        await api.post("/api/auth/verify-password", { password });
        setAuthorizedPw(password);
        setGate(null);
        setEditError(null);
        setSelectedUser(target);
        setEditForm({
          username: target.username,
          email: target.email,
          password: "",
          role: target.role,
          barangay_id: target.barangay_id || "",
        });
        return;
      }
      if (action === "reset") {
        await handleResetPassword(target.id, password);
      } else if (action === "lock") {
        await handleUpdateAccountStatus(target.id, "locked", password);
      } else if (action === "unlock") {
        await handleUpdateAccountStatus(target.id, "active", password);
      } else if (action === "delete") {
        await handleDeactivateUser(target.id, password);
      }
      setGate(null);
    } catch (err: any) {
      console.error(err);
      setGateError(
        isInvalidPassword(err)
          ? "Incorrect password. Please try again."
          : err?.response?.data?.detail || "Action failed. Please try again."
      );
    } finally {
      setGateLoading(false);
    }
  }

  function closeGate() {
    if (gateLoading) return;
    setGate(null);
    setGateError(null);
  }

  // Permissions Matrix data
  const permissionsList = [
    { name: "Manage Users", admin: true, cho: false, bns: false, bhw: false, visitor: false },
    { name: "Children Database", admin: true, cho: true, bns: true, bhw: true, visitor: false },
    { name: "Conduct Assessments", admin: true, cho: false, bns: true, bhw: true, visitor: false },
    { name: "View Reports", admin: true, cho: true, bns: true, bhw: false, visitor: false },
    { name: "System Settings", admin: true, cho: false, bns: false, bhw: false, visitor: false }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-glass-panel flex flex-col md:flex-row md:items-center md:justify-between p-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Users Management Module
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage system users and roles
          </p>
        </div>
        <button
          onClick={() => setGate({ action: "create" })}
          className="admin-action-btn-primary mt-4 md:mt-0 flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg self-start md:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="admin-glass-panel p-4"><p className="text-xs text-slate-500 font-semibold">Total Users</p><p className="text-2xl font-bold mt-1">{stats.total}</p></div>
        <div className="admin-glass-panel p-4"><p className="text-xs text-slate-500 font-semibold">Active Admins</p><p className="text-2xl font-bold mt-1">{stats.admins}</p></div>
        <div className="admin-glass-panel p-4"><p className="text-xs text-slate-500 font-semibold">Super Admins</p><p className="text-2xl font-bold mt-1">{stats.superAdmins}</p></div>
        <div className="admin-glass-panel p-4"><p className="text-xs text-slate-500 font-semibold">Locked Accounts</p><p className="text-2xl font-bold mt-1 text-amber-600">{stats.locked}</p></div>
      </div>

      {/* Users List Card */}
      <div className="admin-glass-panel p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
            Users List
          </h3>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-405" />
            <input
              className="admin-interactive-input w-full rounded-lg pl-9 pr-3 py-2 text-xs text-slate-700"
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table text-left text-xs font-medium text-slate-650">
            <thead>
              <tr>
                <th className="admin-table-header text-left pl-3">Username</th>
                <th className="admin-table-header text-left">Role</th>
                <th className="admin-table-header text-left">Barangay</th>
                <th className="admin-table-header text-left">Account</th>
                <th className="admin-table-header text-left">Status</th>
                <th className="admin-table-header text-left">Last Login</th>
                <th className="admin-table-header text-right pr-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading user accounts...</td>
                </tr>
              ) : (
                filteredUsers.map((u: any) => {
                  const brgy = barangays.data?.find((b: any) => b.id === u.barangay_id);
                  const isSuper = u.role === "super_admin";
                  const acct = u.account_status || "active";
                  const barangayDisplay = isSuper ? "City-wide" : (brgy?.name || "Unassigned");

                  return (
                    <tr key={u.id} className="admin-table-row">
                      <td className="admin-table-cell pl-3 font-extrabold text-slate-800">
                        {u.username}
                      </td>
                      <td className="admin-table-cell capitalize">
                        <Badge tone={isSuper ? "severe_acute_malnutrition" : "normal"}>
                          {u.role.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="admin-table-cell font-semibold text-slate-750 max-w-xs truncate" title={barangayDisplay}>
                        {barangayDisplay}
                      </td>
                      <td className="admin-table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                          acct === "active" ? "bg-green-50 border-green-200 text-green-700" :
                          acct === "locked" ? "bg-red-50 border-red-250 text-red-700" :
                          "bg-yellow-50 border-yellow-200 text-yellow-700"
                        }`}>
                          {acct}
                        </span>
                      </td>
                      <td className="admin-table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                          u.is_active
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-red-50 border-red-250 text-red-700"
                        }`}>
                          {u.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="admin-table-cell font-semibold text-slate-450">{u.last_login ? new Date(u.last_login).toLocaleDateString() : "N/A"}</td>
                      <td className="admin-table-cell pr-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setGate({ action: "edit", user: u })}
                          className="admin-action-btn-secondary inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-800"
                          title="Edit User"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setGate({ action: "reset", user: u })}
                          className="admin-action-btn-secondary inline-flex p-1.5 rounded-lg text-teal-600 hover:text-teal-800"
                          title="Reset Password"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>
                        {acct === "locked" ? (
                          <button
                            onClick={() => setGate({ action: "unlock", user: u })}
                            className="admin-action-btn-secondary inline-flex p-1.5 rounded-lg text-green-600 hover:text-green-800"
                            title="Unlock Account"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setGate({ action: "lock", user: u })}
                            className="admin-action-btn-secondary inline-flex p-1.5 rounded-lg text-amber-600 hover:text-amber-800"
                            title="Lock Account"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {u.is_active && (
                          <button
                            onClick={() => setGate({ action: "delete", user: u })}
                            className="admin-action-btn-secondary inline-flex p-1.5 rounded-lg text-red-500 hover:text-red-700"
                            title="Deactivate Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permissions Card */}
      <div className="admin-glass-panel p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
            Role Permissions Grid
          </h3>
          <p className="text-xs text-slate-450 mt-0.5">Configuration matrix for system permission privileges</p>
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table text-center text-xs font-semibold text-slate-600 border border-slate-150">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider text-[9.5px]">
                <th className="admin-table-header text-left pl-4">Permission Module</th>
                <th className="admin-table-header text-center">Administrator</th>
                <th className="admin-table-header text-center">City Health Officer</th>
                <th className="admin-table-header text-center">BNS</th>
                <th className="admin-table-header text-center">BHW</th>
                <th className="admin-table-header text-center pr-4">Visitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              {permissionsList.map((perm) => (
                <tr key={perm.name} className="admin-table-row">
                  <td className="admin-table-cell text-left pl-4 font-extrabold text-slate-800">{perm.name}</td>
                  <td>
                    {perm.admin ? (
                      <Check className="h-4.5 w-4.5 text-green-500 mx-auto font-black" />
                    ) : (
                      <CrossIcon className="h-4.5 w-4.5 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td>
                    {perm.cho ? (
                      <Check className="h-4.5 w-4.5 text-green-500 mx-auto font-black" />
                    ) : (
                      <CrossIcon className="h-4.5 w-4.5 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td>
                    {perm.bns ? (
                      <Check className="h-4.5 w-4.5 text-green-500 mx-auto font-black" />
                    ) : (
                      <CrossIcon className="h-4.5 w-4.5 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td>
                    {perm.bhw ? (
                      <Check className="h-4.5 w-4.5 text-green-500 mx-auto font-black" />
                    ) : (
                      <CrossIcon className="h-4.5 w-4.5 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td className="pr-4">
                    {perm.visitor ? (
                      <Check className="h-4.5 w-4.5 text-green-500 mx-auto font-black" />
                    ) : (
                      <CrossIcon className="h-4.5 w-4.5 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddForm && (
        <div className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="admin-modal-content relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 md:p-8 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">Add User Account</h3>
                <p className="text-xs text-slate-400 mt-0.5">Create a new system user with barangay assignment</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username (format: admin_barangayname)</label>
                <input
                  type="text"
                  required
                  className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs text-slate-700"
                  placeholder="e.g. admin_brgy16"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs text-slate-700"
                  placeholder="e.g. user@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">User Role</label>
                <select
                  className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs bg-white text-slate-700"
                  value={form.role}
                  onChange={(e) => {
                    setForm({ ...form, role: e.target.value });
                    setAddError(null);
                  }}
                >
                  <option value="admin">Barangay Admin</option>
                  <option value="super_admin" disabled={addSuperBlocked}>
                    Super Admin{addSuperBlocked ? " — one already exists" : ""}
                  </option>
                </select>
                {addSuperBlocked && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Only one Super Admin account is allowed in the system.
                  </p>
                )}
              </div>

              {form.role === "admin" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assign Barangay</label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    One active admin per barangay — occupied slots are disabled.
                  </p>
                  <select
                    className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs bg-white text-slate-700"
                    value={form.barangay_id}
                    onChange={(e) => {
                      setForm({ ...form, barangay_id: e.target.value });
                      setAddError(null);
                    }}
                    required
                  >
                    <option value="">Select a barangay</option>
                    {barangays.data?.map((b: any) => {
                      const taken = adminBarangayIds.has(String(b.id));
                      return (
                        <option key={b.id} value={b.id} disabled={taken}>
                          {b.name}
                          {taken ? " — already has an admin" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {addError && (
                    <p className="text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      {addError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="admin-action-btn-secondary px-4 py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-action-btn-primary px-4 py-2 rounded-lg text-xs"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateUser}
            className="admin-modal-content relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 md:p-8 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">Edit User Account</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update user credentials and permissions</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs text-slate-700"
                  placeholder="e.g. admin_brgy16"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs text-slate-700"
                  placeholder="e.g. user@example.com"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password (leave blank to keep current)</label>
                <input
                  type="password"
                  className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs text-slate-700"
                  placeholder="Leave blank to keep current password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-1">Tip: Use the "Reset Password" button for quick password resets</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">User Role</label>
                  <select
                    className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs bg-white text-slate-700"
                    value={editForm.role}
                    onChange={(e) => {
                      setEditForm({ ...editForm, role: e.target.value });
                      setEditError(null);
                    }}
                  >
                    <option value="admin">Barangay Admin</option>
                    <option value="super_admin" disabled={editSuperBlocked}>
                      Super Admin{editSuperBlocked ? " — one already exists" : ""}
                    </option>
                  </select>
                  {editSuperBlocked && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Only one Super Admin account is allowed — this user cannot be promoted.
                    </p>
                  )}
              </div>

              {editForm.role === "admin" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Barangay</label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    One active admin per barangay — the user&apos;s current barangay stays selectable.
                  </p>
                  <select
                    className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs bg-white text-slate-700"
                    value={editForm.barangay_id}
                    onChange={(e) => {
                      setEditForm({ ...editForm, barangay_id: e.target.value });
                      setEditError(null);
                    }}
                    required
                  >
                    <option value="">Select a barangay</option>
                    {barangays.data?.map((b: any) => {
                      const isOwn = String(b.id) === String(selectedUser?.barangay_id);
                      const taken = !isOwn && adminBarangayIds.has(String(b.id));
                      return (
                        <option key={b.id} value={b.id} disabled={taken}>
                          {b.name}
                          {taken ? " — already has an admin" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {editError && (
                    <p className="text-xs text-red-600 font-semibold mt-1.5" role="alert">
                      {editError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="admin-action-btn-secondary px-4 py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-action-btn-primary px-4 py-2 rounded-lg text-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {tempPassword && (
        <div className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="admin-modal-content relative w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 md:p-8 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">Password Reset Success</h3>
                <p className="text-xs text-slate-400 mt-0.5">Temporary password generated</p>
              </div>
              <button
                type="button"
                onClick={() => setTempPassword(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-655 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-slate-600 mb-2">Temporary password:</p>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg p-3">
                <code className="flex-1 text-sm font-mono font-bold text-green-700">{tempPassword}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    alert("Password copied to clipboard!");
                  }}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-slate-50 mt-3">
                ⚠️ User must change this password on first login. Share this password securely with the user.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setTempPassword(null)}
                className="admin-action-btn-secondary px-4 py-2 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step-up password gate — blocks every sensitive action */}
      <PasswordConfirmModal
        open={!!gate}
        onClose={closeGate}
        onConfirm={handleGateConfirm}
        loading={gateLoading}
        error={gateError}
        title="Confirm your identity"
        description={
          gate?.action === "delete"
            ? "Enter your password to deactivate this account"
            : gate?.action === "reset"
            ? "Enter your password to reset this account's password"
            : gate?.action === "lock"
            ? "Enter your password to lock this account"
            : gate?.action === "unlock"
            ? "Enter your password to unlock this account"
            : "Enter your password to continue"
        }
        targetLabel={gate?.user?.username ?? "New user account"}
        confirmLabel={
          gate?.action === "delete"
            ? "Deactivate"
            : gate?.action === "reset"
            ? "Reset Password"
            : gate?.action === "lock"
            ? "Lock Account"
            : gate?.action === "unlock"
            ? "Unlock Account"
            : "Confirm"
        }
        danger={gate?.action === "delete" || gate?.action === "lock"}
      />
    </div>
  );
}
