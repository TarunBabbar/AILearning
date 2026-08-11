// Chat data layer — answers natural-language questions about the user's OWN
// job data with real, safe Prisma queries (no raw SQL, no code exposure).
// Every query is scoped to the logged-in userId and to the QA Jobs universe
// (recruiter emails only), matching exactly how the dashboard counts jobs.
import { prisma } from "@/lib/db";
import { nonGenericEmailWhere } from "@/lib/company";
import type { Prisma } from "@prisma-generated/client";

export type ChatDataSummary = {
  kind: "data";
  /** Short human label for the query. */
  label: string;
  /** The answer itself — numbers, titles, counts. */
  answer: string;
  /** A compact list of top items (max 5), for richer model responses. */
  items?: { title: string; company?: string; score?: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Snapshot of the user's scored universe used by the simple query handlers. */
type UserSnapshot = {
  totalJobs: number;
  scoredCount: number;
  unscoredCount: number;
  minScore: number;
  avgScore: number;
  topScored: { title: string; company: string; score: number }[];
  todayTopScored: { title: string; company: string; score: number }[];
  todayCount: number;
  companies: { company: string; count: number }[];
  locations: { location: string; count: number }[];
};

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function loadSnapshot(userId: string): Promise<UserSnapshot | null> {
  const jobWhere = nonGenericEmailWhere();

  const [totalJobs, scoredRows, topRows] = await Promise.all([
    prisma.job.count({ where: jobWhere }),
    prisma.jobScore.findMany({
      where: { userId },
      select: { score: true, jobId: true, job: { select: { title: true, company: true } } },
    }),
    prisma.jobScore.findMany({
      where: { userId },
      orderBy: { score: "desc" },
      take: 5,
      select: {
        score: true,
        job: { select: { title: true, company: true } },
      },
    }),
  ]);

  if (scoredRows.length === 0) {
    return {
      totalJobs,
      scoredCount: 0,
      unscoredCount: totalJobs,
      minScore: 0,
      avgScore: 0,
      topScored: [],
      todayTopScored: [],
      todayCount: 0,
      companies: [],
      locations: [],
    };
  }

  const scores = scoredRows.map((r) => r.score);
  const minScore = Math.min(...scores);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // "Today" uses the job posting date (jobDate), matching the dashboard.
  const today = startOfTodayUtc();
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const todayRows = await prisma.jobScore.findMany({
    where: { userId, job: { jobDate: { gte: today, lt: tomorrow } } },
    orderBy: { score: "desc" },
    take: 5,
    select: { score: true, job: { select: { title: true, company: true } } },
  });

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

  return {
    totalJobs,
    scoredCount: scoredRows.length,
    unscoredCount: totalJobs - scoredRows.length,
    minScore,
    avgScore,
    topScored: topRows.map((r) => ({
      title: r.job.title,
      company: r.job.company,
      score: r.score,
    })),
    todayTopScored: todayRows.map((r) => ({
      title: r.job.title,
      company: r.job.company,
      score: r.score,
    })),
    todayCount: todayRows.length,
    companies: [...companies.entries()]
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    locations: [...locations.entries()]
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

/** Count scored jobs above a score threshold, with optional today filter. */
async function countAbove(
  userId: string,
  threshold: number,
  todayOnly = false
): Promise<number> {
  const today = todayOnly ? startOfTodayUtc() : null;
  const tomorrow = today ? new Date(today.getTime() + DAY_MS) : null;
  const jobFilters: Prisma.JobWhereInput[] = [nonGenericEmailWhere()];
  if (today && tomorrow) {
    jobFilters.push({ jobDate: { gte: today, lt: tomorrow } });
  }
  return prisma.jobScore.count({
    where: {
      userId,
      score: { gte: threshold },
      job: { AND: jobFilters },
    },
  });
}

/**
 * Answer a data question about the user's own jobs. Returns null when the
 * question isn't a data question (falls through to the LLM knowledge answer).
 */
export async function answerChatDataQuestion(
  userId: string,
  message: string
): Promise<ChatDataSummary | null> {
  const q = message.toLowerCase();

  // "how many jobs do I have / how many scored / how many left"
  if (/(how many|number of|count).*(job|score|match)|how many.*(scored|unscored|left|pending)/.test(q) ||
      /how (many|much).*(jobs|scores|matches)/.test(q)) {
    const s = await loadSnapshot(userId);
    if (!s) return null;
    return {
      kind: "data",
      label: "job counts",
      answer: `You have ${s.totalJobs.toLocaleString()} jobs in the board. ${s.scoredCount.toLocaleString()} are scored against your resume (${s.unscoredCount.toLocaleString()} still unscored).`,
      items: s.topScored.slice(0, 3).map((i) => ({ title: i.title, company: i.company, score: i.score })),
    };
  }

  // "what's my best score / top matches / highest fit"
  if (/(best|top|highest|strongest).*(score|match|fit)|top.*(jobs|matches)/.test(q)) {
    const s = await loadSnapshot(userId);
    if (!s) return null;
    if (!s.topScored.length) {
      return {
        kind: "data",
        label: "top matches",
        answer: "You haven't scored any jobs yet. Upload a resume and run Score to see your best matches.",
      };
    }
    return {
      kind: "data",
      label: "top matches",
      answer: `Your best match is ${s.topScored[0].title} at ${s.topScored[0].company} with a ${s.topScored[0].score}% fit.`,
      items: s.topScored,
    };
  }

  // "jobs with score > 50 / above 50 / at least 70" (with optional "today")
  const todayMatch = q.includes("today");
  const thresholdMatch = q.match(/(?:above|over|more than|greater than|at least|>=?)\s*(\d{1,3})/);
  if (thresholdMatch && /score|fit|match/.test(q)) {
    const threshold = Math.max(0, Math.min(100, Number(thresholdMatch[1])));
    const count = await countAbove(userId, threshold, todayMatch);
    return {
      kind: "data",
      label: `score ≥ ${threshold}${todayMatch ? " today" : ""}`,
      answer: `${count.toLocaleString()} of your scored jobs have a fit score ${threshold}% or above${todayMatch ? " posted today" : ""}.`,
    };
  }

  // "which companies do I have / top companies"
  if (/compan(y|ies)/.test(q)) {
    const s = await loadSnapshot(userId);
    if (!s) return null;
    if (!s.companies.length) {
      return { kind: "data", label: "companies", answer: "You haven't scored any jobs yet." };
    }
    const list = s.companies.map((c) => `${c.company} (${c.count})`).join(", ");
    return {
      kind: "data",
      label: "top companies",
      answer: `Your most common companies: ${list}.`,
      items: s.companies.map((c) => ({ title: c.company })),
    };
  }

  // "which locations / where are jobs"
  if (/locat|where/.test(q)) {
    const s = await loadSnapshot(userId);
    if (!s) return null;
    if (!s.locations.length) {
      return { kind: "data", label: "locations", answer: "You haven't scored any jobs yet." };
    }
    const list = s.locations.map((l) => `${l.location} (${l.count})`).join(", ");
    return {
      kind: "data",
      label: "top locations",
      answer: `Your most common job locations: ${list}.`,
      items: s.locations.map((l) => ({ title: l.location })),
    };
  }

  return null;
}
