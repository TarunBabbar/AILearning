import { resolveApiKey } from "@/lib/auth";
import { extractJobsFromText } from "@/lib/extract-jobs";
import { parseJobDate } from "@/lib/extract";
import { getConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { createLogger, type LogEvent } from "@/lib/logger";

export const runtime = "nodejs";
// LLM extraction can take minutes — allow the max function duration.
// Vercel Hobby: 300s max · Pro/Enterprise: 800s.
export const maxDuration = 300;

/**
 * Build a normalized duplicate key for a job: lowercase company +
 * punctuation-stripped, whitespace-collapsed description. This is the
 * strongest "same job posting" signal — a re-uploaded PDF (or the same job
 * extracted by different models) yields the same key even when punctuation
 * differs (e.g. "Frameworks." vs "Frameworks").
 */
function dupKey(company: string, description: string): string {
  const c = (company || "").trim().toLowerCase();
  const d = (description || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
  return `${c}||${d}`;
}

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

      // Heartbeat: keep the stream alive during long LLM calls so the
      // browser connection never idles out, no matter how long extraction
      // takes (minutes or hours). Cleared when the stream ends.
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const startHeartbeat = () => {
        if (heartbeat) return;
        heartbeat = setInterval(() => {
          send({ type: "heartbeat", ts: new Date().toISOString() });
        }, 15000);
      };
      const stopHeartbeat = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      };

      try {
        startHeartbeat();

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
        // Server-side cap so a malicious client can't push a giant payload
        // through the LLM extraction pipeline (~5MB of text).
        if (text.length > 5_000_000) {
          send({ type: "error", message: "Uploaded text is too large (max 5MB)." });
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

        // Dedupe on the strongest signal for "same job posting":
        // company + normalized description. A re-upload of the same PDF
        // (or same job appearing twice) yields the same company+description,
        // so it's counted as a duplicate and NOT re-saved.
        const existing = await prisma.job.findMany({
          select: { company: true, description: true },
        });
        const existingKeys = new Set(
          existing.map((j) =>
            dupKey(j.company, j.description ?? "")
          )
        );
        let added = 0;
        let duplicateCount = 0;

        const saveJobs = async (jobs: Awaited<ReturnType<typeof extractJobsFromText>>) => {
          const newJobs: Awaited<ReturnType<typeof extractJobsFromText>> = [];
          for (const j of jobs) {
            const key = dupKey(j.company, j.description);
            if (existingKeys.has(key)) {
              duplicateCount++;
              continue;
            }
            existingKeys.add(key);
            newJobs.push(j);
          }

          const toInsert = newJobs.slice(0, cfg.maxJobs);
          if (toInsert.length) {
            await prisma.job.createMany({
              data: toInsert.map((j) => ({
                title: j.title,
                company: j.company,
                email: j.email || null,
                location: j.location || null,
                experience: j.experience || null,
                description: j.description || null,
                fileName: fileName || null,
                jobDate: j.jobDate ?? parseJobDate(fileName),
                status: "new",
              })),
            });
            added += toInsert.length;
            log.info(
              "upload",
              "Saved to database",
              `${toInsert.length} new · ${duplicateCount} duplicate(s) so far`
            );
            // Report CUMULATIVE totals (across all chunks so far), not the
            // per-chunk insert count.
            progress(
              `Extracted ${added} job(s) so far · ${duplicateCount} duplicate(s) skipped (added ${toInsert.length} in this chunk).`
            );
          }
        };

        // ── Parallel LLM extraction — each chunk is saved to the DB as
        //    soon as its response lands, no waiting for all chunks. ──
        let chunksTotalSent = false;
        const jobs = await extractJobsFromText(text, apiKey, useModel, {
          log,
          onProgress: (p) => {
            progress(p.message);
            // Send the chunk total up front so the client can render a
            // progress bar (0% → 100%) from the very start.
            if (!chunksTotalSent && p.totalChunks > 0) {
              chunksTotalSent = true;
              send({ type: "chunks", total: p.totalChunks });
            }
          },
          onChunk: async (chunkJobs) => saveJobs(chunkJobs),
        });

        const total = await prisma.job.count();
        log.info(
          "upload",
          "Done",
          `extracted ${jobs.length}, added ${added}, duplicates ${duplicateCount}, total ${total}`
        );

        send({
          type: "result",
          data: {
            message: `Extracted ${jobs.length} job(s): ${added} new, ${duplicateCount} duplicate(s). Total jobs: ${total}.`,
            extracted: jobs.length,
            added,
            duplicates: duplicateCount,
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
