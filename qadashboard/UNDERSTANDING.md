# QA AI Dashboard — Understanding Document

> **Purpose:** This file is the developer's mental model of the project. Read this FIRST before changing code. It documents what exists, how it fits together, and the important gotchas.

## Overview

QA AI Dashboard is a unified platform consolidating 6 existing projects into one Next.js 15 app. Built for QA professionals who need resume-job matching, AI interview preparation, document RAG, test case generation, and AI learning — all in one UI.

**Hosted on Vercel (free) | DB: Neon PostgreSQL (free, optional) | Vector: Pinecone (free, optional) | AI: OpenRouter free models**

**The single most important thing to know:** the app runs **fully in-memory** (`globalThis` maps). It works with zero external services — only `OPENROUTER_API_KEY` is needed for AI features. The Prisma schema and Pinecone pipeline exist but are **not used by the live API routes** (except the optional seed route).

---

## The 6 Modules

### 1. Dashboard (`/`)
Stat cards (Documents, Q&A Pairs, Jobs, Topics, Projects) from `/api/stats` + quick-action cards linking to each module.

### 2. QA Interview Prep (`/qa`, `/qa/topics`)
- Streaming chat grounded in `data/ai-topics.json` (84 topics, **510 Q&A pairs**).
- **Live retrieval is keyword-overlap matching, NOT Pinecone** (see "Two RAG paths" below).
- Topic browser at `/qa/topics` (two-panel: topic list + Q&A accordion).
- Model dropdown (4 free models) + a pipeline explainer bar on the page.

### 3. Document RAG (`/documents`, `/documents/[id]`)
Upload PDF/DOCX/TXT/MD/CSV/XLSX → stored in-memory → per-document chat. Note: the chat route ignores the `namespace` param; retrieval is the same keyword-match over `ai-topics.json`, not the uploaded doc.

### 4. Test Architect (`/test-architect`, `/test-architect/projects`)
Paste PRD + optional JIRA key → LLM generates structured test cases (title, description, steps with action/expected, priority, test type). Projects CRUD is in-memory.

### 5. AI Learning Tutor (`/learn`)
Chat-based tutor reusing the same `ChatArea` (namespace `learning`, no sources shown).

### 6. Settings (`/settings`)
Configure OpenRouter key, Gmail SMTP, AI model. **In-memory only** — values are saved to a `globalThis` blob, not persisted or actually used by the email flow.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 15 (App Router) | React 19, TypeScript strict |
| **Styling** | Tailwind CSS v4 | `@theme inline` custom palette (warm cream) |
| **AI Provider** | OpenRouter | Free models; referer header `https://qa-dashboard.vercel.app` |
| **Embeddings** | OpenRouter `text-embedding-3-small` | 1536-dim |
| **Vector Store** | Pinecone (v8 SDK) | Used only by seed scripts + `/api/seed` |
| **Database** | Neon PostgreSQL + Prisma 6 | Schema defined, **unused at runtime** |
| **Auth** | Salted SHA-256 + bearer tokens | In-memory, 7-day expiry |
| **Markdown** | react-markdown + remark-gfm + rehype-highlight | Used in ChatArea |

---

## Auth System

- **Hashing:** Node `crypto.createHash("sha256")` with 16-byte random salt. Stored as `"salt:hash"`.
- **Tokens:** `randomUUID()` stored in in-memory `Map`, **7-day expiry**.
- **Store:** In-memory `globalThis.__users`. Falls back to nothing — no DB.
- **Default user:** `TarunBabbar` / `TarunBabbar` — auto-created on first `authenticateUser()` call; `/api/auth/seed` also creates it explicitly.
- **Flow:** Login → server validates → returns `{ user, token }` → client saves to `localStorage("qa_token")` → every request sends `Authorization: Bearer <token>`.
- **Guard:** Client-side only via `ProtectedLayout` — **no middleware, no cookies, no HTTP-only tokens**. Anyone can read the page HTML; protection is UX-level.

---

## Two "RAG" Paths (important)

### Path A — LIVE chat (`/api/chat`) — what users actually hit
```
User Question → score all 510 questions in ai-topics.json (keyword overlap + substring boost)
  → top 3 matches (deduped by source + question)
  → build context from matched Q&A pairs
  → OpenRouter LLM (selected free model) → stream clean answer
  → NDJSON: {type:"sources"} → {type:"chunk"}* → {type:"done"}
```
No Pinecone, no embeddings. The LLM is asked to answer ONLY from the context and to remove duplicated/garbled text.

### Path B — RAG infra (`lib/rag/*`) — prepared but NOT wired to the app
```
User Question → getEmbedding() → 1536-dim vector
  → Pinecone.query(vector, topK=5) → 5 most relevant chunks
  → Build context with [Source: filename] markers
  → Call OpenRouter LLM → answer
```
`lib/rag/rag-chain.ts` implements this end-to-end (`answerQuestion()`), and `lib/rag/pinecone-store.ts` is a Pinecone v8 wrapper — but **nothing in `app/`, `components/`, or `scripts/` imports them**. To make the app use real vector search, wire `answerQuestion()` into `/api/chat`.

---

## Streaming Chat Contract

- `/api/chat` returns `Content-Type: application/x-ndjson` (one JSON object per line).
- Events: `{type:"sources", content:[{source,score}]}` → `{type:"chunk", content:"..."}` (40-char pieces) → `{type:"done"}`.
- `ChatArea` parses this with `fetch` → `ReadableStream` → `getReader()`.
- **Gotcha:** ChatArea state updaters MUST return new state objects (pure). React StrictMode double-invokes updaters; mutating `last.content += ...` in-place produced duplicated/garbled text. This was fixed — don't reintroduce it.

---

## API Routes Reference

### Auth
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/auth/login` | POST | Validates creds, returns `{user, token}` |
| `/api/auth/logout` | POST | No-op; client clears `localStorage.qa_token` |
| `/api/auth/me` | GET | Bearer token → `{user|null}` |
| `/api/auth/seed` | POST | Creates default `TarunBabbar` user |

### Chat
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/chat` | POST | NDJSON stream; body `{question, namespace?, model?, systemMessage?}` |
| `/api/chat/suggestions` | GET | Top-4 suggestion questions picked greedily from `ai-topics.json` (keyword frequency + topic diversity + length penalty) |

### Resume & Jobs (all in-memory `globalThis.__jobs`)
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/resume` | POST/GET | Upload resume (stub — no real parsing) |
| `/api/jobs` | POST/GET | Upload job listings (naive line parser) / list with `?status=` |
| `/api/jobs/score` | POST | LLM batch-scoring (4 at a time); random-score fallback on parse failure |
| `/api/jobs/email` | POST | Marks job emailed; **Gmail creds are ignored (mock)** |
| `/api/jobs/[id]` | PATCH/DELETE | Status update / soft-delete |

### Documents (in-memory `globalThis.__docs`)
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/documents` | POST/GET | Upload files / list (content stripped) |
| `/api/documents/[id]` | DELETE | Hard delete |

### Test Architect / Projects (in-memory `globalThis.__projects`)
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/test-cases/generate` | POST | Body `{prdText, jiraKey?}` → JSON test cases from LLM (fallback: 3 canned) |
| `/api/projects` | GET/POST | List / create projects |
| `/api/projects/[id]` | DELETE | Delete project |

### Other
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/topics` | GET | Full topic + Q&A dump from `ai-topics.json` |
| `/api/settings` | GET/PUT | In-memory settings blob |
| `/api/stats` | GET | Counts from `ai-topics.json`; jobs/docs/projects hardcoded 0 |
| `/api/seed` | POST | Optional Pinecone seeder (needs `PINECONE_API_KEY`) |

---

## Data Layer

### `data/ai-topics.json`
```
Array<{ name: string, questions: Array<{ question: string, answer: string, source: string }> }>
```
- **84 topics, 510 Q&A pairs.** `source` is the original PDF/docx filename.
- Topics span: Prompt Engineering, LLMs, AI in Testing, Selenium (many subtopics), Java, SQL, TestNG, Cucumber/BDD, Agile, Git, Testing levels/types, Defect Management, Test Design, Soft Skills, and more.
- This is the knowledge base for the live chat, the topics browser, and the stats page. Keep it in sync if you change chat retrieval.

### Prisma schema (9 tables) — defined but unused at runtime
- `User`, `UserSettings`, `Resume`, `Job`, `Document`, `Project`, `TestCase`, `Conversation`, `Message`.
- All runtime stores (`__jobs`, `__docs`, `__projects`, `__users`, `__tokens`, `__settings`) live on `globalThis` and **reset on server restart / Vercel cold start**. No migration has been applied and `prisma/seed.ts` doesn't exist (the `db:seed` script is broken).

---

## AI / LLM Integration (`lib/openrouter.ts`)

- `chatCompletion(messages, model?, temperature=0.7, maxTokens=4096)` — non-streaming.
- `chatCompletionStream(...)` — async generator over SSE; used by `/api/chat`.
- Headers: `Authorization: Bearer <key>`, `HTTP-Referer: https://qa-dashboard.vercel.app`, `X-Title: <appName>`.
- Config from `lib/config.ts` (env-driven, see README env table).
- **Free model IDs used:**
  - `google/gemma-4-26b-a4b-it:free` (default)
  - `nvidia/nemotron-3-super-120b-a12b:free` (QA default)
  - `meta-llama/llama-3.3-70b-instruct:free`
  - `qwen/qwen3-next-80b-a3b-instruct:free`
  - `tencent/hy3:free`
  - `google/gemini-2.5-flash-lite` (settings)

---

## Key Components

| File | Purpose |
|------|---------|
| `components/ui/ChatArea.tsx` | Reusable streaming chat: suggestions chips, `?ask=` deep-link, NDJSON parsing, markdown rendering, collapsible sources |
| `components/ui/Sidebar.tsx` | Collapsible nav with module sections + user area/logout |
| `components/ui/ProtectedLayout.tsx` | Client-side auth guard |
| `lib/auth.ts` | Hashing, tokens, users (in-memory) |
| `lib/auth-context.tsx` | `useAuth()` hook; token in `localStorage.qa_token` |
| `lib/openrouter.ts` | LLM client (sync + streaming) |
| `lib/embeddings.ts` | Embedding client |
| `lib/rag/*` | Prepared-but-unused RAG pipeline (Pinecone) |
| `lib/config.ts` | Env config reader |

---

## Scripts (`scripts/`, run with `npx tsx`, load `.env` via dotenv)

| Script | Purpose |
|--------|---------|
| `seed-pinecone.ts` | Main seeder: embed `ai-topics.json` → Pinecone (`PINECONE_INDEX_NAME` / `PINECONE_NAMESPACE`) |
| `query-pinecone.ts` / `query-default.ts` | Query Pinecone namespaces (dummy + real embedding) |
| `check-account*.ts`, `check-pinecone.ts`, `check-index.ts` | Pinecone account/index diagnostics |
| `inspect-chunks*.ts` | List/fetch vectors + print metadata text |
| `debug-match.ts` | Reproduce the `/api/chat` scoring algorithm on a question |
| `probe-chat.ts`, `probe2.ts` | Hit local `/api/chat` and dump the NDJSON stream |

**Note:** these scripts are dev utilities. Keep API keys out of them — always read from `.env`.

---

## Theme

Claude.ai warm-cream palette (defined in `app/globals.css` via `@theme inline`):
- Page bg: `#faf8f5` (--color-bg-page) · Sidebar: `#f0ece3` · Surface: `#f5f2eb` · User bubble: `#e8e0d1`
- Border: `#e6dfd1` · Focus: `#d97706` (amber) · Text primary: `#1a1410` · Muted: `#978f85`
- Mono font: "JetBrains Mono"

---

## Known Gaps / Gotchas

1. **Everything resets on restart** — jobs, docs, projects, users, tokens are in-memory.
2. **`/api/chat` ignores `namespace`** — all chats use the same `ai-topics.json` keyword retrieval.
3. **`lib/rag/*` is dead code** until wired into `/api/chat`.
4. **Email flow is a mock** — Gmail creds in `/api/jobs/email` are ignored.
5. **Resume parsing is a stub** — `/api/resume` doesn't extract text; job scoring uses hardcoded resume text.
6. **`prisma/seed.ts` missing** — `npm run db:seed` fails.
7. **No middleware** — auth is client-side only.
8. **ChatArea state updaters must be pure** (StrictMode double-invoke — duplication bug).
9. **Settings are in-memory** — the OpenRouter key entered there is not actually used by `lib/config.ts` (which reads `.env`).

---

## Deployment Notes

- **Vercel free tier:** 100GB bandwidth, 6000 build minutes/month — sufficient.
- `vercel.json`: framework `nextjs`, `buildCommand: next build`, `installCommand: npm install`.
- `.env` must have at minimum `OPENROUTER_API_KEY` for AI features.
- Pin `@pinecone-database/pinecone` to v8 (v7 uses `vectors` key, v8 uses `records` key in upsert).
- Auth works entirely in-memory — no DB required to login.

---

## Monorepo Context

This dashboard is designed to **replace** (not duplicate) 6 existing projects in the `AILearning/` monorepo:

| Old Project | Status |
|-------------|--------|
| `resume-parser/` | ✅ Merged |
| `qa-interview-preparation-kit/` | ✅ Merged |
| `qaragplatform/` | ✅ Merged |
| `ai-testarchitect/` | ✅ Merged |
| `interview-preparation/` | ⏸️ Reference only |
| `learning-playwright-typescript-framework/` | ⏸️ Reference only |
