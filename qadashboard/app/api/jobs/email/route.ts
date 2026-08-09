import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { fetchRemoteJob } from "@/lib/job-board-api";
import { upsertJobOverlay } from "@/lib/job-overlay";
import { extractResumeHighlights, extractResumeName } from "@/lib/resume-extract";

export const maxDuration = 300;

const DEFAULT_TEMPLATE = `Hi {{company}} team,\n\nI'm applying for the {{title}} position.\n\nKey highlights from my background:\n{{highlights}}\n\nI'd welcome the chance to discuss how I can contribute.\n\nBest regards,\n{{signature}}`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(title|company|email|highlights|signature)\}\}/g, (_, key: string) => escapeHtml(values[key] || ""));
}

async function resolveRemote(userId: string, jobId: string) {
  try { return await fetchRemoteJob(jobId); } catch {
    const existing = await prisma.job.findFirst({ where: { userId, originalId: jobId } });
    if (!existing) return null;
    return { id: jobId, title: existing.title, company: existing.company, email: existing.email, location: existing.location, experience: existing.experience, description: existing.description };
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const ids = Array.isArray(body.jobIds) ? body.jobIds.filter((id: unknown): id is string => typeof id === "string") : typeof body.jobId === "string" ? [body.jobId] : [];
    if (!ids.length) return Response.json({ error: "jobId or jobIds required" }, { status: 400 });

    const [resume, settings] = await Promise.all([
      prisma.resume.findFirst({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
    ]);
    if (!resume) return Response.json({ error: "Upload a resume first" }, { status: 400 });
    const template = typeof body.template === "string" && body.template.trim() ? body.template.slice(0, 12000) : settings?.emailTemplate || DEFAULT_TEMPLATE;
    // Skill bullets: stored highlights if present, else extracted on read.
    const storedHighlights = (resume.highlights || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const skillLines = storedHighlights.length ? storedHighlights : extractResumeHighlights(resume.content);
    const highlights = skillLines.map((s) => `• ${s}`).join("\n") || resume.content.slice(0, 1200);
    const nameFromResume = extractResumeName(resume.content);
    const signature = nameFromResume || resume.filename.replace(/\.[^.]+$/, "") || "QA Candidate";

    if (ids.length === 1) {
      const jobId = ids[0];
      const existing = await prisma.job.findFirst({ where: { userId, originalId: jobId }, select: { emailSent: true } });
      if (existing?.emailSent) return Response.json({ error: "Application email already sent for this job" }, { status: 409 });
      const remote = await resolveRemote(userId, jobId);
      if (!remote) return Response.json({ error: "Job not found" }, { status: 404 });
      if (!remote.email) return Response.json({ error: "This job has no contact email" }, { status: 400 });
      const text = applyTemplate(template, { title: remote.title, company: remote.company, email: remote.email, highlights, signature });
      await sendEmail({ to: remote.email, subject: `Application for ${remote.title} — ${remote.company}`, text, html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${text}</div>` });
      const updated = await upsertJobOverlay(userId, remote, { emailSent: true, emailSentAt: new Date(), status: "emailed" });
      return Response.json({ success: true, message: `Email sent to ${remote.email}`, job: updated });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({ async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let sent = 0; let skipped = 0;
      for (const jobId of ids) {
        try {
          const existing = await prisma.job.findFirst({ where: { userId, originalId: jobId }, select: { emailSent: true } });
          if (existing?.emailSent) { skipped++; send({ type: "progress", sent, skipped, total: ids.length, jobId, status: "skipped" }); continue; }
          const remote = await resolveRemote(userId, jobId);
          if (!remote?.email) { skipped++; send({ type: "progress", sent, skipped, total: ids.length, jobId, status: "skipped" }); continue; }
          const text = applyTemplate(template, { title: remote.title, company: remote.company, email: remote.email, highlights, signature });
          await sendEmail({ to: remote.email, subject: `Application for ${remote.title} — ${remote.company}`, text, html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${text}</div>` });
          await upsertJobOverlay(userId, remote, { emailSent: true, emailSentAt: new Date(), status: "emailed" });
          sent++; send({ type: "progress", sent, skipped, total: ids.length, jobId, status: "sent", title: remote.title, company: remote.company });
        } catch (error) { skipped++; send({ type: "progress", sent, skipped, total: ids.length, jobId, status: "failed", error: error instanceof Error ? error.message : "Send failed" }); }
      }
      send({ type: "done", sent, skipped, total: ids.length }); controller.close();
    } });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
  } catch (err) {
    console.error("[jobs/email] failed:", err);
    return Response.json({ error: err instanceof Error ? err.message : "Failed to send email" }, { status: 500 });
  }
}
