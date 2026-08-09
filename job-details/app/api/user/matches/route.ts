import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { sanitizeJobForDisplay } from "@/lib/sanitize";

export const runtime = "nodejs";

/**
 * GET /api/user/matches?minScore=&search=
 * Returns this user's scored jobs, highest score first.
 */
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const url = new URL(req.url);
    const minScore = Math.max(
      0,
      parseInt(url.searchParams.get("minScore") || "0", 10) || 0
    );
    const search = url.searchParams.get("search")?.trim() || "";

    const rows = await prisma.jobScore.findMany({
      where: {
        userId,
        score: { gte: minScore },
        ...(search
          ? {
              job: {
                OR: [
                  { title: { contains: search, mode: "insensitive" } },
                  { company: { contains: search, mode: "insensitive" } },
                  { location: { contains: search, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      orderBy: [{ score: "desc" }, { scoredAt: "desc" }],
      include: {
        job: true,
      },
    });

    const matches = rows.map((r) => {
      const job = sanitizeJobForDisplay({ ...r.job, companyInfo: null });
      return {
        id: r.id,
        score: r.score,
        strengths: r.strengths,
        gaps: r.gaps,
        scoredAt: r.scoredAt,
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          experience: job.experience,
          email: job.email,
          description: job.description,
          jobDate: job.jobDate,
        },
      };
    });

    return NextResponse.json(
      {
        total: matches.length,
        matches,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (e) {
    console.error("[user/matches]", e);
    return NextResponse.json({ error: "Failed to load matches." }, { status: 500 });
  }
}
