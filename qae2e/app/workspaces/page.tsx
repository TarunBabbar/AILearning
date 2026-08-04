"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Sparkles, ArrowRight, LogOut, LayoutGrid, History } from "lucide-react";

interface WorkspaceItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  runCount: number;
  lastRunAt?: string;
  lastRunStatus?: string;
}

interface Me {
  id: string;
  email: string;
  name?: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      if (!d.user) {
        router.replace("/login");
        return;
      }
      setMe(d.user);
      const ws = await fetch("/api/workspaces");
      const wd = await ws.json();
      setWorkspaces(wd.workspaces || []);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
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

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  if (loading || me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <Sparkles size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Workspaces</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-amber-700 px-2 py-1.5 rounded-md transition-colors">
              <Sparkles size={14} /> Home
            </Link>
            {me?.name && <span className="text-sm text-text-secondary hidden sm:inline">{me.name}</span>}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-red-600 px-2 py-1.5 rounded-md transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Your workspaces</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Create a workspace per product or team, then run the agentic pipeline inside it.
            </p>
          </div>
        </div>

        {/* Create workspace */}
        <Card className="mt-6 p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-text-secondary">New workspace name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Mobile App QA, E-commerce Release, API Platform"
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
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </Card>

        {/* Workspace grid */}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/workspace?workspaceId=${w.id}`}
              className="group rounded-xl border border-border bg-bg-surface card-shadow p-5 transition-all hover:-translate-y-1 hover:border-amber-500/40 hover:card-shadow-lg"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700">
                  <LayoutGrid size={15} />
                </span>
                <h3 className="font-semibold text-text-primary group-hover:text-amber-700 transition-colors">{w.name}</h3>
              </div>
              {w.description && <p className="mt-2 text-xs text-text-secondary line-clamp-2">{w.description}</p>}
              <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <History size={12} /> {w.runCount} run{w.runCount !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                  Open <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}

          {workspaces.length === 0 && !loading && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
              No workspaces yet — create one above to get started.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
