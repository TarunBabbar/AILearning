// POST /api/github — GitHub operations used by the check-in flow.
// action: tree | read | create-branch | commit | dispatch

import { NextRequest } from "next/server";
import {
  githubGetTree,
  githubReadRepo,
  githubCreateBranch,
  githubCommitMultipleFiles,
  githubDispatchWorkflow,
} from "@/lib/connectors/client";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const owner = String(body.owner || getConfig().githubOwner);
  const repo = String(body.repo || getConfig().githubRepo);
  const branch = String(body.branch || getConfig().githubBranch);
  if (!owner || !repo) return Response.json({ error: "owner and repo required" }, { status: 400 });

  try {
    if (action === "tree") {
      const res = await githubGetTree(owner, repo, branch);
      return res.ok ? Response.json({ ok: true, tree: res.data }) : Response.json({ ok: false, error: (res.data as { error?: string })?.error }, { status: res.status });
    }

    if (action === "read") {
      const path = String(body.path || "");
      const res = await githubReadRepo(owner, repo, path);
      return res.ok ? Response.json({ ok: true, data: res.data }) : Response.json({ ok: false, error: (res.data as { error?: string })?.error }, { status: res.status });
    }

    if (action === "create-branch") {
      const name = String(body.name || "");
      const base = String(body.base || "main");
      if (!name) return Response.json({ error: "name required" }, { status: 400 });
      const res = await githubCreateBranch(owner, repo, name, base);
      return res.ok ? Response.json({ ok: true }) : Response.json({ ok: false, error: (res.data as { error?: string })?.error }, { status: res.status });
    }

    if (action === "commit") {
      const files = Array.isArray(body.files) ? body.files : [];
      const message = String(body.message || "QAE2E: add generated test automation");
      if (!files.length) return Response.json({ error: "files required" }, { status: 400 });
      const res = await githubCommitMultipleFiles(owner, repo, branch, files, message);
      return res.ok ? Response.json({ ok: true }) : Response.json({ ok: false, error: (res.data as { error?: string })?.error }, { status: res.status });
    }

    if (action === "dispatch") {
      const workflowFile = String(body.workflowFile || "");
      const inputs = (body.inputs as Record<string, string>) || {};
      if (!workflowFile) return Response.json({ error: "workflowFile required" }, { status: 400 });
      const res = await githubDispatchWorkflow(owner, repo, workflowFile, branch, inputs);
      return res.ok ? Response.json({ ok: true }) : Response.json({ ok: false, error: (res.data as { error?: string })?.error }, { status: res.status });
    }

    return Response.json({ error: `unknown action ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
