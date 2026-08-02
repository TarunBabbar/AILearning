import { NextRequest } from "next/server";
import { listAll, getOne, updateOne } from "@/lib/store";
import type { Analysis, Coverage, Cycle, Defect, ReleaseReport, Requirement, Script } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/artifacts?type=analysis&id=...  or  GET /api/artifacts?requirementId=...
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const id = sp.get("id");
  const requirementId = sp.get("requirementId");

  const store: Record<string, unknown[]> = {
    requirement: listAll<Requirement>("requirements"),
    analysis: listAll<Analysis>("analyses"),
    coverage: listAll<Coverage>("coverages"),
    script: listAll<Script>("scripts"),
    cycle: listAll<Cycle>("cycles"),
    defect: listAll<Defect>("defects"),
    release: listAll<ReleaseReport>("releases"),
  };

  if (type && store[type]) {
    if (id) {
      const item = getOne<{ id: string }>(type + "s", id);
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
}

// PUT /api/artifacts — update an artifact in place (e.g. edited coverage)
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.id || !body?.payload) {
    return Response.json({ error: "type, id, payload required" }, { status: 400 });
  }
  const { type, id, payload } = body as { type: string; id: string; payload: Record<string, unknown> };
  const keyMap: Record<string, string> = {
    requirement: "requirements",
    analysis: "analyses",
    coverage: "coverages",
    script: "scripts",
    cycle: "cycles",
    defect: "defects",
    release: "releases",
  };
  const key = keyMap[type];
  if (!key) return Response.json({ error: "unknown type" }, { status: 400 });

  const item = getOne<{ id: string }>(key, id);
  if (!item) return Response.json({ error: "not found" }, { status: 404 });

  updateOne(key, { ...(payload as { id: string }) });
  return Response.json({ ok: true });
}
