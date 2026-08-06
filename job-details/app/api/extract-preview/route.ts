import { NextResponse } from "next/server";

/**
 * POST /api/extract-preview
 * Body: { text } — preview how many jobs an LLM finds in pasted text.
 * Useful for the "paste text" fallback in Upload.
 */
export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return NextResponse.json({ error: "Text too short." }, { status: 400 });
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return NextResponse.json({ ok: true, words: wordCount, chars: text.length });
  } catch {
    return NextResponse.json({ error: "Failed to parse text." }, { status: 500 });
  }
}
