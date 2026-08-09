import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { fetchRemoteJobs } from "@/lib/job-board-api";
import {
  loadOverlaysByOriginalIds,
  mergeRemoteWithOverlay,
  countJobStats,
} from "@/lib/job-overlay";

/** Slim list payload — full description loads in the detail modal; strengths
 * stay because cards use them as the highlighted match-summary line. */
const LIST_SELECT = {
  id: true,
  title: true,
  company: true,
  email: true,
  location: true,
  experience: true,
  status: true,
  score: true,
  strengths: true,
  emailSent: true,
  emailSentAt: true,
  originalId: true,
  createdAt: true,
} as const;

function searchWhere(search: string) {
  if (!search) return undefined;
  const q = search.trim();
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { company: { contains: q, mode: "insensitive" as const } },
      { location: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

/**
 * GET /api/jobs
 * Lists jobs from JOB_DETAILS_API_BASE and merges local score/status overlays.
 *
 * Query: page, pageSize, search, sort, company, status (remote status),
 *        scoredOnly=1, minScore=, localStatus= (pipeline filter on overlays)
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "40", 10) || 40)
  );
  const search = searchParams.get("search")?.trim() || "";
  const sort = searchParams.get("sort")?.trim() || "newest";
  const company = searchParams.get("company")?.trim() || "";
  const remoteStatus = searchParams.get("status")?.trim() || "";
  const localStatus = searchParams.get("localStatus")?.trim() || "";
  const scoredOnly =
    searchParams.get("scoredOnly") === "1" || searchParams.get("scoredOnly") === "true";
  const minScore = Math.max(0, parseInt(searchParams.get("minScore") || "0", 10) || 0);

  try {
    // Email agent / scored inbox: local overlays that already have scores.
    if (searchParams.get("view") === "scored") {
      const overlayWhere = {
        userId,
        originalId: { not: null },
        score: { not: null },
        ...(minScore > 0 ? { score: { gte: minScore } } : {}),
        status: { not: "deleted" },
        ...(search ? searchWhere(search) : {}),
      };
      const overlays = await prisma.job.findMany({
        where: overlayWhere,
        select: LIST_SELECT,
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await prisma.job.count({ where: overlayWhere });
      const { scored: scoredCount, strong: strongCount } = await countJobStats(userId);
      const jobs = overlays.map((o) => ({
        id: o.originalId as string,
        title: o.title,
        company: o.company,
        email: o.email,
        location: o.location,
        experience: o.experience,
        strengths: o.strengths,
        status: o.status,
        score: o.score,
        emailSent: o.emailSent,
        emailSentAt: o.emailSentAt?.toISOString() ?? null,
        originalId: o.originalId as string,
        localId: o.id,
        createdAt: o.createdAt.toISOString(),
      }));
      return Response.json(
        {
          jobs,
          total,
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          scoredCount,
          strongCount,
          source: "local-scored",
        },
        {
          headers: {
            // s-maxage lets Vercel's shared cache serve repeat list hits for
            // up to 60s without a DB round-trip; max-age keeps the browser
            // fresh for 10s. Per-user safety: session cookie still keys it.
            "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300, max-age=10",
          },
        }
      );
    }

    // Pipeline-only views: read from local overlays, then shape like board jobs.
    if (localStatus && localStatus !== "all" && localStatus !== "new") {
      const overlayWhere = {
        userId,
        status: localStatus,
        originalId: { not: null },
        ...(scoredOnly || minScore > 0
          ? { score: { gte: minScore > 0 ? minScore : 0 } }
          : {}),
        ...(search ? searchWhere(search) : {}),
      };
      const overlays = await prisma.job.findMany({
        where: overlayWhere,
        select: LIST_SELECT,
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await prisma.job.count({ where: overlayWhere });
      const { scored: scoredCount, strong: strongCount } = await countJobStats(userId);
      const jobs = overlays.map((o) => ({
        id: o.originalId as string,
        title: o.title,
        company: o.company,
        email: o.email,
        location: o.location,
        experience: o.experience,
        strengths: o.strengths,
        status: o.status,
        score: o.score,
        emailSent: o.emailSent,
        emailSentAt: o.emailSentAt?.toISOString() ?? null,
        originalId: o.originalId as string,
        localId: o.id,
        createdAt: o.createdAt.toISOString(),
      }));
      return Response.json(
        {
          jobs,
          total,
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          scoredCount,
          strongCount,
          source: "local",
        },
        {
          headers: { "Cache-Control": "private, max-age=10" },
        }
      );
    }

    const remote = await fetchRemoteJobs({
      page,
      pageSize,
      search,
      sort,
      company,
      status: remoteStatus || undefined,
    });

    const overlays = await loadOverlaysByOriginalIds(
      userId,
      remote.jobs.map((j) => j.id)
    );

    let jobs = remote.jobs.map((rj) =>
      mergeRemoteWithOverlay(rj, overlays.get(rj.id) || null)
    );

    if (scoredOnly) {
      jobs = jobs.filter((j) => j.score != null);
    }
    if (minScore > 0) {
      jobs = jobs.filter((j) => (j.score ?? 0) >= minScore);
    }
    if (localStatus === "new") {
      jobs = jobs.filter((j) => j.status === "new");
    }

    const { scored: scoredCount } = await countJobStats(userId);

    return Response.json(
      {
        jobs,
        total: remote.total,
        page: remote.page,
        pageSize: remote.pageSize,
        pageCount: remote.pageCount,
        companyCount: remote.companyCount,
        sourceCount: remote.sourceCount,
        scoredCount,
        source: "job-board",
      },
      {
        headers: { "Cache-Control": "private, max-age=10" },
      }
    );
  } catch (err) {
    console.error("[jobs] list failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load jobs" },
      { status: 502 }
    );
  }
}

/** Local PDF upload kept as optional fallback — prefer remote job board. */
export async function POST() {
  return Response.json(
    {
      error:
        "Job PDF upload is disabled here. Jobs are loaded from the configured job board (JOB_DETAILS_API_BASE). Upload your resume, then run Score Matches.",
    },
    { status: 410 }
  );
}
