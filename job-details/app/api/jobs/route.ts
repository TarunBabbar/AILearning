import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";

/**
 * GET /api/jobs?search=&status=&company=&sort=
 * Returns jobs with their resolved company info.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";
    const company = url.searchParams.get("company")?.trim() || "";
    const sort = url.searchParams.get("sort")?.trim() || "newest";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "200", 10) || 200,
      500
    );

    const where: Prisma.JobWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { experience: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (company) {
      where.company = { contains: company, mode: "insensitive" };
    }

    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ createdAt: "asc" }]
        : sort === "company"
          ? [{ company: "asc" }]
          : [{ createdAt: "desc" }];

    const [jobs, total, statusCounts] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { companyInfo: true },
        orderBy,
        take: limit,
      }),
      prisma.job.count({ where }),
      prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const counts: Record<string, number> = {};
    for (const s of statusCounts) counts[s.status] = s._count._all;

    return NextResponse.json({
      jobs,
      total,
      counts,
      filters: { search, status, company, sort },
    });
  } catch (e) {
    console.error("[jobs] error:", e);
    return NextResponse.json({ error: "Failed to load jobs." }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs — clear all jobs.
 */
export async function DELETE() {
  try {
    await prisma.job.deleteMany({});
    return NextResponse.json({ message: "All jobs cleared." });
  } catch (e) {
    console.error("[jobs] delete error:", e);
    return NextResponse.json({ error: "Failed to clear jobs." }, { status: 500 });
  }
}
