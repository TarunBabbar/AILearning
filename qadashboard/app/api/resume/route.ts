import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { extractText } from "@/lib/file-parse";
import { extractResumeHighlights, extractResumeName } from "@/lib/resume-extract";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const form = await req.formData();
    const file = form.get("resume") as File | null;
    if (!file) return Response.json({ error: "No file" }, { status: 400 });

    const { text, type } = await extractText(file);
    const highlights = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-•*\s]+/, "").trim())
      .filter((line) => line.length >= 20 && line.length <= 180)
      .slice(0, 3)
      .join("\n");

    // Upsert: one resume per user
    const existing = await prisma.resume.findFirst({ where: { userId } });
    const resume = existing
      ? await prisma.resume.update({
          where: { id: existing.id },
          data: { filename: file.name, content: text, highlights, type },
        })
      : await prisma.resume.create({
          data: { userId, filename: file.name, content: text, highlights, type },
        });

    return Response.json({
      filename: resume.filename,
      size: text.length,
      characters: text.length,
      uploadedAt: resume.createdAt,
    });
  } catch (err) {
    console.error("[resume] upload failed:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const resume = await prisma.resume.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!resume) {
    return Response.json({ resume: null });
  }
  const nameFromResume = extractResumeName(resume.content);
  const storedHighlights = (resume.highlights || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const skillLines = storedHighlights.length ? storedHighlights : extractResumeHighlights(resume.content);
  return Response.json({
    resume: { filename: resume.filename, size: resume.content.length, createdAt: resume.createdAt, highlights: skillLines.join("\n") || null, name: nameFromResume || null },
  });
}
