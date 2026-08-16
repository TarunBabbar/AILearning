"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Loader2, Plus, ArrowRight, LayoutGrid, UserPlus, Trash2 } from "lucide-react";

interface WorkspaceItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  runCount: number;
  lastRunAt?: string;
  lastRunStatus?: string;
  regression?: boolean;
  members?: Array<{ userId: string; email: string; name?: string; role: string }>;
}

export function WorkspacesTab() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/workspaces");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setWorkspaces(d.workspaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWorkspaces([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Could not create workspace");
        return;
      }
      setName("");
      setWorkspaces(d.workspaces || []);
    } catch {
      setError("Network error — try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggleRegression = async (id: string, regression: boolean) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id, regression }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: d.error || "Failed" });
        return;
      }
      await load();
      setMessage({ ok: true, text: `Regression ${regression ? "enabled" : "disabled"} for ${d.name || "workspace"}.` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyId(null);
    }
  };

  const invite = async (id: string, email: string, role: string) => {
    if (!email.trim()) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/workspaces/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id, email, role }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: d.error || "Invite failed" });
        return;
      }
      setMessage({ ok: true, text: `Added ${email} to the workspace.` });
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (workspaceId: string, userId: string) => {
    setBusyId(workspaceId);
    try {
      await fetch("/api/settings/workspaces/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, userId }),
      });
      await load();
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  if (!workspaces) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted py-10">
        <Loader2 size={15} className="animate-spin" /> Loading workspaces…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className={cn("text-xs", message.ok ? "text-emerald-700" : "text-red-600")}>
          {message.ok ? "✓ " : "✗ "}
          {message.text}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Create workspace */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-text-secondary">New workspace name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="e.g. Mobile App QA, E-commerce Release"
              className="mt-1 w-full rounded-lg border border-border-input bg-bg-input px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="sm:self-end">
            <Button onClick={create} disabled={creating || !name.trim()}>
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Create workspace
            </Button>
          </div>
        </div>
      </Card>

      {/* Workspace list */}
      <div className="space-y-3">
        {workspaces.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700">
                <LayoutGrid size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-text-primary">{w.name}</h3>
                <p className="text-xs text-text-muted">
                  {w.runCount} run{w.runCount !== 1 ? "s" : ""}
                  {w.lastRunAt ? ` · last ${new Date(w.lastRunAt).toLocaleString()}` : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(w.regression)}
                  onChange={(e) => toggleRegression(w.id, e.target.checked)}
                  disabled={busyId === w.id}
                  className="accent-amber-500"
                />
                Scheduled regression
              </label>
              <Link
                href={`/settings?workspaceId=${w.id}&tab=integrations`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:underline"
              >
                Integrations <ArrowRight size={12} />
              </Link>
              <Link
                href={`/workspace?workspaceId=${w.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:underline"
              >
                Open <ArrowRight size={12} />
              </Link>
            </div>

            {/* Members */}
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">Members</p>
              {w.members && w.members.length > 0 ? (
                <ul className="space-y-1.5">
                  {w.members.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between text-xs text-text-secondary">
                      <span>
                        <span className="font-semibold text-text-primary">{m.name || m.email}</span>{" "}
                        <span className="text-text-muted">· {m.role}</span>
                      </span>
                      {m.role !== "owner" && (
                        <button
                          onClick={() => removeMember(w.id, m.userId)}
                          disabled={busyId === w.id}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-muted">Single-owner workspace — no members yet.</p>
              )}
              <div className="mt-2 flex gap-2">
                <InviteForm onInvite={(email, role) => invite(w.id, email, role)} disabled={busyId === w.id} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InviteForm({ onInvite, disabled }: { onInvite: (email: string, role: string) => void; disabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <UserPlus size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && email.trim() && onInvite(email, role)}
          placeholder="member@company.com"
          className="w-full rounded-lg border border-border-input bg-bg-input pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
        />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-lg border border-border-input bg-bg-input px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button
        onClick={() => email.trim() && onInvite(email, role)}
        disabled={disabled || !email.trim()}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
      >
        Invite
      </button>
    </div>
  );
}
