import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { getUserForLog, logUserAction } from "@/lib/action-log";

export const runtime = "nodejs";

/**
 * POST /api/user/resume
 * Body: { filename, content, mimeType? }
 * Upserts the logged-in user's resume (plain text only).
 */
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const user = await getUserForLog(userId);
    const body = (await req.json()) as {
      filename?: string;
      content?: string;
      mimeType?: string;
    };
    const filename = (body.filename || "").trim();
    const content = (body.content || "").trim();
    const mimeType = (body.mimeType || "").trim() || null;

    if (!filename || !content) {
      return NextResponse.json(
        { error: "Please choose a resume file to upload." },
        { status: 400 }
      );
    }
    if (content.length < 80) {
      return NextResponse.json(
        { error: "Resume text is too short — try another file." },
        { status: 400 }
      );
    }

    const resume = await prisma.resume.upsert({
      where: { userId },
      create: {
        userId,
        filename,
        content,
        mimeType,
      },
      update: {
        filename,
        content,
        mimeType,
      },
      select: { filename: true, updatedAt: true, mimeType: true },
    });

    // New resume → clear old scores so user re-scores against the new text.
    await prisma.jobScore.deleteMany({ where: { userId } });

    logUserAction(
      user,
      "resume.upload",
      `saved "${filename}" (${(content.length / 1000).toFixed(1)}KB text), cleared old scores`
    );

    return NextResponse.json({
      message: "Resume saved.",
      resume,
      scoresCleared: true,
    });
  } catch (e) {
    console.error("[user/resume]", e);
    return NextResponse.json({ error: "Failed to save resume." }, { status: 500 });
  }
}
