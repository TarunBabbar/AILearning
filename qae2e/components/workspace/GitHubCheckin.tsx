"use client";

import { useState } from "react";
import type { Script } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { GitBranch, FolderTree, Loader2, Rocket, CheckCircle2, XCircle } from "lucide-react";

interface TreeItem {
  path: string;
  type: string;
}

export function GitHubCheckin({
  script,
  requirementId,
}: {
  script: Script | null;
  requirementId: string | null;
}) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [newBranch, setNewBranch] = useState("qae2e/test-cases");
  const [tree, setTree] = useState<TreeItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadTree = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tree", owner, repo, branch }),
      });
      const d = await res.json();
      if (!d.ok) {
        setMsg({ ok: false, text: d.error || "Failed to load tree" });
        setTree(null);
        return;
      }
      const t = (d.tree?.tree || []).filter((i: { type: string }) => i.type === "blob") as TreeItem[];
      setTree(t);
      setMsg({ ok: true, text: `Loaded ${t.length} files from ${owner}/${repo}@${branch}` });
    } catch (err) {
      setMsg({ ok: false, text: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const createBranch = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-branch", owner, repo, name: newBranch, base: branch }),
      });
      const d = await res.json();
      setMsg(d.ok ? { ok: true, text: `Branch ${newBranch} created.` } : { ok: false, text: d.error || "Branch create failed" });
    } catch (err) {
      setMsg({ ok: false, text: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    if (!script || !script.files.length) {
      setMsg({ ok: false, text: "No generated script to commit yet — run the pipeline first." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const files = script.files.map((f) => ({ path: f.path, content: f.code }));
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          owner,
          repo,
          branch: newBranch,
          files,
          message: `QAE2E: add test automation for requirement ${requirementId || ""}`,
        }),
      });
      const d = await res.json();
      setMsg(d.ok ? { ok: true, text: `Committed ${files.length} file(s) to ${owner}/${repo}@${newBranch}.` } : { ok: false, text: d.error || "Commit failed" });
    } catch (err) {
      setMsg({ ok: false, text: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const dispatch = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispatch",
          owner,
          repo,
          branch: newBranch,
          workflowFile: ".github/workflows/e2e.yml",
          inputs: { requirementId: requirementId || "" },
        }),
      });
      const d = await res.json();
      setMsg(d.ok ? { ok: true, text: `Workflow dispatched on ${newBranch}.` } : { ok: false, text: d.error || "Dispatch failed" });
    } catch (err) {
      setMsg({ ok: false, text: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const hasScript = Boolean(script?.files?.length);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Check in automation (GitHub)</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Repo owner (org/user)" className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repo name" className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Base branch (main)" className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="New branch name" className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={loadTree} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-text-secondary text-xs font-semibold hover:bg-bg-hover disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <FolderTree size={12} />} Read framework
        </button>
        <button onClick={createBranch} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-text-secondary text-xs font-semibold hover:bg-bg-hover disabled:opacity-50">
          Create branch
        </button>
        <button onClick={commit} disabled={loading || !hasScript} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50">
          Commit {hasScript ? `${script!.files.length} file(s)` : "(no script yet)"}
        </button>
        <button onClick={dispatch} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/40 text-emerald-700 text-xs font-semibold hover:bg-emerald-500/10 disabled:opacity-50">
          <Rocket size={12} /> Dispatch CI
        </button>
      </div>

      {tree && (
        <div className="mt-4 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-bg-page p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">Framework files</p>
          {tree.slice(0, 200).map((i) => (
            <p key={i.path} className="text-xs font-mono text-text-secondary truncate">{i.path}</p>
          ))}
        </div>
      )}

      {msg && (
        <p className={cn("mt-3 text-xs flex items-center gap-1.5", msg.ok ? "text-emerald-700" : "text-red-600")}>
          {msg.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {msg.text}
        </p>
      )}
    </Card>
  );
}
