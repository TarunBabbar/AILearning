"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { AppFooter } from "@/components/ui/AppFooter";
import { UserMenu } from "@/components/ui/UserMenu";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  History,
  Settings2,
  X,
  Trash2,
  Smartphone,
  Globe,
  Server,
} from "lucide-react";

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

// Quick-start templates shown in the create modal — grouped by automation
// capability so the UI is honest about what's supported right now.
interface Template {
  label: string;
  name: string;
  icon: typeof Smartphone;
  supported: boolean;
  hint?: string;
}

const TEMPLATES: Template[] = [
  { label: "Web app QA", name: "Web App QA", icon: Globe, supported: true, hint: "Playwright UI automation" },
  { label: "API automation", name: "API Automation", icon: Server, supported: false, hint: "Coming soon" },
  { label: "Integration tests", name: "Integration Testing", icon: Server, supported: false, hint: "Coming soon" },
  { label: "Database testing", name: "Database Testing", icon: Server, supported: false, hint: "Coming soon" },
  { label: "Mobile app QA", name: "Mobile App QA", icon: Smartphone, supported: false, hint: "Coming soon" },
];

export default function WorkspacesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      // Fetch auth + workspaces in parallel (was sequential → slower load).
      const [meRes, wsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/workspaces"),
      ]);
      const d = await meRes.json();
      if (!d.user) {
        router.replace("/login");
        return;
      }
      setMe(d.user);
      const wd = await wsRes.json();
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

  // Focus the name input when the modal opens.
  useEffect(() => {
    if (modalOpen) inputRef.current?.focus();
  }, [modalOpen]);

  const openModal = () => {
    setName("");
    setError(null);
    setModalOpen(true);
  };

  const create = async (preset?: string) => {
    const finalName = (preset || name).trim();
    if (!finalName || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Could not create workspace");
        return;
      }
      setName("");
      setModalOpen(false);
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

  const removeWorkspace = async (id: string) => {
    if (deletingId) return;
    if (!window.confirm("Delete this workspace and ALL its data (artifacts, run history, evaluations)? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Could not delete workspace");
        return;
      }
      setWorkspaces(d.workspaces || []);
    } catch {
      setError("Network error — try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || me === undefined) {
    return <PageLoader label="Loading workspaces…" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <Sparkles size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Workspaces</span>
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Sparkles size={14} /> Home
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Settings2 size={14} /> Settings
            </Link>
            {me && (
              <UserMenu name={me.name} email={me.email} onLogout={logout} />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 flex-1 w-full">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Your workspaces</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Create a workspace per product or team, then run the agentic pipeline inside it.
            </p>
          </div>
          <div className="ml-auto">
            <Button onClick={openModal}>
              <Plus size={15} /> New workspace
            </Button>
          </div>
        </div>

        {/* Stats */}
        {workspaces.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg">
            <div className="rounded-lg border border-border bg-bg-surface p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{workspaces.length}</p>
              <p className="text-[11px] text-text-muted">Workspaces</p>
            </div>
            <div className="rounded-lg border border-border bg-bg-surface p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{workspaces.reduce((n, w) => n + (w.runCount || 0), 0)}</p>
              <p className="text-[11px] text-text-muted">Total runs</p>
            </div>
            <div className="rounded-lg border border-border bg-bg-surface p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{workspaces.filter((w) => w.lastRunAt).length}</p>
              <p className="text-[11px] text-text-muted">Active</p>
            </div>
          </div>
        )}

        {/* Workspace grid */}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/workspace?workspaceId=${w.id}`}
              className="group rounded-xl border border-border bg-bg-surface card-shadow p-5 flex flex-col transition-all hover:-translate-y-1 hover:border-amber-500/40 hover:card-shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-700 ring-1 ring-amber-500/20">
                  <LayoutGrid size={17} />
                </span>
                {w.lastRunStatus && (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      w.lastRunStatus === "success"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : w.lastRunStatus === "failed"
                          ? "border-red-500/40 bg-red-500/10 text-red-600"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-700"
                    )}
                  >
                    {w.lastRunStatus}
                  </span>
                )}
              </div>

              <h3 className="mt-3 font-semibold text-text-primary group-hover:text-amber-700 transition-colors">{w.name}</h3>
              {w.description && <p className="mt-1 text-xs text-text-secondary line-clamp-2 flex-1">{w.description}</p>}
              {!w.description && <div className="flex-1" />}

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <History size={12} /> {w.runCount} run{w.runCount !== 1 ? "s" : ""}
                </span>
                {w.lastRunAt && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                    {new Date(w.lastRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open workspace <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void removeWorkspace(w.id);
                  }}
                  disabled={deletingId === w.id}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors",
                    "text-text-muted hover:text-red-600 hover:bg-red-500/10",
                    "opacity-0 group-hover:opacity-100",
                    deletingId === w.id && "opacity-100 text-red-600"
                  )}
                  title="Delete workspace and all its data"
                >
                  {deletingId === w.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {deletingId === w.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </Link>
          ))}

          {workspaces.length === 0 && !loading && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-border p-12 text-center">
              <span className="mx-auto flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700">
                <LayoutGrid size={22} />
              </span>
              <p className="mt-4 text-sm font-semibold text-text-primary">No workspaces yet</p>
              <p className="mt-1 text-sm text-text-muted">Create your first workspace to run the agentic pipeline.</p>
              <Button onClick={openModal} className="mt-5">
                <Plus size={15} /> Create your first workspace
              </Button>
            </div>
          )}
        </div>
      </main>
      <AppFooter />

      {/* New workspace modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !creating && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-bg-surface card-shadow-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-text-primary">New workspace</h2>
              <button
                onClick={() => !creating && setModalOpen(false)}
                className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-text-secondary">
              A workspace keeps one product or team's requirements, artifacts, and runs together.
            </p>

            <label className="block mt-4">
              <span className="text-xs font-semibold text-text-secondary">Workspace name</span>
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Mobile App QA, E-commerce Release"
                className="mt-1.5 w-full rounded-lg border border-border-input bg-bg-input px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>

            {/* Quick templates — supported now vs coming soon */}
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-text-muted">
              Automation types
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.label}
                    onClick={() => {
                      if (!t.supported) return;
                      setName(t.name);
                      inputRef.current?.focus();
                    }}
                    disabled={!t.supported}
                    className={cn(
                      "flex flex-col items-start gap-1 px-3 py-2 rounded-lg border text-left transition-colors",
                      t.supported
                        ? "border-border bg-bg-page text-text-secondary hover:border-amber-500/40 hover:text-amber-700 cursor-pointer"
                        : "border-border bg-bg-page/50 text-text-muted opacity-60 cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon size={13} className={t.supported ? "text-amber-600" : "text-text-muted"} /> {t.label}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {t.supported ? t.hint : "Coming soon"}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => !creating && setModalOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={() => create()} disabled={creating || !name.trim()}>
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Create workspace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
