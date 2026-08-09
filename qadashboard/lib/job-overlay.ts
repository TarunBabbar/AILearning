import { prisma } from "./prisma";
import type { RemoteJob } from "./job-board-api";

export type MergedJob = {
  id: string;
  title: string;
  company: string;
  email?: string | null;
  location?: string | null;
  experience?: string | null;
  description?: string | null;
  status: string;
  score?: number | null;
  strengths?: string | null;
  gaps?: string | null;
  emailSent: boolean;
  emailSentAt?: string | null;
  originalId: string;
  createdAt?: string;
  localId?: string;
};

export async function loadOverlaysByOriginalIds(userId: string, originalIds: string[]) {
  if (originalIds.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.job.findMany>>[number]>();
  const rows = await prisma.job.findMany({
    where: { userId, originalId: { in: originalIds } },
  });
  return new Map(rows.filter((r) => r.originalId).map((r) => [r.originalId as string, r]));
}

export function mergeRemoteWithOverlay(
  remote: RemoteJob,
  overlay?: {
    id: string;
    status: string;
    score: number | null;
    strengths: string | null;
    gaps: string | null;
    emailSent: boolean;
    emailSentAt: Date | null;
  } | null
): MergedJob {
  return {
    id: remote.id,
    title: remote.title,
    company: remote.company,
    email: remote.email,
    location: remote.location,
    experience: remote.experience,
    description: remote.description,
    status: overlay?.status || "new",
    score: overlay?.score ?? null,
    strengths: overlay?.strengths ?? null,
    gaps: overlay?.gaps ?? null,
    emailSent: overlay?.emailSent ?? false,
    emailSentAt: overlay?.emailSentAt?.toISOString() ?? null,
    originalId: remote.id,
    createdAt: remote.createdAt,
    localId: overlay?.id,
  };
}

export async function upsertJobOverlay(
  userId: string,
  remote: Pick<
    RemoteJob,
    "id" | "title" | "company" | "email" | "location" | "experience" | "description"
  >,
  data: {
    score?: number | null;
    strengths?: string | null;
    gaps?: string | null;
    status?: string;
    emailSent?: boolean;
    emailSentAt?: Date | null;
  }
) {
  const existing = await prisma.job.findFirst({
    where: { userId, originalId: remote.id },
  });

  const snapshot = {
    title: remote.title || "Unknown",
    company: remote.company || "Unknown",
    email: remote.email || null,
    location: remote.location || null,
    experience: remote.experience || null,
    description: remote.description || null,
  };

  if (existing) {
    return prisma.job.update({
      where: { id: existing.id },
      data: { ...snapshot, ...data },
    });
  }

  return prisma.job.create({
    data: {
      userId,
      originalId: remote.id,
      ...snapshot,
      status: data.status || "new",
      score: data.score ?? null,
      strengths: data.strengths ?? null,
      gaps: data.gaps ?? null,
      emailSent: data.emailSent ?? false,
      emailSentAt: data.emailSentAt ?? null,
    },
  });
}

export type OverlayUpsert = {
  remote: Pick<
    RemoteJob,
    "id" | "title" | "company" | "email" | "location" | "experience" | "description"
  >;
  data: {
    score?: number | null;
    strengths?: string | null;
    gaps?: string | null;
    status?: string;
    emailSent?: boolean;
    emailSentAt?: Date | null;
  };
};

/**
 * Batch upsert of job overlays in ONE Prisma call per operation
 * (replaces the findFirst + update/create two-round-trip-per-job pattern).
 * Uses the existing @@unique([userId, originalId]).
 */
export async function upsertJobOverlays(userId: string, items: OverlayUpsert[]) {
  if (items.length === 0) return 0;
  let n = 0;
  await Promise.all(
    items.map(async ({ remote, data }) => {
      const snapshot = {
        title: remote.title || "Unknown",
        company: remote.company || "Unknown",
        email: remote.email || null,
        location: remote.location || null,
        experience: remote.experience || null,
        description: remote.description || null,
      };
      await prisma.job.upsert({
        where: { userId_originalId: { userId, originalId: remote.id } },
        create: {
          userId,
          originalId: remote.id,
          ...snapshot,
          status: data.status || "new",
          score: data.score ?? null,
          strengths: data.strengths ?? null,
          gaps: data.gaps ?? null,
          emailSent: data.emailSent ?? false,
          emailSentAt: data.emailSentAt ?? null,
        },
        update: {
          ...snapshot,
          ...(data.score !== undefined ? { score: data.score } : {}),
          ...(data.strengths !== undefined ? { strengths: data.strengths } : {}),
          ...(data.gaps !== undefined ? { gaps: data.gaps } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.emailSent !== undefined ? { emailSent: data.emailSent } : {}),
          ...(data.emailSentAt !== undefined ? { emailSentAt: data.emailSentAt } : {}),
        },
      });
      n++;
    })
  );
  return n;
}

/** Strong-match threshold shared by the stats helper. */
export const STRONG_SCORE = 60;

/**
 * One groupBy for the scored / strong / total counts that list and score
 * routes repeatedly recomputed as separate `count` queries.
 */
export async function countJobStats(userId: string) {
  const groups = await prisma.job.groupBy({
    by: ["score"],
    where: {
      userId,
      originalId: { not: null },
      score: { not: null },
      status: { not: "deleted" },
    },
    _count: { _all: true },
  });
  let strong = 0;
  let scored = 0;
  for (const g of groups) {
    scored += g._count._all;
    if ((g.score ?? 0) >= STRONG_SCORE) strong += g._count._all;
  }
  return { scored, strong };
}
