"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Loader2, LogOut, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export function AccountTab() {
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/account");
      const d = await res.json();
      if (d.user) {
        setUser(d.user);
        setEmail(d.user.email || "");
      }
      setSessions(d.sessions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: d.error || "Request failed" });
        return;
      }
      setMessage({ ok: true, text: d.message || "Done." });
      if (action === "password") {
        setCurrentPassword("");
        setNewPassword("");
      }
      if (action === "email" && d.ok) setUser((u) => (u ? { ...u, email } : u));
      if (action === "revoke-session" || action === "logout-all") await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted py-10">
        <Loader2 size={15} className="animate-spin" /> Loading account…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      {message && (
        <p className={cn("text-xs", message.ok ? "text-emerald-700" : "text-red-600")}>
          {message.ok ? "✓ " : "✗ "}
          {message.text}
        </p>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={15} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">Email</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => act("email", { email })}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {busy === "email" ? <Loader2 size={12} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={15} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">Change password</h3>
        </div>
        <div className="space-y-2.5">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => act("password", { currentPassword, newPassword })}
            disabled={busy !== null || !currentPassword || newPassword.length < 8}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {busy === "password" ? <Loader2 size={12} className="animate-spin" /> : "Update password"}
          </button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">Active sessions</h3>
        </div>
        {sessions.length === 0 ? (
          <p className="text-xs text-text-muted">No active sessions.</p>
        ) : (
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-xs text-text-secondary">
                <span>
                  {new Date(s.createdAt).toLocaleString()} — expires {new Date(s.expiresAt).toLocaleString()}
                </span>
                <button
                  onClick={() => act("revoke-session", { sessionId: s.id })}
                  disabled={busy !== null}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => act("logout-all")}
          disabled={busy !== null}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          <LogOut size={12} /> Sign out of all sessions
        </button>
      </Card>
    </div>
  );
}
