import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma-generated/client";
import { getSessionUserId } from "@/lib/user-auth";
import { getUserForLog, logUserAction } from "@/lib/action-log";
import { groupJobsByCompany, dedupeJobs, getEmailDomain, isGenericDomain, titleCase } from "@/lib/company";
import { sanitizeJobForDisplay } from "@/lib/sanitize";
import { CACHE_CONTROL_LIST } from "@/lib/swr-fetcher";

export const runtime = "nodejs";

/**
 * GET /api/contacts?search=
 * Returns one entry per company with the email(s) people can reach at,
 * derived from the job listings (deduped, spam-free, non-generic domains).
 * The company name is the sanitized display name (email-derived).
 *
 * Requires a logged-in user session — recruiter contact details are only
 * visible to users who sign in (e.g. via Match by Resume).
 */
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

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

    const contactsAll = [...merged.values()]
      .map(({ label, jobs: j }) => {
        const emails = [...new Set(j.map((x) => x.email).filter(Boolean))] as string[];
        return {
          company: titleCase(label),
          emails,
        };
      })
      .filter((c) => c.emails.length > 0)
      // Only keep companies whose DISPLAYED name matches the search — a job
      // may match via its email domain (e.g. @hcltech.com) while belonging to
      // a differently-named company; that row would not visibly contain the
      // search term, so it must be excluded.
      .filter(
        (c) =>
          !search ||
          c.company.toLowerCase().includes(search.toLowerCase()) ||
          c.emails.some((e) => e.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => a.company.localeCompare(b.company));

    const totalEmails = contactsAll.reduce((s, c) => s + c.emails.length, 0);

    const pageSizeRaw = Number(url.searchParams.get("pageSize"));
    const pageRaw = Number(url.searchParams.get("page"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 40)
    );
    const pageCount = Math.max(1, Math.ceil(contactsAll.length / pageSize));
    const page = Math.min(
      pageCount,
      Math.max(1, Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1)
    );
    const contacts = contactsAll.slice((page - 1) * pageSize, page * pageSize);

    const user = await getUserForLog(userId);
    logUserAction(
      user,
      "contacts.view",
      `search="${search}" page=${page} → ${contactsAll.length} companies / ${totalEmails} emails`
    );

    return NextResponse.json(
      {
        totalCompanies: contactsAll.length,
        totalEmails,
        page,
        pageSize,
        pageCount,
        contacts,
      },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL_LIST,
        },
      }
    );
  } catch (e) {
    console.error("[contacts] error:", e);
    return NextResponse.json({ error: "Failed to load contacts." }, { status: 500 });
  }
}
