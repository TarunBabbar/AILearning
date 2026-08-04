import { NextRequest } from "next/server";
import { listAll, getOne, updateOne, withWorkspace } from "@/lib/store";
import type { Analysis, Coverage, Cycle, Defect, ReleaseReport, Requirement, Script } from "@/lib/types";

export const runtime = "nodejs";

const KEY_MAP: Record<string, "requirements" | "analyses" | "coverages" | "scripts" | "cycles" | "defects" | "releases"> = {
  requirement: "requirements",
  analysis: "analyses",
  coverage: "coverages",
  script: "scripts",
  cycle: "cycles",
  defect: "defects",
  release: "releases",
};

// GET /api/artifacts?type=analysis&id=...  or  GET /api/artifacts?requirementId=...
// Requires ?workspaceId= (scoping). Returns only that workspace's artifacts.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const id = sp.get("id");
  const requirementId = sp.get("requirementId");
  const workspaceId = sp.get("workspaceId") || "";

  return withWorkspace(workspaceId, async () => {
    const store: Record<string, unknown[]> = {
      requirement: await listAll<Requirement>("requirements"),
      analysis: await listAll<Analysis>("analyses"),
      coverage: await listAll<Coverage>("coverages"),
      script: await listAll<Script>("scripts"),
      cycle: await listAll<Cycle>("cycles"),
      defect: await listAll<Defect>("defects"),
      release: await listAll<ReleaseReport>("releases"),
    };

    if (type && store[type]) {
      if (id) {
        const item = await getOne<{ id: string }>(KEY_MAP[type as keyof typeof KEY_MAP] || (type + "s"), id);
        return Response.json(item ? { [type]: item } : { error: "not found" }, { status: item ? 200 : 404 });
      }
      return Response.json({ [type]: store[type] });
    }

    if (requirementId) {
      const bundle: Record<string, unknown[]> = {};
      (Object.keys(store) as Array<keyof typeof store>).forEach((k) => {
        bundle[k] = (store[k] as Array<{ requirementId?: string }>).filter((x) => x.requirementId === requirementId);
      });
      return Response.json(bundle);
    }

    return Response.json(store);
  });
}

// PUT /api/artifacts — update an artifact in place (e.g. edited coverage)
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.id || !body?.payload) {
    return Response.json({ error: "type, id, payload required" }, { status: 400 });
  }
  const { type, id, payload, workspaceId } = body as { type: string; id: string; payload: Record<string, unknown>; workspaceId?: string };
  const key = KEY_MAP[type as keyof typeof KEY_MAP];
  if (!key) return Response.json({ error: "unknown type" }, { status: 400 });

  return withWorkspace(workspaceId || "", async () => {
    const item = await getOne<{ id: string }>(key, id);
    if (!item) return Response.json({ error: "not found" }, { status: 404 });

    await updateOne(key, id, { ...(payload as { id: string }) });
    return Response.json({ ok: true });
  });
}
