import { prisma } from "@/lib/db";
import { getEmailDomain, isGenericDomain, resolveCompanyDetails, titleCase } from "@/lib/company";

/**
 * Resolve + persist company details for email domains found on jobs.
 *
 * Shared by the one-time script (scripts/resolve-companies.ts) and the
 * POST /api/companies/resolve route. Scans jobs that have an email whose
 * company is unresolved or missing details, calls the LLM in batches, then
 * upserts Company rows (only filling fields that are still empty) and links
 * every job with a matching email domain to that Company.
 */
export async function resolveAndStoreCompanyDetails(
  apiKey: string,
  model: string
): Promise<{ resolved: number; created: number; total: number }> {
  // Jobs with an email whose company is missing or lacks details.
  const jobs = await prisma.job.findMany({
    where: {
      email: { not: null },
      OR: [
        { companyInfo: { is: null } },
        { companyInfo: { description: null } },
      ],
    },
    select: { id: true, email: true },
  });

  const domainSet = new Set<string>();
  for (const j of jobs) {
    const domain = getEmailDomain(j.email);
    if (domain && !isGenericDomain(domain)) {
      domainSet.add(domain);
    }
  }

  const domains = [...domainSet];
  if (!domains.length) {
    return { resolved: 0, created: 0, total: await prisma.company.count() };
  }

  const resolved = await resolveCompanyDetails(domains, apiKey, model);

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
      // Backfill any fields the earlier resolution run left empty.
      company = await prisma.company.update({
        where: { id: existing.id },
        data: {
          ...(existing.type ? {} : { type: entry.type }),
          ...(existing.description ? {} : { description: entry.description }),
          ...(existing.location ? {} : { location: entry.location }),
          ...(existing.website ? {} : { website: entry.website }),
        },
      });
    } else {
      company = await prisma.company.create({
        data: {
          domain: entry.domain,
          name,
          type: entry.type,
          description: entry.description,
          location: entry.location,
          website: entry.website,
          source: "llm",
        },
      });
      companiesCreated++;
    }

    // Link all jobs with this domain to the company (case-insensitive —
    // email domains in the DB can be mixed-case, e.g. SGaur@VBeyondapac.com).
    const matchingJobs = await prisma.job.findMany({
      where: {
        email: { endsWith: `@${entry.domain}`, mode: "insensitive" },
      },
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

  return {
    resolved: resolved.length,
    created: companiesCreated,
    total: await prisma.company.count(),
  };
}
