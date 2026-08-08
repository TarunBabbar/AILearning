import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import { groupJobsByCompany, dedupeJobs, getEmailDomain, isGenericDomain, titleCase } from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";

export const runtime = "nodejs";

/**
 * GET /api/contacts?search=
 * Returns one entry per company with the email(s) people can reach at,
 * derived from the job listings (deduped, spam-free, non-generic domains).
 * The company name is the sanitized display name (email-derived).
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

    // Only jobs with a real company email (never personal/free domains).
    const valid = jobs.filter(
      (j) => j.email && !isGenericDomain(getEmailDomain(j.email))
    );

    // Display-time sanitization: junk company names become email-derived
    // names, spam stripped from titles. DB untouched.
    const sanitized = valid.map((j) => sanitizeJobForDisplay(j));

    // Collapse duplicate postings (same company + description).
    const unique = dedupeJobs(sanitized);

    // Group by company (email-domain key) with the sanitized display label.
    const grouped = groupJobsByCompany(unique);

    // Merge groups that normalize to the same label (e.g. two sources both
    // deriving "Apptad Inc" via different keys) so labels stay unique.
    const merged = new Map<string, { label: string; jobs: typeof unique }>();
    for (const { label, jobs: j } of grouped.values()) {
      const key = label.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.jobs.push(...j);
      } else {
        merged.set(key, { label, jobs: [...j] });
      }
    }

    const contacts = [...merged.values()]
      .map(({ label, jobs: j }) => {
        const emails = [...new Set(j.map((x) => x.email).filter(Boolean))] as string[];
        // Company type/description come from the linked Company row (if any).
        const info = j.find((x) => x.companyInfo)?.companyInfo;
        return {
          company: titleCase(label),
          emails,
          type: info?.type ?? null,
          description: info?.description ?? null,
        };
      })
      .filter((c) => c.emails.length > 0)
      .sort((a, b) => a.company.localeCompare(b.company));

    return NextResponse.json({
      totalCompanies: contacts.length,
      contacts,
    });
  } catch (e) {
    console.error("[contacts] error:", e);
    return NextResponse.json({ error: "Failed to load contacts." }, { status: 500 });
  }
}
