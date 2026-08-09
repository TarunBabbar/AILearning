import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Admin-only list of Score Jobs accounts.
 *
 * Auth: header must match non-empty USERS_ADMIN_API_KEY from .env
 *   - x-api-key: <key>
 *   - or Authorization: Bearer <key>
 *
 * GET /api/users
 * Call from Postman / curl — no session cookie required.
 */
function extractApiKey(req: Request): string {
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;

  const auth = req.headers.get("authorization")?.trim() || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function keysMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const expected = (process.env.USERS_ADMIN_API_KEY || "").trim();
    if (!expected) {
      return NextResponse.json(
        {
          error:
            "USERS_ADMIN_API_KEY is not set (or empty). Configure a non-empty value in .env to enable this endpoint.",
        },
        { status: 503 }
      );
    }

    const provided = extractApiKey(req);
    if (!provided || !keysMatch(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const rows = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        resume: {
          select: {
            filename: true,
            mimeType: true,
            updatedAt: true,
          },
        },
        _count: { select: { scores: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const users = rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      hasResume: Boolean(u.resume),
      resume: u.resume
        ? {
            filename: u.resume.filename,
            mimeType: u.resume.mimeType,
            updatedAt: u.resume.updatedAt,
          }
        : null,
      scoreCount: u._count.scores,
    }));

    return NextResponse.json({
      total: users.length,
      users,
    });
  } catch (e) {
    console.error("[users GET]", e);
    return NextResponse.json(
      { error: "Failed to list users." },
      { status: 500 }
    );
  }
}
