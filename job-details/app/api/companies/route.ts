import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/companies — list companies with job counts, sorted by count desc.
 */
export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      include: { _count: { select: { jobs: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ companies });
  } catch (e) {
    console.error("[companies] error:", e);
    return NextResponse.json({ error: "Failed to load companies." }, { status: 500 });
  }
}
