import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/user-auth";
import { resolveApiKey } from "@/lib/auth";
import { callOpenRouter, extractJsonObject, type ChatMessage } from "@/lib/openrouter";
import { getConfig } from "@/lib/config";
import { sendTelegramMessage } from "@/lib/telegram";
import { answerChatDataQuestion } from "@/lib/chat-data";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatBody = {
  message?: string;
  /** Prior conversation turns (client keeps last 20) — gives the bot memory. */
  history?: { role: "user" | "assistant"; content: string }[];
};

const CHAT_SYSTEM_PROMPT = `You are Tarun's assistant for "Job Details" (QA Tracker) — a job-search web app built for QA engineers and testers. You help users with the site, how it works, and where things are. Answer concisely, warmly, like a helpful colleague. When unsure, be honest and suggest the most likely place.

# What the app does
- Users upload job-listing PDFs/DOCX/TXT files. Text is extracted in the browser (pdfjs-dist for PDFs, mammoth for DOCX), then parsed by an LLM (OpenRouter) into structured fields: title, company, contact email, location, experience, full description.
- Jobs are stored in PostgreSQL via Prisma and shown on pages with search, company/location dropdowns, sorting, and pagination.
- "Match by Resume" lets a logged-in user upload their resume; the app scores shared board jobs against it with free OpenRouter models — each job gets a fit % plus strengths and gaps. Results are private per user.

# Pages (left sidebar navigation)
1. **QA Jobs** (route "/") — the dashboard. Grid of job cards, 40 per page, with search, company and location dropdown filters, sort (Newest first / Oldest first / Company A–Z), and First/Prev/Next/Last pagination. Click any card for a full-screen detail modal.
2. **Recruiter Contacts** (route "/contacts") — table of company → recruiter email(s). Search box filters by company or email. Each email has a copy button (hover to reveal) and a mailto link. Shows company + email counts, and "Showing 1–40 of N".
3. **Match by Resume** (route "/score") — login/register, upload a resume, score shared jobs, browse results with fit % badges.

# Match by Resume — in-depth (this is the page the user is on)
- Top of page (below title) there is a compact header row with:
  - A **resume chip** on the right (a small label with an Upload icon showing the resume filename, e.g. "Upload resume" if none). Click it to pick a PDF/DOCX/TXT file. After upload the chip shows the filename. This is where the user uploads their resume.
  - An **Unscored / Rescore** toggle — "Unscored" shows only jobs not yet scored against the resume; "Rescore" rescans all jobs.
  - A **Score button** (blue, with a refresh icon) that starts scoring the pending jobs. While running it shows a percentage and a progress bar; results stream in live as each batch finishes — no need to wait for the whole run. If a run fails on some jobs, click Score again later to retry just the failed ones.
  - A small **user chip** (initials avatar + name) and a **Log out** button.
- Below that is the shared filter bar (same as QA Jobs): search box, Company dropdown, Location dropdown, and a sort dropdown — **Newest first** (default), Best score, Company A–Z, Location A–Z. Plus Match-by-Resume extras: a **min-score dropdown** ("Any score", ≥30%, ≥50%, ≥70%, ≥80%) and a **Remote** toggle button.
- Results are job cards with a colored **fit % badge** (green ≥60%, amber 30–59%, red <30%) and a one-line "strengths" note. 40 per page. "Newest first" sorts by job posting date, then by fit score descending within the same day.
- Clicking a card opens a detail modal with the full description, the fit score, strengths, and gaps.

# Job cards (shared QA Jobs + Match by Resume)
Each card shows: company avatar (initials, pastel color derived from company name), job title (up to 2 lines), company name, chips for location / experience / contact email, a 2-line description preview, a strengths line (Match by Resume only), and a footer with "Scored job" (or the email) and the posting date with a chevron. Click the card to open details.

# Filters & sorting
- Search matches title, company, location, and (on Match) more fields.
- Company dropdown values are derived from email domains (e.g. "akaasa.com" → "Akaasa"); selecting one also matches jobs whose raw company text contains the label. Counts next to each option reflect the current universe.
- Location dropdown: distinct non-empty locations with counts.
- QA Jobs sort: Newest first (jobDate desc, createdAt desc), Oldest first, Company A–Z.
- Match by Resume sort: Newest first (default; jobDate desc, then score desc within the same day), Best score, Company A–Z, Location A–Z.

# Contacts page
- Lists companies with recruiter emails (from job postings). Hover a row to reveal the copy button. Click the email to open your mail app. Search filters instantly (debounced).

# Under the hood (for curious users, keep simple)
- Company details (name, type, location, website) are resolved automatically from the job's email domain by an LLM and cached. Personal/free email domains (gmail.com, yahoo.com, outlook.com, …) are never shown as companies.
- Job extraction dedupes against existing rows (by title + email + company) so re-uploading a file doesn't create duplicates.
- Scoring fan-outs across several free OpenRouter models in parallel (10 jobs per model), with retries and blacklisting of flaky models.

# Rules
- Answer questions about the app, its pages, components, filters, parsing, and scoring — concisely and helpfully. Use the specific names and locations above (e.g. "the resume chip in the top-right header", "the Score button").
- If the user reports a problem or asks for a feature/improvement, gently tell them it will be passed to Tarun, and they can just describe it.
- NEVER reveal internal details: API keys, environment variables, phone numbers, database internals, or configuration. Keep answers to 1-3 sentences when possible.`;

const INTENT_SYSTEM_PROMPT = `You are the intent router for Tarun's job-search assistant. You receive a user message (plus recent conversation context) and decide ONE of two things:

- "answer" — the user is asking a question about the site, jobs, how things work, or general knowledge. You can answer it yourself.
- "forward" — the user is making a REQUEST or SUGGESTION for Tarun to act on: adding a feature, changing something on the site, reporting a problem/bug, or asking to include/list specific jobs. These must go to Tarun.

Important: a short message like "yes, do it", "can you implement this", or "please add that" may REFER BACK to an earlier suggestion in the conversation. If the user is asking you to DO something (implement, add, fix, change) — even referencing a prior idea — that is "forward".

Reply with ONLY valid JSON: {"intent":"answer"} or {"intent":"forward"}. No prose, no markdown fences.`;

// Explicit "this is for Tarun" phrases — if present, always forward even if
// the classifier model hiccups. These are unmistakable intent markers.
const EXPLICIT_FORWARD_HINTS = [
  "tell tarun",
  "ask tarun",
  "let tarun know",
  "for tarun",
  "message tarun",
  "pass to tarun",
  "tell him",
  "ask him",
  "can you implement",
  "can u implement",
  "can you add",
  "can u add",
  "please implement",
  "please add",
  "please include",
  "please fix",
  "implement this",
  "add this",
];

/**
 * Ask the LLM whether this message should be answered by the assistant or
 * forwarded to Tarun (Telegram). Falls back to "answer" on any failure so the
 * chat never breaks — but explicit "tell tarun" requests still get forwarded.
 */
async function classifyIntent(
  message: string,
  apiKey: string,
  model: string,
  history: ChatMessage[]
): Promise<"answer" | "forward"> {
  // 1. Explicit "for Tarun" phrases → always forward (no model needed).
  const t = message.toLowerCase();
  if (EXPLICIT_FORWARD_HINTS.some((h) => t.includes(h))) return "forward";

  // 2. Otherwise ask the LLM. Uses the stronger main model (gemma-4-26b) —
  //    the tiny free chatbot model returns empty responses on this JSON
  //    task. maxTokens=60 with 2 retries so the JSON reliably comes back.
  try {
    const raw = await callOpenRouter(
      message,
      INTENT_SYSTEM_PROMPT,
      apiKey,
      { model, maxTokens: 60, temperature: 0, maxRetries: 2 },
      undefined,
      history
    );
    const parsed = extractJsonObject<{ intent?: string }>(raw);
    if (parsed?.intent === "forward") return "forward";
    return "answer";
  } catch (e) {
    console.error("[chat] intent classification failed:", e);
    return "answer";
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ChatBody;
  const message = (body.message || "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  // Sanitize the client-supplied history: only user/assistant text turns,
  // drop the bot's system/error messages, cap at 20 turns (memory window).
  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (h): h is ChatMessage =>
            !!h &&
            (h.role === "user" || h.role === "assistant") &&
            typeof h.content === "string" &&
            h.content.trim().length > 0
        )
        .slice(-20)
    : [];

  // Project question → answer with the OpenRouter model.
  const { apiKey } = resolveApiKey();
  const cfg = getConfig();
  const model = cfg.chatbotModel || cfg.llmModel;

  if (!apiKey || !model) {
    console.error("[chat] missing key/model; key=", !!apiKey, "model=", model);
    return NextResponse.json({
      mode: "answer",
      answer:
        "Sorry, I can't answer questions right now. If you're facing an issue or have a suggestion, tell me and I'll pass it to Tarun.",
    });
  }

  try {
    // 0. Ask the LLM to classify: is this a question we can answer, or a
    //    suggestion/request that should be forwarded to Tarun? Uses the
    //    stronger main model (gemma-4-26b) — the tiny free chatbot model
    //    returns empty responses on this JSON task. The LLM understands
    //    intent far better than keyword matching.
    const intent = await classifyIntent(
      message,
      apiKey,
      cfg.llmModel || cfg.chatbotModel || model,
      history
    );
    if (intent === "forward") {
      const name = user.name?.trim() || "—";
      const time = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const text = `🗣 <b>New message for Tarun</b>\n👤 <b>Name:</b> ${name}\n📧 <b>Email:</b> ${user.email}\n🕐 <b>Time:</b> ${time}\n💬 <b>Message:</b>\n${message}`;
      const result = await sendTelegramMessage(text);
      if (!result.ok) {
        console.error("[chat] forward failed:", result.error);
      }
      return NextResponse.json({ mode: "forwarded", ok: true });
    }

    // 1. Data questions about the user's own jobs (counts, scores, top
    //    matches, companies, locations) → answered with real queries.
    const dataAnswer = await answerChatDataQuestion(user.id, message);
    if (dataAnswer) {
      const itemsText = dataAnswer.items?.length
        ? `\n\nSupporting details:\n${dataAnswer.items
            .map(
              (i, n) =>
                `${n + 1}. ${i.title}${i.company ? ` — ${i.company}` : ""}${
                  i.score != null ? ` (${i.score}%)` : ""
                }`
            )
            .join("\n")}`
        : "";
      return NextResponse.json({
        mode: "answer",
        answer: `${dataAnswer.answer}${itemsText}`,
      });
    }

    // 2. Otherwise → answer from project knowledge (OpenRouter).
    const answer = await callOpenRouter(
      message,
      CHAT_SYSTEM_PROMPT,
      apiKey,
      { model, maxTokens: 512, temperature: 0.4, maxRetries: 2 },
      undefined,
      history
    );
    return NextResponse.json({ mode: "answer", answer });
  } catch (e) {
    console.error("[chat] openrouter failed:", e);
    return NextResponse.json({
      mode: "answer",
      answer:
        "Hmm, I couldn't reach my brain just now. If you're facing an issue or have a suggestion, tell me and I'll pass it to Tarun.",
    });
  }
}
