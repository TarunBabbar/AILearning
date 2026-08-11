// Chat data layer — builds a compact snapshot of the user's OWN job data
// (counts, top matches, companies, locations) that gets injected into the
// LLM's context. The LLM then answers any question naturally — no regex
// routing, no brittle keyword matching. Every query is scoped to the
// logged-in userId and to the QA Jobs universe (recruiter emails only).
import { prisma } from "@/lib/db";
import { nonGenericEmailWhere } from "@/lib/company";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Build a short, factual description of the user's job universe. This is
 * injected into the assistant's system prompt so it can answer data questions
 * ("how many jobs in Bangalore?", "what's my best match?") from real data
 * without hardcoded regex handlers.
 */
export async function buildUserContext(userId: string): Promise<string> {
  const jobWhere = nonGenericEmailWhere();

  const [totalJobs, scoredRows] = await Promise.all([
    prisma.job.count({ where: jobWhere }),
    prisma.jobScore.findMany({
      where: { userId },
      select: {
        score: true,
        jobId: true,
        job: { select: { title: true, company: true } },
      },
    }),
  ]);

  // Company + location distribution from the user's scored jobs.
  const scoredJobs = await prisma.job.findMany({
    where: { id: { in: scoredRows.map((r) => r.jobId) }, ...jobWhere },
    select: { company: true, location: true },
  });
  const companies = new Map<string, number>();
  const locations = new Map<string, number>();
  for (const j of scoredJobs) {
    if (j.company) companies.set(j.company, (companies.get(j.company) ?? 0) + 1);
    if (j.location) locations.set(j.location, (locations.get(j.location) ?? 0) + 1);
  }

  const scoredCount = scoredRows.length;
  const scores = scoredRows.map((r) => r.score);
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const topScored = [...scoredRows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => `${r.job.title} at ${r.job.company} (${r.score}% fit)`);

  const topCompanies = [...companies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count})`)
    .join(", ");

  const topLocations = [...locations.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count})`)
    .join(", ");

  const lines: string[] = [];
  lines.push(`- Jobs in the board: ${totalJobs.toLocaleString()}`);
  lines.push(`- Jobs scored against your resume: ${scoredCount.toLocaleString()}`);
  lines.push(`- Jobs still unscored: ${Math.max(0, totalJobs - scoredCount).toLocaleString()}`);
  if (scores.length) {
    lines.push(`- Average fit score of your scored jobs: ${avgScore}%`);
  }
  if (topScored.length) {
    lines.push(`- Your best matches: ${topScored.join("; ")}`);
  }
  if (topCompanies) {
    lines.push(`- Most common companies in your scored jobs: ${topCompanies}`);
  }
  if (topLocations) {
    lines.push(`- Most common locations in your scored jobs: ${topLocations}`);
  }
  if (!scores.length) {
    lines.push("- You have not scored any jobs yet (upload a resume and run Score to see matches).");
  }

  return lines.join("\n");
}
