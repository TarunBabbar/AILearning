import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { runGenerationPipeline } from "@/lib/generation/pipeline";

export async function POST(req: NextRequest) {
  const { workspaceId } = await requireAuth();
  const body = await req.json();
  const { requirement_ids, max_cases = 50 } = body as {
    requirement_ids?: string[];
    max_cases?: number;
  };

  const summary = await runGenerationPipeline(workspaceId, requirement_ids, max_cases);
  if (summary.error) {
    return NextResponse.json({ detail: summary.error }, { status: 502 });
  }
  return NextResponse.json(summary);
}
