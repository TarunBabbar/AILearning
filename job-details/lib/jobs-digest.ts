import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import {
  sendArchitectJobsDigestEmail,
  sendNoArchitectJobsEmail,
  type DigestJobRow,
} from "@/lib/email";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST_TIME_ZONE = "Asia/Kolkata";

/** Start of the current IST calendar day as a UTC instant (server-TZ agnostic). */
function startOfTodayIST(now = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

function formatIST(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST_TIME_ZONE, ...opts }).format(date);
}

/** e.g. "Tuesday, 9 Sep 2026" — human date shown in the digest email. */
function istDateLabel(now = new Date()): string {
  return formatIST(now, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** e.g. "9:00 PM" — IST time a job was added. */
function istTimeLabel(date: Date): string {
  return formatIST(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

export type DigestResult = {
  ok: boolean;
  matched: number;
  sentTo: string;
  error?: string;
};

/**
 * Mon–Fri digest: find jobs added today (IST) whose title mentions
 * "architect" and email their full details to DIGEST_TO_EMAIL. When there are
 * no matches, a short "no architect jobs today" email is sent instead.
 */
export async function runArchitectDigest(): Promise<DigestResult> {
  const to = getConfig().digestToEmail;
  if (!to) {
    return {
      ok: false,
      matched: 0,
      sentTo: "",
      error: "DIGEST_TO_EMAIL is not set — configure it to enable the digest.",
    };
  }

  const jobs = await prisma.job.findMany({
    where: {
      createdAt: { gte: startOfTodayIST() },
      title: { contains: "architect", mode: "insensitive" },
    },
    include: { companyInfo: true },
    orderBy: { createdAt: "desc" },
  });

  const label = istDateLabel();

  if (jobs.length === 0) {
    const result = await sendNoArchitectJobsEmail(to, label);
    return { ok: result.ok, matched: 0, sentTo: to, error: result.error };
  }

  const rows: DigestJobRow[] = jobs.map((j) => ({
    title: j.title,
    company: j.companyInfo?.name || j.company,
    type: j.companyInfo?.type,
    website: j.companyInfo?.website,
    location: j.location,
    experience: j.experience,
    contactEmail: j.email,
    description: j.description,
    fileName: j.fileName,
    addedAtLabel: istTimeLabel(j.createdAt),
  }));

  const result = await sendArchitectJobsDigestEmail(to, label, rows);
  return { ok: result.ok, matched: rows.length, sentTo: to, error: result.error };
}
