import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import { groupJobsByCompany, dedupeJobs, getEmailDomain, isGenericDomain } from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { CACHE_CONTROL_LIST } from "@/lib/swr-fetcher";

export const runtime = "nodejs";

/**
 * GET /api/companies/jobs?search=&sort=
 * Returns all jobs grouped by company. Company identity is derived from the
 * job's email domain, falling back to the company text when no usable email
 * exists. Duplicates (same company + normalized description) are collapsed.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const sort = url.searchParams.get("sort")?.trim() || "jobs";

    const where: Prisma.JobWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      include: { companyInfo: true },
      orderBy: [{ jobDate: "desc" }, { createdAt: "desc" }],
    });

    // NEVER show jobs with personal/free email domains (gmail.com,
    // live.com, yahoo.com, outlook.com, …). Filter them out up front.
    const valid = jobs.filter((j) => !isGenericDomain(getEmailDomain(j.email)));

    // Display-time sanitization — replace junk company names (e.g.
    // "Software Testing Studio") with the email-derived name and strip
    // spam boilerplate from title/description. DB is never modified.
    const sanitized = valid.map((j) => sanitizeJobForDisplay(j));

    // Remove duplicates across all companies (shared logic with the
    // dashboard — same company + normalized description = same posting).
    const unique = dedupeJobs(sanitized);
    const grouped = groupJobsByCompany(unique);

    // Merge groups that normalize to the same label (e.g. two sources both
    // deriving "Innoventes" via different keys) so labels stay unique.
    const merged = new Map<string, { label: string; jobs: typeof unique }>();
    for (const { label, jobs } of grouped.values()) {
      const key = label.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.jobs.push(...jobs);
      } else {
        merged.set(key, { label, jobs: [...jobs] });
      }
    }

    const companies = [...merged.values()]
      .map(({ label, jobs: j }) => ({
        company: label,
        count: j.length,
        jobs: j,
      }))
      .sort((a, b) => (sort === "name" ? a.company.localeCompare(b.company) : b.count - a.count));

    return NextResponse.json(
      {
        totalCompanies: companies.length,
        totalJobs: companies.reduce((s, c) => s + c.jobs.length, 0),
        companies,
      },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_LIST,
        },
      }
    );
  } catch (e) {
    console.error("[companies/jobs] error:", e);
    return NextResponse.json(
      { error: "Failed to load company jobs." },
      { status: 500 }
    );
  }
}
