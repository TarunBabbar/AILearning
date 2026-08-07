import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEmailDomain, isGenericDomain, resolveCompanyDetails, titleCase } from "@/lib/company";
import { resolveApiKey } from "@/lib/auth";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/companies/resolve
 * Body: { model?: string }
 * Scans jobs for email domains that are not generic/personal,
 * resolves company details via the LLM, and stores them in the Company table,
 * linking jobs → companyInfo.
 */
export async function POST(req: Request) {
  try {
    const { model } = (await req.json()) as { model?: string };

    const { apiKey } = resolveApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key configured. Set OPENROUTER_API_KEY in the environment." },
        { status: 400 }
      );
    }

    // Collect domains from job emails
    const jobs = await prisma.job.findMany({
      where: { email: { not: null }, companyInfo: { is: null } },
      select: { id: true, email: true },
    });

    const domainSet = new Set<string>();
    const jobEmails: Record<string, string> = {};
    for (const j of jobs) {
      const domain = getEmailDomain(j.email);
      if (domain && !isGenericDomain(domain)) {
        domainSet.add(domain);
        if (!jobEmails[domain]) jobEmails[domain] = j.email as string;
      }
    }

    const domains = [...domainSet];
    if (!domains.length) {
      return NextResponse.json({
        message: "No new company domains to resolve.",
        companies: 0,
      });
    }

    const cfg = getConfig();
    const resolved = await resolveCompanyDetails(domains, apiKey, model || cfg.llmModel);

    let companiesCreated = 0;
    for (const entry of resolved) {
      const name =
        entry.company && entry.company !== "Unknown"
          ? entry.company
          : titleCase(entry.domain.split(".")[0] || entry.domain);

      const existing = await prisma.company.findUnique({
        where: { domain: entry.domain },
      });

      let company;
      if (existing) {
        company = existing;
      } else {
        company = await prisma.company.create({
          data: {
            domain: entry.domain,
            name,
            type: entry.type,
            location: entry.location,
            website: entry.website,
            source: "llm",
          },
        });
        companiesCreated++;
      }

      // Link all jobs with this domain to the company
      const matchingJobs = await prisma.job.findMany({
        where: { email: { endsWith: `@${entry.domain}` } },
        select: { id: true },
      });
      for (const mj of matchingJobs) {
        await prisma.job.update({
          where: { id: mj.id },
          data: { companyId: company.id },
        });
      }
    }

    const unresolvedDomains = domains.filter(
      (d) => !resolved.some((r) => r.domain === d)
    );

    return NextResponse.json({
      message: `Resolved ${resolved.length} company domain(s), created ${companiesCreated} new.`,
      companies: resolved.length,
      created: companiesCreated,
      unresolved: unresolvedDomains,
      total: await prisma.company.count(),
    });
  } catch (e) {
    console.error("[companies/resolve] error:", e);
    return NextResponse.json({ error: "Failed to resolve companies." }, { status: 500 });
  }
}
