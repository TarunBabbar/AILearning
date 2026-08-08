import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import { isAdminRequest } from "@/lib/admin-auth";
import { getEmailDomain, isGenericDomain, dedupeJobs, countDistinctCompanies } from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";

/**
 * GET /api/jobs?search=&status=&company=&sort=
 * Returns jobs with their resolved company info.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const company = url.searchParams.get("company")?.trim() || "";
  const sort = url.searchParams.get("sort")?.trim() || "newest";

  try {
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
        ? [{ jobDate: "asc" }, { createdAt: "asc" }]
        : sort === "company"
          ? [{ company: "asc" }, { jobDate: "desc" }]
          : [{ jobDate: "desc" }, { createdAt: "desc" }];

    const [candidates, total, statusRows] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { companyInfo: true },
        orderBy,
      }),
      prisma.job.count({ where }),
      prisma.job.findMany({
        select: { status: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const s of statusRows) {
      counts[s.status] = (counts[s.status] || 0) + 1;
    }

    // Exclude jobs whose email uses a personal/free provider
    // (gmail.com, google.com, live.com, yahoo.com, outlook.com, …).
    const filtered = candidates.filter(
      (j) => !isGenericDomain(getEmailDomain(j.email))
    );

    // Display-time sanitization — replace junk company names (e.g.
    // "Software Testing Studio") with the email-derived name and strip
    // spam boilerplate from title/description. DB is never modified.
    const sanitized = filtered.map((j) => sanitizeJobForDisplay(j));

    // Remove duplicates across ALL companies (same company + same
    // normalized description = same posting).
    const jobs = dedupeJobs(sanitized);

    // Distinct companies using the same label-merge logic as the
    // Company Jobs view, so the numbers match everywhere.
    const companyCount = countDistinctCompanies(jobs);

    return NextResponse.json({
      jobs,
      total: jobs.length,
      counts,
      companyCount,
      filters: { search, status, company, sort },
    });
  } catch (e) {
    console.error("[jobs] error:", e);
    // Database unreachable (e.g. no Postgres running) or query failure —
    // don't surface a scary error to the UI. Return an empty list so the
    // dashboard shows its empty state.
    return NextResponse.json({
      jobs: [],
      total: 0,
      counts: {},
      filters: { search, status, company, sort },
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
