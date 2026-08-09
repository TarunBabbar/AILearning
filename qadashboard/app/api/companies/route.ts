import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { fetchRemoteCompanies } from "@/lib/job-board-api";

/**
 * GET /api/companies
 * Paginated slim company list from JOB_DETAILS_API_BASE (+ local best scores).
 * Query: page, pageSize, search
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
  const search = searchParams.get("search")?.trim().toLowerCase() || "";

  try {
    const companies = await fetchRemoteCompanies();

    const overlays = await prisma.job.findMany({
      where: {
        userId,
        originalId: { not: null },
        score: { gte: 60 },
      },
      select: { company: true, score: true },
    });

    const bestByCompany = new Map<string, number>();
    for (const o of overlays) {
      const key = o.company.trim().toLowerCase();
      const prev = bestByCompany.get(key) ?? 0;
      if ((o.score ?? 0) > prev) bestByCompany.set(key, o.score ?? 0);
    }

    let enriched = companies.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      type: c.type,
      location: c.location,
      website: c.website,
      // omit description — it bloated the payload to 200KB+
      jobCount: c._count?.jobs ?? 0,
      maxScore: bestByCompany.get(c.name.trim().toLowerCase()) ?? null,
    }));

    if (search) {
      enriched = enriched.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.domain.toLowerCase().includes(search) ||
          (c.location || "").toLowerCase().includes(search)
      );
    }

    // Sort: best-scored companies first (highest maxScore), then by job count.
    enriched.sort((a, b) => {
      const aScore = a.maxScore ?? 0;
      const bScore = b.maxScore ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return b.jobCount - a.jobCount || a.name.localeCompare(b.name);
    });

    const total = enriched.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const slice = enriched.slice(start, start + pageSize);

    return Response.json(
      { companies: slice, total, page, pageSize, pageCount },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[companies] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load companies" },
      { status: 502 }
    );
  }
}
