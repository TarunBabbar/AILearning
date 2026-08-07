import { resolveApiKey } from "@/lib/auth";
import { extractJobsFromText } from "@/lib/extract-jobs";
import { parseJobDate } from "@/lib/extract";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { createLogger, type LogEvent } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/upload
 * Body: { fileName, text } — text is the PDF/doc text extracted in the browser.
 * Runs LLM extraction and persists jobs to the database.
 * Requires an admin session (credentials from .env).
 *
 * Returns an NDJSON stream so the client can show live progress:
 *   {"type":"progress","event":{...}}  — step updates
 *   {"type":"result","data":{...}}     — final result
 *   {"type":"error","message":"..."}   — fatal error
 */
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // client went away — stop streaming
        }
      };
      const progress = (message: string, detail?: string) => {
        send({ type: "progress", message, detail });
      };

      const log = createLogger((ev: LogEvent) => {
        send({ type: "log", event: ev });
      });

      try {
        const admin = await isAdminRequest();
        if (!admin) {
          send({
            type: "error",
            message:
              "Admin access required to upload jobs. Sign in with the admin credentials from the environment.",
          });
          controller.close();
          return;
        }

        const body = await req.json();
        const { fileName, text, model } = body as {
          fileName?: string;
          text?: string;
          model?: string;
        };

        if (!text || typeof text !== "string" || text.trim().length < 50) {
          send({ type: "error", message: "Extracted text is empty or too short to parse." });
          controller.close();
          return;
        }

        const { apiKey, source } = resolveApiKey();
        if (!apiKey) {
          send({
            type: "error",
            message:
              "No OpenRouter API key configured. Set OPENROUTER_API_KEY in the environment.",
          });
          controller.close();
          return;
        }

        const cfg = getConfig();
        const useModel = model || cfg.llmModel;

        log.info("upload", "Upload received", `file=${fileName ?? "unknown"} source=${source}`);
        progress(
          `Connected — OpenRouter key OK (${source === "env" ? "server env" : "configured"}).`
        );

        // ── LLM extraction with live progress ────────────────
        const jobs = await extractJobsFromText(text, apiKey, useModel, {
          log,
          onProgress: (p) => progress(p.message),
        });

        if (!jobs.length) {
          send({
            type: "error",
            message:
              "No jobs could be extracted from this file. It may not contain job listings.",
          });
          controller.close();
          return;
        }

        log.info("upload", "Extraction complete, saving to database", `${jobs.length} job(s)`);
        progress(`Extraction complete — ${jobs.length} job(s) found. Saving to database…`);

        // ── Persist (dedupe by title|email|company) ──────────
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
              // Prefer the date the LLM found in the doc; fall back to a
              // date parsed from the filename (e.g. "6+ Years - 07-Aug.pdf").
              jobDate: j.jobDate ?? parseJobDate(fileName),
              status: "new",
            })),
          });
          added = newJobs.length;
          log.info(
            "upload",
            "Saved to database",
            `${added} new (${jobs.length - added} duplicate(s) skipped)`
          );
          progress(`${added} new job(s) saved to the database.`);
        } else {
          log.info("upload", "No new jobs to save", "all were duplicates");
          progress("All jobs already exist — nothing new added.");
        }

        const total = await prisma.job.count();
        log.info("upload", "Done", `total jobs in DB: ${total}`);

        send({
          type: "result",
          data: {
            message: `Extracted ${jobs.length} job(s), added ${added} new. Total jobs: ${total}.`,
            extracted: jobs.length,
            added,
            total,
            apiKeySource: source,
          },
        });
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed";
        log.error("upload", "Upload failed", message);
        send({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
