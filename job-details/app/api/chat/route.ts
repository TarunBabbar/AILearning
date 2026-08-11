import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/user-auth";
import { resolveApiKey } from "@/lib/auth";
import { callOpenRouter, type ChatMessage } from "@/lib/openrouter";
import { getConfig } from "@/lib/config";
import { sendTelegramMessage } from "@/lib/telegram";
import { buildUserContext } from "@/lib/chat-data";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatBody = {
  message?: string;
  /** "question" (AI answers) | "message" (force forward to Tarun) | undefined (classify). */
  mode?: "question" | "message";
  /** Prior conversation turns (client keeps last 20) — gives the bot memory. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** User context snapshot (project + user data), cached client-side. When
   *  present, the server skips the per-message DB query for faster answers. */
  context?: string;
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

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ChatBody;
  const message = (body.message || "").trim();
  const explicitMode = body.mode === "message" ? "message" : "question";

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
    // Mode strictly controls the flow:
    //   "message" → forward to Tarun (no classifier).
    //   "question" → the LLM ALWAYS answers. Never forward — the user chose
    //                to ask the AI, so it must reply with its own answer.
    if (explicitMode === "message") {
      const name = user.name?.trim() || "—";
      const time = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Include the conversation history so Tarun sees the full context,
      // not just the final message.
      const historyText = history.length
        ? `\n\n🗨 <b>Conversation so far:</b>\n${history
            .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
            .join("\n")}`
        : "";

      const text = `🗣 <b>New message for Tarun</b>\n👤 <b>Name:</b> ${name}\n📧 <b>Email:</b> ${user.email}\n🕐 <b>Time:</b> ${time}\n💬 <b>Message:</b>\n${message}${historyText}`;
      const result = await sendTelegramMessage(text);
      if (!result.ok) {
        console.error("[chat] forward failed:", result.error);
      }
      return NextResponse.json({ mode: "forwarded", ok: true });
    }

    // 1. Use the client-cached user context when available (fast — no
    //    per-message DB query). Fall back to building it server-side.
    //    Injected into the LLM's prompt so it answers all questions from
    //    real data + project knowledge — no regex routing.
    const userContext = body.context?.trim()
      ? body.context
      : await buildUserContext(user.id);
    const systemPrompt = `${CHAT_SYSTEM_PROMPT}

# The user's current job data (real, from their account)
${userContext}

Use this data when the user asks about their own jobs, scores, companies, or locations. If they ask about something not covered here, answer from the site knowledge above. Never invent numbers.`;

    const answer = await callOpenRouter(
      message,
      systemPrompt,
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
