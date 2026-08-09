import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { getTopicsStats } from "@/lib/topics-data";
import { countJobStats } from "@/lib/job-overlay";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { topics, qaPairs } = getTopicsStats();

  const [documents, jobs, projects, jobCounts] = await Promise.all([
    prisma.document.count({ where: { userId } }),
    // Strong matches only (dashboard "Jobs" stat)
    prisma.job.count({ where: { userId, score: { gte: 60 }, status: { not: "deleted" } } }),
    prisma.project.count({ where: { userId } }),
    // Scored / strong totals come from the same table in one groupBy
    countJobStats(userId),
  ]);

  return Response.json(
    { documents, qaPairs, jobs: jobCounts.strong || jobs, topics, projects },
    {
      headers: {
        // 15s browser cache + 60s CDN stale-while-revalidate; per-user safe
        // because responses are still keyed by the session cookie.
        "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300, max-age=15",
      },
    }
  );
}
