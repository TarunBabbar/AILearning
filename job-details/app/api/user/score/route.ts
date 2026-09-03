import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { getUserForLog, logUserAction } from "@/lib/action-log";
import { resolveApiKey } from "@/lib/auth";
import { nonGenericEmailWhere } from "@/lib/company";
import {
  jobsSearchWhere,
  parallelWaveCapacity,
  rankJobsByResumeRelevance,
  scoreJobsParallel,
  type ScoreJobInput,
} from "@/lib/score-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Floor for the first wave so a run always surfaces ≥ this many results quickly. */
const MIN_FIRST_WAVE = 20;

type ScoreBody = {
  scope?: string;
  search?: string;
  /** Only score jobs from the last N days (jobDate-based). Omit/0 = all. */
  days?: number;
};

/**
 * POST /api/user/score
 * Body: { scope?: "unscored" | "all", search?: string, days?: number }
 *
 * Streams NDJSON progress as each model chunk is saved:
 *   {"type":"start",...}
 *   {"type":"progress","scoredDelta":10,"completedInRun":...,"remaining":...}
 *   {"type":"done",...} | {"type":"error",...}
 *
 * Call repeatedly until done=true.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ScoreBody;
  const scope = body.scope === "all" ? "all" : "unscored";
  const search = (body.search || "").trim();
  const days = Number.isFinite(body.days) && body.days! > 0 ? Math.floor(body.days!) : 0;

  const resume = await prisma.resume.findUnique({ where: { userId } });
  if (!resume?.content) {
    return NextResponse.json(
      { error: "Upload a resume first." },
      { status: 400 }
    );
  }

  const { apiKey } = resolveApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Scoring is temporarily unavailable. Please try again later." },
      { status: 400 }
    );
  }

  const where = jobsSearchWhere(search);
  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const andList = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...andList,
      { OR: [{ jobDate: { gte: cutoff } }, { createdAt: { gte: cutoff } }] },
    ];
  }
  const allMatching = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      company: true,
      description: true,
      jobDate: true,
      createdAt: true,
    },
    orderBy: [{ jobDate: "desc" }, { createdAt: "desc" }],
  });

  let candidates: ScoreJobInput[] = allMatching;
  if (scope === "unscored") {
    const scoredIds = new Set(
      (
        await prisma.jobScore.findMany({
          where: { userId, jobId: { in: allMatching.map((j) => j.id) } },
          select: { jobId: true },
        })
      ).map((s) => s.jobId)
    );
    candidates = allMatching.filter((j) => !scoredIds.has(j.id));
  }

  // No search filter → score the most resume-relevant jobs first so the
  // first wave surfaces the highest-probability matches quickly.
  if (!search) {
    candidates = rankJobsByResumeRelevance(resume.content, candidates);
  }

  const totalMatching = allMatching.length;
  const remainingBefore = candidates.length;
  const capacity = Math.max(await parallelWaveCapacity(), MIN_FIRST_WAVE);
  const wave = candidates.slice(0, capacity);

  const user = await getUserForLog(userId);
  logUserAction(
    user,
    "score.run",
    `scope=${scope}${search ? ` search="${search}"` : ""} → ${wave.length} jobs this wave (${totalMatching} matching, ${remainingBefore} remaining)`
  );

  if (!wave.length) {
    const scoredCount = await prisma.jobScore.count({
      where: { userId, job: nonGenericEmailWhere() },
    });
    return NextResponse.json({
      type: "done",
      scored: 0,
      attempted: 0,
      remaining: 0,
      totalMatching,
      scoredCount,
      done: true,
      modelCount: 0,
      message: "Nothing left to score.",
    });
  }

  const encoder = new TextEncoder();
  // Total already-scored count BEFORE this run, so progress events can report
  // the cumulative "scored" number (base + newly scored) live to the client.
  const preRunScored = await prisma.jobScore.count({
    where: { userId, job: nonGenericEmailWhere() },
  });
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        send({
          type: "start",
          attempted: wave.length,
          remainingBefore,
          totalMatching,
          scored: preRunScored,
        });

        const result = await scoreJobsParallel(
          resume.content,
          wave,
          apiKey,
          userId,
          async ({ scoredDelta, scoredInWave }) => {
            send({
              type: "progress",
              scoredDelta,
              scoredInWave,
              scored: preRunScored + scoredInWave,
              remaining: Math.max(0, remainingBefore - scoredInWave),
              totalMatching,
            });
          },
          scope === "all" ? "all" : "unscored"
        );

        const scoredCount = await prisma.jobScore.count({
          where: { userId, job: nonGenericEmailWhere() },
        });
        const stillUnscored =
          scope === "unscored"
            ? Math.max(0, remainingBefore - result.scored)
            : Math.max(0, remainingBefore - wave.length);
        const failedCount =
          scope === "unscored"
            ? Math.max(0, result.attempted - result.scored)
            : 0;

        if (result.attempted > 0 && result.scored === 0) {
          send({
            type: "error",
            error:
              "Scoring didn't complete this round. Please try again in a moment.",
            scored: 0,
            attempted: result.attempted,
            remaining: stillUnscored,
            totalMatching,
            scoredCount,
            failedCount,
            done: false,
          });
          return;
        }

        send({
          type: "done",
          scored: result.scored,
          attempted: result.attempted,
          remaining: stillUnscored,
          totalMatching,
          scoredCount,
          failedCount,
          done: stillUnscored === 0,
          message: `Wave complete: ${result.scored}/${result.attempted} jobs scored; ${stillUnscored} remaining${failedCount ? `; ${failedCount} failed — rerun to retry.` : ""}.`,
        });
      } catch (e) {
        console.error("[user/score]", e);
        send({
          type: "error",
          error:
            "Scoring is temporarily unavailable. Please try again in a moment.",
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
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * GET /api/user/score?search=&days=
 * Preview counts + ETA using parallel waves. `days` scopes to recent jobs.
 */
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const daysParam = Number(url.searchParams.get("days")) || 0;
    const days = daysParam > 0 ? Math.floor(daysParam) : 0;
    const where = jobsSearchWhere(search);
    if (days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const andList = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [
        ...andList,
        { OR: [{ jobDate: { gte: cutoff } }, { createdAt: { gte: cutoff } }] },
      ];
    }

    const [totalMatching, scoredRows, capacity] = await Promise.all([
      prisma.job.count({ where }),
      // Scope scored rows to the same job set as `totalMatching` — otherwise
      // old scores (outside the days window) inflate the scored count and
      // `unscored` undercounts recent jobs (Score button wrongly disabled).
      prisma.jobScore.findMany({
        where: {
          userId,
          job: { AND: [nonGenericEmailWhere(), where] },
        },
        select: { jobId: true },
      }),
      parallelWaveCapacity(),
    ]);

    const scoredIds = new Set(scoredRows.map((s) => s.jobId));
    let unscored = totalMatching;
    if (!search) {
      unscored = Math.max(0, totalMatching - scoredIds.size);
    } else {
      const matching = await prisma.job.findMany({
        where,
        select: { id: true },
      });
      unscored = matching.filter((j) => !scoredIds.has(j.id)).length;
    }

    // ETA: ~30s per parallel wave of `capacity` jobs
    const waves = Math.max(1, Math.ceil(unscored / Math.max(capacity, 1)));
    const estMinutesUnscored = Math.max(1, Math.ceil((waves * 30) / 60));

    return NextResponse.json({
      totalMatching,
      scoredCount: scoredIds.size,
      unscored,
      estMinutesUnscored,
    });
  } catch (e) {
    console.error("[user/score GET]", e);
    return NextResponse.json({ error: "Failed to load score stats." }, { status: 500 });
  }
}
