import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/user-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/user/me */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const scoreCount = await prisma.jobScore.count({
      where: { userId: user.id },
    });

    return NextResponse.json({
      user,
      resume: user.resume
        ? {
            filename: user.resume.filename,
            updatedAt: user.resume.updatedAt,
            mimeType: user.resume.mimeType,
          }
        : null,
      scoreCount,
    });
  } catch (e) {
    console.error("[user/me]", e);
    return NextResponse.json({ user: null });
  }
}
