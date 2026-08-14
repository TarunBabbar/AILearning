"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, Check } from "lucide-react";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy) return;
      setError(null);
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/user/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || "Failed to reset password.");
          return;
        }
        setDone(true);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [token, password, confirm, busy]
  );

  if (!token) {
    return (
      <div className="rounded-xl border border-claude-border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-claude-muted">This reset link is invalid or incomplete.</p>
        <Link
          href="/forgot-password"
          className="mt-3 inline-block text-sm font-medium text-claude-accent hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-claude-border bg-white p-6 text-center shadow-sm">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#e3efe3] text-[#3d7a3d]">
          <Check size={18} />
        </span>
        <p className="text-sm font-medium text-claude-text">Password updated!</p>
        <p className="mt-1 text-xs text-claude-muted">You can now sign in with your new password.</p>
        <Link
          href="/score"
          className="mt-4 inline-block rounded-lg bg-claude-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Go to Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-claude-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-claude-accent/10 text-claude-accent">
          <KeyRound size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-claude-text">Set a new password</p>
          <p className="text-[11px] text-claude-muted">Choose a new password for your account.</p>
        </div>
      </div>
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 6 chars)"
        className="w-full rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
      />
      <input
        type="password"
        required
        minLength={6}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        className="w-full rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
      />
      {error && <p className="text-xs text-[#a04040]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-claude-accent px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Update password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-claude-text">
        Reset Password
      </h1>
      <p className="mb-6 text-sm text-claude-muted">QA Jobs Portal</p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-claude-bg" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
