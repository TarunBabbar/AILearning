import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import { dedupeJobs, getEmailDomain, isGenericDomain, titleCase } from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { CACHE_CONTROL_LIST } from "@/lib/swr-fetcher";

export const runtime = "nodejs";

/**
 * GET /api/locations?search=
 * Returns jobs grouped by location. Job titles/companies are sanitized for
 * display; personal-email jobs and duplicates are excluded like everywhere
 * else. Company label comes from the email-derived display name.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";

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

    // Only real company emails (never personal/free domains).
    const valid = jobs.filter(
      (j) => j.email && !isGenericDomain(getEmailDomain(j.email))
    );

    // Display-time sanitization — junk company names become email-derived
    // names, spam stripped from titles. DB untouched.
    const sanitized = valid.map((j) => sanitizeJobForDisplay(j));

    // Collapse duplicate postings (same company + description).
    const unique = dedupeJobs(sanitized);

    // Group by location (case-insensitive).
    const byLocation = new Map<string, typeof unique>();
    for (const j of unique) {
      const loc = (j.location || "").trim();
      if (!loc) continue;
      const key = loc.toLowerCase();
      const arr = byLocation.get(key) ?? [];
      arr.push(j);
      byLocation.set(key, arr);
    }

    const locations = [...byLocation.entries()]
      .map(([key, jobsInLoc]) => ({
        location: jobsInLoc[0]?.location || titleCase(key),
        jobs: jobsInLoc.map((j) => ({
          id: j.id,
          title: j.title,
          company: titleCase(j.company),
          location: j.location,
          experience: j.experience,
          email: j.email,
          jobDate: j.jobDate,
          description: j.description,
        })),
        count: jobsInLoc.length,
      }))
      .sort((a, b) => a.location.localeCompare(b.location));

    return NextResponse.json(
      {
        totalLocations: locations.length,
        totalJobs: locations.reduce((s, l) => s + l.count, 0),
        locations,
      },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_LIST,
        },
      }
    );
  } catch (e) {
    console.error("[locations] error:", e);
    return NextResponse.json({ error: "Failed to load locations." }, { status: 500 });
  }
}
