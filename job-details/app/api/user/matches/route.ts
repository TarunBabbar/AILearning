import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { companyFilterWhere, nonGenericEmailWhere } from "@/lib/company";
import type { Prisma } from "@prisma-generated/client";

export const runtime = "nodejs";

const REMOTE_LOCATION_PATTERNS = [
  "remote",
  "wfh",
  "work from home",
  "work-from-home",
  "home based",
  "home-based",
  "hybrid",
  "anywhere",
];

/**
 * GET /api/user/matches
 * Query:
 *   minScore=0|50|70|…
 *   search=   (title/company/location)
 *   company=
 *   location=
 *   remote=1  (location looks like remote / WFH / hybrid / home)
 *   sort=score|company|location  (default score)
 *   order=asc|desc              (default desc for score, asc for text)
 *   page=1
 *   pageSize=40
 */
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const url = new URL(req.url);
    const minScore = Math.max(
      0,
      Math.min(100, parseInt(url.searchParams.get("minScore") || "0", 10) || 0)
    );
    const search = url.searchParams.get("search")?.trim() || "";
    const company = url.searchParams.get("company")?.trim() || "";
    const location = url.searchParams.get("location")?.trim() || "";
    const remoteOnly =
      url.searchParams.get("remote") === "1" ||
      url.searchParams.get("remote") === "true";
    const sortRaw = (url.searchParams.get("sort") || "score").toLowerCase();
    const sort =
      sortRaw === "company" || sortRaw === "location" ? sortRaw : "score";
    const orderRaw = (url.searchParams.get("order") || "").toLowerCase();
    const order: "asc" | "desc" =
      orderRaw === "asc" || orderRaw === "desc"
        ? orderRaw
        : sort === "score"
          ? "desc"
          : "asc";

    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") || "40", 10) || 40)
    );
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

    const jobAnd: Prisma.JobWhereInput[] = [];
    if (search) {
      jobAnd.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (company) {
      jobAnd.push(companyFilterWhere(company));
    }
    if (location) {
      jobAnd.push({ location: { equals: location, mode: "insensitive" } });
    }
    if (remoteOnly) {
      jobAnd.push({
        OR: REMOTE_LOCATION_PATTERNS.map((p) => ({
          location: { contains: p, mode: "insensitive" as const },
        })),
      });
    }

    const where: Prisma.JobScoreWhereInput = {
      userId,
      score: { gte: minScore },
      job: {
        AND: [nonGenericEmailWhere(), ...jobAnd],
      },
    };

    const orderBy: Prisma.JobScoreOrderByWithRelationInput[] =
      sort === "company"
        ? [{ job: { company: order } }, { score: "desc" }]
        : sort === "location"
          ? [{ job: { location: order } }, { score: "desc" }]
          : [{ score: order }, { scoredAt: "desc" }];

    const total = await prisma.jobScore.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);

    const rows = await prisma.jobScore.findMany({
      where,
      orderBy,
      include: { job: true },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    });

    const matches = rows.map((r) => {
      const job = sanitizeJobForDisplay({ ...r.job, companyInfo: null });
      return {
        id: r.id,
        score: r.score,
        strengths: r.strengths,
        gaps: r.gaps,
        scoredAt: r.scoredAt,
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          experience: job.experience,
          email: job.email,
          description: job.description,
          jobDate: job.jobDate,
        },
      };
    });

    return NextResponse.json(
      {
        total,
        page: safePage,
        pageSize,
        pageCount,
        matches,
        filters: {
          minScore,
          search,
          company,
          location,
          remote: remoteOnly,
          sort,
          order,
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (e) {
    console.error("[user/matches]", e);
    return NextResponse.json({ error: "Failed to load matches." }, { status: 500 });
  }
}
