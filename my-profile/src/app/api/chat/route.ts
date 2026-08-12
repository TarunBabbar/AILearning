import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { chatCompletionWithFallback, type ChatMessage } from "@/lib/openrouter";
import { buildSystemPrompt } from "@/lib/profile-knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 12;
const FORWARD_MARKER = "[FORWARD_TO_TARUN]";

// Best-effort in-memory rate limit (per server instance; on serverless this
// is per-warm-instance — documented guard for the ~20 req/min free tier).
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function buildWaLink(summary: string): string {
  const cfg = getConfig();
  if (!cfg.whatsappNumber) return "";
  const text = `Hello Tarun! A visitor on your profile asked: ${summary} — Tarun's AI Assistant`;
  return `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: { role: string; content: string }[];
    mode?: "question" | "message";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ type: "error", content: "Invalid request body." }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ type: "error", content: "Messages required." }, { status: 400 });
  }

  const userMessage = messages[messages.length - 1]?.content || "";
  if (!userMessage.trim()) {
    return NextResponse.json({ type: "error", content: "Empty message." }, { status: 400 });
  }
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { type: "error", content: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` },
      { status: 400 }
    );
  }

  // "message" mode → forward straight to WhatsApp (user explicitly chose to
  // message Tarun). "question" mode → the LLM ALWAYS answers; never forward.
  const explicitMode = body.mode === "message" ? "message" : "question";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { type: "error", content: "You're sending messages too fast. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  // Keep only the most recent history + the current message.
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
  }));

  const cfg = getConfig();
  if (!cfg.openrouterApiKey) {
    return NextResponse.json(
      {
        type: "error",
        content: "Sorry, I'm unable to chat right now. Please try again later, or message Tarun directly on WhatsApp.",
        waLink: buildWaLink(userMessage.slice(0, 300)),
        botName: cfg.botName,
        profileOwner: cfg.profileOwner,
      },
      { status: 200 }
    );
  }

  if (cfg.freeModels.length === 0) {
    return NextResponse.json(
      {
        type: "error",
        content: "Sorry, I'm unable to chat right now. Please try again later.",
        botName: cfg.botName,
        profileOwner: cfg.profileOwner,
      },
      { status: 500 }
    );
  }

  const llmMessages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...trimmed,
  ];

  // "message" mode → the user explicitly chose to message Tarun. Forward
  // directly to WhatsApp — no LLM call, no marker detection.
  if (explicitMode === "message") {
    const summary = userMessage.slice(0, 600);
    return NextResponse.json({
      type: "forward",
      content: `Thanks! Your message has been prepared for Tarun. Tap below to send it to him on WhatsApp — he'll get back to you.`,
      waLink: buildWaLink(summary),
      summary,
    });
  }

  try {
    const { content, model, modelName } = await chatCompletionWithFallback(llmMessages, cfg.freeModels);

    const markerIndex = content.indexOf(FORWARD_MARKER);
    if (markerIndex !== -1) {
      // LLM decided this is outside profile knowledge → summarize + forward to WhatsApp.
      // Take everything after the LAST marker (models sometimes echo the marker
      // mid-answer), then clean up template scaffolding the model may copy.
      const lastMarker = content.lastIndexOf(FORWARD_MARKER);
      const rawSummary = content.slice(lastMarker + FORWARD_MARKER.length);
      const cleaned = rawSummary
        .replace(/<[^>]*>/g, " ") // strip any <summary>…</summary> tags
        .replace(/[\[\]]/g, "") // strip stray brackets
        .replace(/\s+/g, " ")
        .trim();
      const summary = cleaned.length >= 10 ? cleaned : userMessage;
      const safeSummary = summary.slice(0, 600);
      return NextResponse.json({
        type: "forward",
        content: `That's outside what I can answer from the profile, but I've prepared a message for Tarun. Tap below to send it to him on WhatsApp — he'll get back to you.`,
        model,
        modelName,
        waLink: buildWaLink(safeSummary),
        summary: safeSummary,
      });
    }

    return NextResponse.json({ type: "answer", content, model, modelName });
  } catch (err) {
    console.error("[TarunAIAssistant] All models failed:", err);
    // TEMP: expose failure detail for debugging
    return NextResponse.json(
      {
        type: "error",
        content:
          "All my AI models are temporarily unavailable (free-tier limits or maintenance). Please try again in a bit, or message Tarun directly on WhatsApp.",
        waLink: buildWaLink(userMessage.slice(0, 300)),
        debug: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }
}
