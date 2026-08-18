import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { groupJobsByCompany, nonGenericEmailWhere } from "@/lib/company";

export const runtime = "nodejs";

/**
 * GET /api/user/matches/filters
 * Returns distinct display companies and locations with job counts for the
 * logged-in user's **scored** jobs only. The Match by Resume results grid
 * shows only JobScore rows, so its filter dropdowns must reflect the same
 * scored-job universe — otherwise counts would include unscored jobs and
 * selecting a company/location could return an empty grid.
 */
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Login required." },
        { status: 401 }
      );
    }

    const rows = await prisma.jobScore.findMany({
      where: {
        userId,
        job: nonGenericEmailWhere(),
      },
      select: {
        job: {
          select: {
            title: true,
            company: true,
            email: true,
            location: true,
            description: true,
            companyInfo: { select: { name: true } },
          },
        },
      },
    });

    const sanitized = rows
      .map((r) => r.job)
      .map((j) =>
        sanitizeJobForDisplay({ ...j, companyInfo: j.companyInfo })
      ) as (typeof rows)[number]["job"][];

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
      {
        // user-specific browser cache — dropdowns don't change often; reloads
        // within 60s skip the DB.
        headers: { "Cache-Control": "private, max-age=60" },
      }
    );
  } catch (e) {
    console.error("[user/matches/filters]", e);
    return NextResponse.json(
      { error: "Failed to load filter options." },
      { status: 500 }
    );
  }
}
