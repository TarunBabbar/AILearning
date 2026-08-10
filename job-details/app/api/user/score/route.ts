import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { resolveApiKey } from "@/lib/auth";
import {
  jobsSearchWhere,
  parallelWaveCapacity,
  scoreJobsParallel,
} from "@/lib/score-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

type ScoreBody = {
  scope?: string;
  search?: string;
};

/**
 * POST /api/user/score
 * Body: { scope?: "unscored" | "all", search?: string }
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
  const allMatching = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      company: true,
      description: true,
    },
    orderBy: [{ jobDate: "desc" }, { createdAt: "desc" }],
  });

  let candidates = allMatching;
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

  const totalMatching = allMatching.length;
  const remainingBefore = candidates.length;
  const capacity = await parallelWaveCapacity();
  const wave = candidates.slice(0, capacity);

  if (!wave.length) {
    const scoredCount = await prisma.jobScore.count({ where: { userId } });
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
              remaining: Math.max(0, remainingBefore - scoredInWave),
              totalMatching,
            });
          }
        );

        const scoredCount = await prisma.jobScore.count({ where: { userId } });
        const stillUnscored =
          scope === "unscored"
            ? Math.max(0, remainingBefore - result.scored)
            : Math.max(0, remainingBefore - wave.length);

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
          done: stillUnscored === 0,
          message: `Wave complete: ${result.scored}/${result.attempted} jobs scored; ${stillUnscored} remaining.`,
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
 * GET /api/user/score?search=
 * Preview counts + ETA using parallel free-model waves.
 */
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const where = jobsSearchWhere(search);

    const [totalMatching, scoredRows, capacity] = await Promise.all([
      prisma.job.count({ where }),
      prisma.jobScore.findMany({
        where: { userId },
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
