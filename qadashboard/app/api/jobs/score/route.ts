import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import {
  fetchRemoteJobs,
  fetchRemoteJobsForScoring,
  fetchRemoteJobByIds,
} from "@/lib/job-board-api";
import { loadOverlaysByOriginalIds, countJobStats } from "@/lib/job-overlay";
import {
  parallelWaveCapacity,
  scoreJobsAcrossModels,
  scoringModelIds,
  SCORE_JOBS_PER_MODEL,
  STRONG_MATCH_MIN,
} from "@/lib/score-jobs";

export const maxDuration = 300;

type ScoreBody = {
  scope?: "unscored" | "all";
  search?: string;
  /** Cap wave size; default = models × 10 from LLM_MODELS_JSON. */
  limit?: number;
};

const TICKERS = [
  "Dispatching jobs across free models…",
  "Checking jobs against your profile…",
  "Parsing job descriptions…",
  "Scoring in parallel on multiple models…",
  "Looking for matches ≥60%…",
  "Comparing skills and experience…",
  "Saving strong matches to your database…",
  "Ranking opportunities by fit…",
];

/**
 * POST /api/jobs/score
 * Parallel multi-model scoring (LLM_MODELS_JSON): ~10 jobs per model.
 * Streams NDJSON; only ≥60% matches are kept for the Matches UI.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as ScoreBody;
  const scope = body.scope === "all" ? "all" : "unscored";
  const search = (body.search || "").trim();

  const models = scoringModelIds();
  const capacity = parallelWaveCapacity();
  const limit = Math.min(
    capacity,
    Math.max(1, body.limit ?? capacity)
  );

  const resume = await prisma.resume.findFirst({ where: { userId } });
  if (!resume?.content) {
    return Response.json({ error: "Upload a resume first" }, { status: 400 });
  }
  if (!models.length) {
    return Response.json(
      { error: "No free models configured in LLM_MODELS_JSON" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* closed */
        }
      };

      let tickerIdx = 0;
      const nextTicker = () => TICKERS[tickerIdx++ % TICKERS.length];

      try {
        send({
          type: "status",
          phase: "loading",
          percent: 2,
          message: "Connecting to job board…",
          ticker: nextTicker(),
          modelCount: models.length,
          jobsPerModel: SCORE_JOBS_PER_MODEL,
        });

        let boardTotal = 0;
        try {
          const head = await fetchRemoteJobs({
            page: 1,
            pageSize: 1,
            search: search || undefined,
            fresh: false,
          });
          boardTotal = head.total || 0;
        } catch {
          boardTotal = 0;
        }

        const already = await countJobStats(userId);
        const alreadyProcessed = already.scored;
        const alreadyStrong = already.strong;

        send({
          type: "status",
          phase: "loading",
          percent:
            boardTotal > 0
              ? Math.min(99, Math.max(1, Math.round((alreadyProcessed / boardTotal) * 100)))
              : 5,
          boardTotal,
          processedTotal: alreadyProcessed,
          strongTotal: alreadyStrong,
          strongMatches: 0,
          modelCount: models.length,
          jobsPerModel: SCORE_JOBS_PER_MODEL,
          message: boardTotal
            ? `Found ${boardTotal.toLocaleString()} jobs in the database`
            : "Loading board jobs…",
          ticker: nextTicker(),
          detail: `${models.length} models · ${SCORE_JOBS_PER_MODEL} jobs each · up to ${capacity} / wave`,
        });

        const fetchCap = Math.min(limit * 3, capacity * 2 + 100);
        const remote = await fetchRemoteJobsForScoring({
          maxJobs: fetchCap,
          search: search || undefined,
        });

        send({
          type: "status",
          phase: "parsing",
          percent: 12,
          boardTotal,
          processedTotal: alreadyProcessed,
          strongTotal: alreadyStrong,
          parsed: remote.length,
          message: `Parsed ${remote.length} listings · assigning to ${models.length} models`,
          ticker: nextTicker(),
          detail: `Jobs parsed ${remote.length}${boardTotal ? ` · board ${boardTotal.toLocaleString()}` : ""}`,
        });

        const overlays = await loadOverlaysByOriginalIds(
          userId,
          remote.map((j) => j.id)
        );

        let candidates =
          scope === "unscored"
            ? remote.filter((j) => {
                const o = overlays.get(j.id);
                return !o || o.score == null;
              })
            : remote;

        candidates = candidates.slice(0, limit);

        if (candidates.length === 0) {
          const counts = await countJobStats(userId);
          send({
            type: "done",
            scored: 0,
            attempted: 0,
            strongMatches: 0,
            scoredCount: counts.scored,
            strongCount: counts.strong,
            boardTotal,
            modelCount: models.length,
            percent: 100,
            done: true,
            message: "Nothing left to score in this wave.",
            ticker: "All caught up for now",
          });
          controller.close();
          return;
        }

        const chunkCount = Math.ceil(candidates.length / SCORE_JOBS_PER_MODEL);

        send({
          type: "status",
          phase: "enrich",
          percent: 18,
          boardTotal,
          processedTotal: alreadyProcessed,
          strongTotal: alreadyStrong,
          attempted: candidates.length,
          modelCount: models.length,
          jobsPerModel: SCORE_JOBS_PER_MODEL,
          message: `Scoring ${candidates.length} jobs across ${Math.min(chunkCount, models.length)} models in parallel`,
          ticker: nextTicker(),
          detail: `~${SCORE_JOBS_PER_MODEL} jobs / model · only ≥${STRONG_MATCH_MIN}% saved as matches`,
        });

        const enriched = await fetchRemoteJobByIds(candidates);

        send({
          type: "status",
          phase: "scoring",
          percent: 22,
          boardTotal,
          processedTotal: alreadyProcessed,
          strongTotal: alreadyStrong,
          attempted: enriched.length,
          parsed: enriched.length,
          modelCount: models.length,
          message: "Parallel scoring started…",
          ticker: nextTicker(),
          detail: `Models: ${models
            .slice(0, 4)
            .map((m) => m.split("/").pop()?.replace(":free", ""))
            .join(", ")}${models.length > 4 ? "…" : ""}`,
        });

        let lastCompleted = 0;

        const result = await scoreJobsAcrossModels(
          resume.content,
          enriched,
          userId,
          async (info) => {
            lastCompleted = info.attemptedInWave;
            const processedTotal = alreadyProcessed + info.attemptedInWave;
            const strongTotal = alreadyStrong + info.strongMatches;
            // % of full board processed (not current wave)
            const percent =
              boardTotal > 0
                ? Math.min(99, Math.max(1, Math.round((processedTotal / boardTotal) * 100)))
                : Math.min(
                    99,
                    Math.round((info.attemptedInWave / Math.max(1, enriched.length)) * 100)
                  );

            if (info.match) {
              send({
                type: "match",
                job: info.match,
                strongMatches: info.strongMatches,
                strongTotal,
                processedTotal,
                boardTotal,
                model: info.model,
              });
            }

            send({
              type: "progress",
              phase: "scoring",
              percent,
              boardTotal,
              attempted: enriched.length,
              completed: info.attemptedInWave,
              scored: info.attemptedInWave,
              strongMatches: info.strongMatches,
              processedTotal,
              strongTotal,
              parsed: enriched.length,
              model: info.model,
              modelCount: models.length,
              jobsPerModel: SCORE_JOBS_PER_MODEL,
              message: `Processed ${processedTotal.toLocaleString()}${boardTotal ? ` of ${boardTotal.toLocaleString()}` : ""} jobs`,
              ticker: nextTicker(),
              detail: `${strongTotal} matches ≥${STRONG_MATCH_MIN}% so far`,
            });
          }
        );

        const finalCounts = await countJobStats(userId);
        const scoredCount = finalCounts.scored;
        const strongCount = finalCounts.strong;

        if (result.scored === 0 && result.failedModels.length === models.length) {
          send({
            type: "error",
            error:
              "All models failed to score. Check OpenRouter key / free model availability.",
            scored: 0,
            attempted: enriched.length,
            scoredCount,
            strongCount,
            boardTotal,
            modelsUsed: result.modelsUsed,
            failedModels: result.failedModels,
          });
        } else {
          send({
            type: "done",
            scored: result.scored,
            attempted: result.attempted,
            strongMatches: result.strongMatches,
            scoredCount,
            strongCount,
            boardTotal,
            processedTotal: scoredCount,
            strongTotal: strongCount,
            modelCount: result.modelCount,
            modelsUsed: result.modelsUsed,
            failedModels: result.failedModels,
            jobsPerModel: SCORE_JOBS_PER_MODEL,
            percent: 100,
            done: true,
            completed: lastCompleted || result.scored,
            message: `Done — processed ${scoredCount.toLocaleString()} jobs · ${strongCount} matches (≥${STRONG_MATCH_MIN}%).`,
            ticker: "Wave complete",
            detail: boardTotal
              ? `Processed ${scoredCount.toLocaleString()} of ${boardTotal.toLocaleString()} jobs`
              : `${strongCount} strong matches saved`,
          });
        }
      } catch (err) {
        console.error("[jobs/score] failed:", err);
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Scoring failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
