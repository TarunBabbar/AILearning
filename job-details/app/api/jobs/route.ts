import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  GENERIC_DOMAINS,
  dedupeJobs,
  companyFilterWhere,
} from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { CACHE_CONTROL_LIST } from "@/lib/swr-fetcher";

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;
const OVERFETCH = 15;
const PREVIEW_CHARS = 200;

/** Exclude personal/free email domains in SQL (same set as isGenericDomain). */
function nonGenericEmailWhere(): Prisma.JobWhereInput {
  const notGeneric = [...GENERIC_DOMAINS].map((d) => ({
    NOT: { email: { endsWith: `@${d}`, mode: "insensitive" as const } },
  }));
  return {
    AND: [
      { email: { not: null } },
      { NOT: { email: { equals: "" } } },
      ...notGeneric,
    ],
  };
}

function truncatePreview(text: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= PREVIEW_CHARS) return t;
  return t.slice(0, PREVIEW_CHARS);
}

/**
 * GET /api/jobs?search=&status=&company=&location=&sort=&page=&pageSize=
 * Returns one slim page of jobs. Search/sort apply across the full DB.
 * Full descriptions are loaded via GET /api/jobs/:id when a card is opened.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const company = url.searchParams.get("company")?.trim() || "";
  const location = url.searchParams.get("location")?.trim() || "";
  const sort = url.searchParams.get("sort")?.trim() || "newest";
  const pageRaw = parseInt(url.searchParams.get("page") || "1", 10);
  const sizeRaw = parseInt(
    url.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE),
    10
  );
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(sizeRaw) ? sizeRaw : DEFAULT_PAGE_SIZE)
  );

  try {
    const filters: Prisma.JobWhereInput[] = [nonGenericEmailWhere()];

    if (search) {
      filters.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { experience: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (status) filters.push({ status });
    if (company) {
      filters.push(companyFilterWhere(company));
    }
    if (location) {
      filters.push({ location: { equals: location, mode: "insensitive" } });
    }

    const where: Prisma.JobWhereInput = { AND: filters };

    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ jobDate: "asc" }, { createdAt: "asc" }]
        : sort === "company"
          ? [{ company: "asc" }, { jobDate: "desc" }]
          : [{ jobDate: "desc" }, { createdAt: "desc" }];

    const skip = (page - 1) * pageSize;

    const [candidates, total, companyGroups, sourceGroups] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy,
        skip,
        take: pageSize + OVERFETCH,
        select: {
          id: true,
          title: true,
          company: true,
          email: true,
          location: true,
          experience: true,
          description: true,
          fileName: true,
          jobDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          companyId: true,
        },
      }),
      prisma.job.count({ where }),
      prisma.job.groupBy({
        by: ["company"],
        where,
        _count: true,
      }),
      prisma.job.groupBy({
        by: ["fileName"],
        where,
        _count: true,
      }),
    ]);

    const sanitized = candidates.map((j) =>
      sanitizeJobForDisplay({ ...j, companyInfo: null })
    );
    const deduped = dedupeJobs(sanitized).slice(0, pageSize);

    const jobs = deduped.map((j) => ({
      ...j,
      description: truncatePreview(j.description),
      companyInfo: null,
    }));

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const companyCount = companyGroups.length;
    const sourceCount = sourceGroups.filter((g) => g.fileName).length;

    return NextResponse.json(
      {
        jobs,
        total,
        page,
        pageSize,
        pageCount,
        counts: {},
        companyCount,
        sourceCount,
        filters: { search, status, company, location, sort },
      },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_LIST,
        },
      }
    );
  } catch (e) {
    console.error("[jobs] error:", e);
    return NextResponse.json({
      jobs: [],
      total: 0,
      page: 1,
      pageSize,
      pageCount: 0,
      counts: {},
      filters: { search, status, company, location, sort },
      dbError: true,
    });
  }
}

/**
 * DELETE /api/jobs — clear all jobs (admin only).
 */
export async function DELETE() {
  try {
    const admin = await isAdminRequest();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }
    await prisma.job.deleteMany({});
    return NextResponse.json({ message: "All jobs cleared." });
  } catch (e) {
    console.error("[jobs] delete error:", e);
    return NextResponse.json({ error: "Failed to clear jobs." }, { status: 500 });
  }
}
