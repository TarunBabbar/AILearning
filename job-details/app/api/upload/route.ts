import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/auth";
import { extractJobsFromText } from "@/lib/extract-jobs";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * POST /api/upload
 * Body: { fileName, text } — text is the PDF/doc text extracted in the browser.
 * Runs LLM extraction and persists jobs to the database.
 * Requires an admin session (credentials from .env).
 */
export async function POST(req: Request) {
  try {
    const admin = await isAdminRequest();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Admin access required to upload jobs. Sign in with the admin credentials from the environment.",
        },
        { status: 403 }
      );
    }

    const { fileName, text, model } = (await req.json()) as {
      fileName?: string;
      text?: string;
      model?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Extracted text is empty or too short to parse." },
        { status: 400 }
      );
    }

    const { apiKey, source } = resolveApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key configured. Set OPENROUTER_API_KEY in the environment." },
        { status: 400 }
      );
    }

    const cfg = getConfig();
    const useModel = model || cfg.llmModel;

    const jobs = await extractJobsFromText(text, apiKey, useModel);

    if (!jobs.length) {
      return NextResponse.json(
        { error: "No jobs could be extracted from this file. It may not contain job listings." },
        { status: 422 }
      );
    }

    // Save to DB (dedupe by title|email|company against existing rows)
    const existing = await prisma.job.findMany({
      select: { title: true, email: true, company: true },
    });
    const existingKeys = new Set(
      existing.map((j) => `${j.title}|${j.email ?? ""}|${j.company}`.toLowerCase())
    );

    let added = 0;
    const newJobs = jobs
      .filter((j) => {
        const key = `${j.title}|${j.email}|${j.company}`.toLowerCase();
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      })
      .slice(0, cfg.maxJobs);

    if (newJobs.length) {
      await prisma.job.createMany({
        data: newJobs.map((j) => ({
          title: j.title,
          company: j.company,
          email: j.email || null,
          location: j.location || null,
          experience: j.experience || null,
          description: j.description || null,
          fileName: fileName || null,
          status: "new",
        })),
      });
      added = newJobs.length;
    }

    const total = await prisma.job.count();

    return NextResponse.json({
      message: `Extracted ${jobs.length} job(s), added ${added} new. Total jobs: ${total}.`,
      extracted: jobs.length,
      added,
      total,
      apiKeySource: source,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("[upload] error:", e);
    const status =
      message.includes("401") || message.includes("API key") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
