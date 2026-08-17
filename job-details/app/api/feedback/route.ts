import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/user-auth";
import { getUserForLog, logUserAction } from "@/lib/action-log";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { shouldApproveReview } from "@/lib/review-quality";

export const runtime = "nodejs";

/**
 * POST /api/feedback
 * Body: { name, email, rating, message }
 * Stores a user's review/feedback about the portal. Optional login — a
 * logged-in user's id is linked automatically.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (rateLimited(`feedback:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      rating?: number;
      message?: string;
    };
    const name = (body.name || "").trim().slice(0, 100);
    const email = (body.email || "").trim().toLowerCase().slice(0, 200);
    const rating = Math.round(Number(body.rating));
    const message = (body.message || "").trim().slice(0, 2000);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }
    if (!message || message.length < 10) {
      return NextResponse.json(
        { error: "Please write a short review (at least 10 characters)." },
        { status: 400 }
      );
    }

    const userId = await getSessionUserId();
    const feedback = await prisma.feedback.create({
      data: {
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        name,
        email,
        rating,
        message,
        approved: false,
      },
      select: { id: true, rating: true, createdAt: true },
    });

    const logUser = await getUserForLog(userId);
    logUserAction(logUser || { id: "anon", email }, "feedback.submit", `${rating}★ by ${name}`);

    // Fire-and-forget: ask the LLM whether this review is meaningful enough to
    // show publicly. Gibberish/spam stays hidden (approved=false).
    shouldApproveReview(name, message)
      .then((approved) => prisma.feedback.update({ where: { id: feedback.id }, data: { approved } }))
      .catch((e) => console.error("[feedback] approval check failed:", e));

    return NextResponse.json({ ok: true, id: feedback.id });
  } catch (e) {
    console.error("[feedback]", e);
    return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
  }
}

/**
 * GET /api/feedback
 * Returns the TOP approved reviews for public display — only LLM-approved
 * and 4★+ ratings, best first, capped at 10. Junk/gibberish stays hidden.
 */
export async function GET() {
  try {
    const [reviews, avg] = await Promise.all([
      prisma.feedback.findMany({
        where: { approved: true, rating: { gte: 4 } },
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: { id: true, name: true, rating: true, message: true, createdAt: true },
      }),
      prisma.feedback.aggregate({ _avg: { rating: true }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      reviews,
      averageRating: avg._avg.rating ? Math.round(avg._avg.rating * 10) / 10 : null,
      reviewCount: avg._count.id,
    });
  } catch (e) {
    console.error("[feedback] GET", e);
    return NextResponse.json({ error: "Failed to load feedback." }, { status: 500 });
  }
}
