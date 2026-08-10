import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import {
  GENERIC_DOMAINS,
  getEmailDomain,
  isGenericDomain,
  groupJobsByCompany,
  companyFilterWhere,
} from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { CACHE_CONTROL_LIST } from "@/lib/swr-fetcher";

/**
 * GET /api/jobs/filters
 * Returns distinct display companies and locations with job counts, for the
 * exact-match dropdowns on QA Jobs / Match by Resume.
 * Company identity uses the same sanitized label + merge logic as the
 * Company Jobs view; locations are the raw (non-empty) location strings.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const company = url.searchParams.get("company")?.trim() || "";
    const location = url.searchParams.get("location")?.trim() || "";

    const notGeneric = [...GENERIC_DOMAINS].map((d) => ({
      NOT: { email: { endsWith: `@${d}`, mode: "insensitive" as const } },
    }));

    const and: Prisma.JobWhereInput[] = [
      { email: { not: null } },
      { NOT: { email: { equals: "" } } },
      ...notGeneric,
    ];

    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (company) {
      and.push(companyFilterWhere(company));
    }
    if (location) {
      and.push({ location: { equals: location, mode: "insensitive" } });
    }

    const jobs = await prisma.job.findMany({
      where: { AND: and },
      select: {
        id: true,
        title: true,
        company: true,
        email: true,
        location: true,
        description: true,
        companyInfo: { select: { name: true } },
      },
      orderBy: [{ jobDate: "desc" }, { createdAt: "desc" }],
    });

    // Same display-time sanitization the list endpoints apply.
    const valid = jobs.filter(
      (j) => j.email && !isGenericDomain(getEmailDomain(j.email))
    );
    const sanitized = valid.map((j) =>
      sanitizeJobForDisplay({ ...j, companyInfo: j.companyInfo })
    );

    // Distinct companies via the shared group-by-company logic (merged labels).
    const grouped = groupJobsByCompany(sanitized);
    const merged = new Map<string, { label: string; count: number }>();
    for (const { label, jobs: gj } of grouped.values()) {
      const key = label.toLowerCase();
      const existing = merged.get(key);
      if (existing) existing.count += gj.length;
      else merged.set(key, { label, count: gj.length });
    }
    const companies = [...merged.values()]
      .map(({ label, count }) => ({ value: label, count }))
      .sort((a, b) => a.value.localeCompare(b.value));

    // Distinct non-empty locations.
    const byLoc = new Map<string, number>();
    for (const j of sanitized) {
      const loc = (j.location || "").trim();
      if (!loc) continue;
      byLoc.set(loc, (byLoc.get(loc) ?? 0) + 1);
    }
    const locations = [...byLoc.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));

    return NextResponse.json(
      { companies, locations },
      { headers: { "Cache-Control": CACHE_CONTROL_LIST } }
    );
  } catch (e) {
    console.error("[jobs/filters] error:", e);
    return NextResponse.json(
      { error: "Failed to load filter options." },
      { status: 500 }
    );
  }
}
