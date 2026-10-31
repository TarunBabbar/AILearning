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

export async function POST(req: NextRequest) {
  let body: {
    messages?: { role: string; content: string }[];
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
        content: "Sorry, I'm unable to chat right now. Please try again later.",
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

  try {
    const { content, model, modelName } = await chatCompletionWithFallback(llmMessages, cfg.freeModels);

    const markerIndex = content.indexOf(FORWARD_MARKER);
    if (markerIndex !== -1) {
      // LLM decided this is outside profile knowledge → point the visitor to LinkedIn.
      return NextResponse.json({
        type: "forward",
        content:
          "That's outside what I can answer from the profile — connect with Tarun on LinkedIn ([linkedin.com/in/tarunbabbar](https://linkedin.com/in/tarunbabbar)) and he'll get back to you.",
        model,
        modelName,
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
          "All my AI models are temporarily unavailable (free-tier limits or maintenance). Please try again in a bit.",
        debug: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }
}
