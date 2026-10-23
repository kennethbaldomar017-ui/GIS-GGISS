"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { Lock, Eye, EyeOff, ShieldAlert, X } from "lucide-react";

interface PasswordConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title?: string;
  description?: string;
  targetLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
}

export default function PasswordConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm your identity",
  description = "Sensitive action — superadmin password required",
  targetLabel,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
  error = null,
}: PasswordConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevError = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setShowPassword(false);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (error && error !== prevError.current) {
      setPassword("");
      inputRef.current?.focus();
    }
    prevError.current = error;
  }, [error]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || !password) return;
    onConfirm(password);
  }

  return (
    <div className="admin-modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="admin-modal-content relative w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 md:p-8 space-y-4"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
              }`}
            >
              <Lock className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-800">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cancel"
            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {targetLabel && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Target account
            </p>
            <p className="text-xs font-extrabold text-slate-700 mt-0.5 break-all">
              {targetLabel}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="reauth-password"
            className="block text-xs font-bold text-slate-700"
          >
            Superadmin password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-4 w-4 text-slate-400" />
            </span>
            <input
              id="reauth-password"
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={loading}
              className="admin-interactive-input w-full rounded-lg pl-9 pr-10 py-2 text-xs text-slate-700 disabled:opacity-60"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs font-semibold text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="admin-action-btn-secondary px-4 py-2 rounded-lg text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !password}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "admin-action-btn-primary"
            }`}
          >
            {loading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
