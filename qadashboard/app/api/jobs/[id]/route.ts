import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { fetchRemoteJob } from "@/lib/job-board-api";
import { mergeRemoteWithOverlay, upsertJobOverlay } from "@/lib/job-overlay";

/**
 * PATCH /api/jobs/[id] — id is the remote QAJobs job id.
 * Updates local pipeline status overlay.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await req.json();
    const status = typeof body.status === "string" ? body.status : null;
    if (!status) {
      return Response.json({ error: "status required" }, { status: 400 });
    }

    let remote;
    try {
      remote = await fetchRemoteJob(id);
    } catch {
      const existing = await prisma.job.findFirst({
        where: { userId, originalId: id },
      });
      if (!existing) {
        return Response.json({ error: "Job not found" }, { status: 404 });
      }
      remote = {
        id,
        title: existing.title,
        company: existing.company,
        email: existing.email,
        location: existing.location,
        experience: existing.experience,
        description: existing.description,
      };
    }

    const updated = await upsertJobOverlay(userId, remote, { status });
    return Response.json({
      success: true,
      job: mergeRemoteWithOverlay(remote as any, updated),
    });
  } catch (err) {
    console.error("[jobs/id] patch failed:", err);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[id] — soft-delete via local status=deleted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId(_req);
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    let remote;
    try {
      remote = await fetchRemoteJob(id);
    } catch {
      const existing = await prisma.job.findFirst({
        where: { userId, originalId: id },
      });
      if (!existing) {
        return Response.json({ error: "Job not found" }, { status: 404 });
      }
      remote = {
        id,
        title: existing.title,
        company: existing.company,
        email: existing.email,
        location: existing.location,
        experience: existing.experience,
        description: existing.description,
      };
    }

    await upsertJobOverlay(userId, remote, { status: "deleted" });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * GET /api/jobs/[id] — remote job + local overlay.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const remote = await fetchRemoteJob(id);
    const overlay = await prisma.job.findFirst({
      where: { userId, originalId: id },
    });
    return Response.json({
      job: mergeRemoteWithOverlay(remote, overlay),
    });
  } catch (err) {
    console.error("[jobs/id] get failed:", err);
    return Response.json({ error: "Job not found" }, { status: 404 });
  }
}
