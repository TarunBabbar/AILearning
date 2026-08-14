"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/user/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      // Use the API's message — it's intentionally generic (no account
      // enumeration) and includes the attempts-left + spam reminder.
      setResponse(data.message || "If an account exists, we've sent a password reset link.");
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="rounded-xl border border-claude-border bg-white p-8 text-center shadow-sm">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e3efe3] text-[#3d7a3d]">
            <Check size={22} />
          </span>
          <p className="text-base font-semibold text-claude-text">Check your inbox</p>
          <p className="mt-2 text-sm leading-relaxed text-claude-muted">{response}</p>
          <Link
            href="/score"
            className="mt-5 inline-block text-sm font-medium text-claude-accent hover:underline"
          >
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight text-claude-text">Forgot password?</h1>
      <p className="mb-6 mt-1 text-sm text-claude-muted">
        Enter your registered email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-claude-border bg-white p-6 shadow-sm">
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your registered email"
            className="w-full rounded-lg border border-claude-border py-2 pl-9 pr-3 text-sm outline-none focus:border-claude-accent"
          />
        </div>
        {error && <p className="text-xs text-[#a04040]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-claude-accent px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Send reset link
        </button>
        <p className="text-center text-xs text-claude-muted">
          Remembered it?{" "}
          <Link href="/score" className="font-medium text-claude-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
