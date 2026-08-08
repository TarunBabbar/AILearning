import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeJobForDisplay } from "@/lib/sanitize";

/**
 * GET /api/jobs/[id] — single job with company info.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({
      where: { id },
      include: { companyInfo: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json({ job: sanitizeJobForDisplay(job) });
  } catch (e) {
    console.error("[job] error:", e);
    return NextResponse.json({ error: "Failed to load job." }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[id] — remove a single job.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ message: "Job deleted." });
  } catch (e) {
    console.error("[job] delete error:", e);
    return NextResponse.json({ error: "Failed to delete job." }, { status: 500 });
  }
}
