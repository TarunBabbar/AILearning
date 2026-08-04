// GET /api/export?coverageId=...&format=csv|xlsx  → download test cases

import { NextRequest } from "next/server";
import { listAll, withWorkspace } from "@/lib/store";
import { coverageToCsv, coverageToXlsx, fileName } from "@/lib/export";
import type { Coverage, ExportFormat } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const coverageId = sp.get("coverageId");
  const format = (sp.get("format") || "csv") as ExportFormat;
  const workspaceId = sp.get("workspaceId") || "";
  if (!coverageId) return Response.json({ error: "coverageId required" }, { status: 400 });

  return withWorkspace(workspaceId, async () => {
    const coverage = (await listAll<Coverage>("coverages")).find((c) => c.id === coverageId);
    if (!coverage) return Response.json({ error: "coverage not found" }, { status: 404 });

    const name = fileName(coverage, format);
    if (format === "xlsx") {
      const buf = coverageToXlsx(coverage);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${name}"`,
        },
      });
    }
    return new Response(coverageToCsv(coverage), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  });
}
