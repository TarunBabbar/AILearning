# QA AI Dashboard — Understanding Document

## Overview

QA AI Dashboard is a unified platform consolidating 6 existing projects into one Next.js 15 app. Built for QA professionals who need resume-job matching, AI interview preparation, document RAG, test case generation, and AI learning — all in one UI.

**Hosted on Vercel (free) | DB: Neon PostgreSQL (free) | Vector: Pinecone (free) | AI: OpenRouter free models**

---

## What It Does (6 Modules)

### 1. Resume & Job Matcher
Upload resume (PDF/DOCX) + job listing PDFs. AI extracts job details, scores 0-100 match against resume, shows strengths/gaps. Status workflow: new → emailed → waiting → interviewing → offered. Bulk email via Gmail SMTP.

### 2. QA Interview Prep
Streaming RAG chat. 400+ QA interview Q&A pairs (pre-seeded from real interview PDFs). Ask questions, get answers with source citations. Browse by topic (by-file or AI-refined classification).

### 3. Document RAG
Upload PDF/DOCX/TXT/MD/CSV/XLSX → text chunked → embedded → stored in Pinecone. Ask questions grounded in document content.

### 4. Test Architect
Paste PRD requirements → AI extracts features/acceptance criteria → generates structured test cases with steps, priority, type. Support for JIRA key context.

### 5. AI Learning Tutor
Chat-based tutor for learning QA concepts. Uses RAG on curriculum docs.

### 6. Settings
Configure OpenRouter key, Gmail SMTP, select AI model.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 15 (App Router) | Vercel-native, supports pages + API routes |
| **Database** | Neon PostgreSQL + Prisma ORM | Free serverless (500MB), type-safe queries |
| **Vector Store** | Pinecone (v8 SDK) | Free tier (1 pod, 100K vectors), proven in existing qa-interview-kit |
| **AI Provider** | OpenRouter | Free models: `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-3-super:free`, `meta-llama/llama-3.3-70b:free` |
| **Embeddings** | OpenRouter API `text-embedding-3-small` | 1536-dim vectors, batch support |
| **Auth** | PBKDF2-SHA256 + Bearer tokens | No bcrypt dependency. Lazy-creates default user `TarunBabbar` on first login |
| **Styling** | Tailwind CSS v4 + Claude.ai warm cream theme | `#faf8f5` bg, `#f0ece3` sidebar, `#d97706` amber accent |
| **Icons** | lucide-react | Used across all components |
| **Markdown** | react-markdown + remark-gfm + rehype-highlight | Table support, code highlighting, GFM |

---

## Key Code Architecture

### Folder Structure
```
qadashboard/
├── app/                          ← Next.js App Router
│   ├── layout.tsx                ← Root layout (AuthProvider → ProtectedLayout → SidebarProvider)
│   ├── page.tsx                  ← Dashboard (stats + action cards)
│   ├── login/page.tsx            ← Login form
│   ├── globals.css               ← Tailwind theme + markdown styles
│   ├── qa/                       ← QA Interview module (chat + topics)
│   ├── resume/                   ← Resume & Jobs module (upload, matches, email, companies)
│   ├── documents/                ← Document RAG module (list + per-doc chat)
│   ├── test-architect/           ← Test Architect module (analysis + projects)
│   ├── learn/page.tsx            ← AI Learning Tutor
│   ├── settings/page.tsx         ← Settings page
│   └── api/                      ← API routes
│       ├── auth/                 ← login, logout, me, seed
│       ├── chat/                 ← Streaming RAG (NDJSON)
│       ├── resume/               ← Resume upload
│       ├── jobs/                 ← Job CRUD, scoring, email
│       ├── documents/            ← Document CRUD
│       ├── test-cases/generate/  ← Test case generation
│       ├── projects/             ← Project CRUD
│       ├── topics/               ← Q&A topic browsing
│       ├── settings/             ← User settings
│       └── stats/                ← Dashboard stats
├── components/
│   └── ui/
│       ├── Sidebar.tsx           ← Collapsible nav with user area + logout
│       ├── ChatArea.tsx          ← Reusable streaming chat (used by /qa, /learn, /documents/[id])
│       └── ProtectedLayout.tsx   ← Route guard (redirects unauthenticated to /login)
├── lib/
│   ├── auth.ts                   ← Password hashing (Node crypto), token management, user store
│   ├── auth-context.tsx          ← React context for auth state (useAuth hook)
│   ├── sidebar-context.tsx       ← Sidebar collapse state
│   ├── config.ts                 ← Env config reader
│   ├── openrouter.ts             ← LLM client (sync + streaming via NDJSON)
│   ├── embeddings.ts             ← Embedding via OpenRouter API
│   ├── utils.ts                  ← cn() utility, file extraction helpers
│   └── rag/
│       ├── vector-store.ts       ← VectorStore interface
│       ├── pinecone-store.ts     ← Pinecone v8 implementation (records API)
│       ├── rag-chain.ts          ← RAG pipeline (embed → query → context → LLM)
│       └── qa-extractor.ts       ← LLM-based Q&A pair extraction from docs
├── prisma/
│   └── schema.prisma             ← 9 tables (User, UserSettings, Resume, Job, Document, Project, TestCase, Conversation, Message)
├── data/                         ← Interview documents, AI topic cache
├── scripts/                      ← Seed scripts for Pinecone
└── .env.example
```

### Auth System
- **Password**: Node `crypto.createHash("sha256")` with salt (`randomBytes(16)`). Format: `salt:hash`
- **Tokens**: random UUID stored in-memory Map, 7-day expiry
- **Store**: In-memory `globalThis.__users` Map. Falls back to Prisma/Neon when DB is connected
- **Default user**: `TarunBabbar` / `TarunBabbar` — lazy-created on first `authenticateUser()` call
- **Flow**: Login → server validates → returns `{ user, token }` → client stores in `localStorage` → every request sends `Authorization: Bearer <token>`

### RAG Pipeline
```
User Question → getEmbedding() → 1536-dim vector
  → Pinecone.query(vector, topK=5) → 5 most relevant chunks
  → Build context with [Source: filename] markers
  → Call OpenRouter LLM with system prompt "Answer ONLY from context"
  → Stream response as NDJSON: {type:"sources"} → {type:"chunk"}* → {type:"done"}
```

Three Pinecone namespaces: `qa-interview` (Q&A pairs), `documents` (uploaded docs), `learning` (curriculum).

### Streaming Chat (ChatArea component)
Reused by `/qa`, `/learn`, `/documents/[id]`. Uses `fetch` → `ReadableStream` → `getReader()` for NDJSON parsing. Shows source citations with relevance scores.

### Theme
Claude.ai warm cream palette:
- Page bg: `#faf8f5` (--color-bg-page)
- Sidebar: `#f0ece3` (--color-bg-sidebar)
- Surface: `#f5f2eb` (--color-bg-surface)
- Accent: `#d97706` (--color-amber-500)
- Text primary: `#1a1410`
- Text muted: `#978f85`

---

## Database Schema (Prisma)

9 tables. Key relationships:
- `User` 1→N `Resume`, `Job`, `Project`, `Conversation`, `UserSettings`
- `Project` 1→N `TestCase`
- `Conversation` 1→N `Message`

When DB is disconnected, all data stores in-memory via `globalThis` Maps.

---

## AI Models (OpenRouter Free Tier)

| Model | Use Case |
|-------|----------|
| `google/gemma-4-26b-a4b-it:free` | Default chat + RAG |
| `nvidia/nemotron-3-super-120b-a12b:free` | Heavy reasoning |
| `meta-llama/llama-3.3-70b-instruct:free` | Alternative |
| `qwen/qwen3-next-80b-a3b-instruct:free` | Alternative |
| `google/gemini-2.5-flash-lite` | Fast, cheaper |
| `text-embedding-3-small` | Embeddings (1536 dim) |

---

## Monorepo Integration (Other Projects in AILearning/)

This dashboard is designed to **replace** (not duplicate) the 6 existing projects:

| Old Project | Status | What It Contributed |
|-------------|--------|-------------------|
| `resume-parser/` | ✅ Merged | Resume upload, job extraction, LLM scoring, email agent |
| `qa-interview-preparation-kit/` | ✅ Merged | RAG pipeline, 400+ Q&A, Pinecone, streaming chat, topic browser |
| `qaragplatform/` | ✅ Merged | Document upload/management, file parsing (DOCX/XLSX), in-memory fallback |
| `ai-testarchitect/` | ✅ Merged | Test case generation from PRD, project CRUD, Claude theme |
| `interview-preparation/` | ⏸️ Reference | Curriculum content for learning tutor |
| `learning-playwright-typescript-framework/` | ⏸️ Reference | Playwright learning content |

---

## Deployment Notes

- **Vercel free tier**: 100GB bandwidth, 6000 build minutes/month — sufficient
- **Neon free tier**: 500MB storage, 256MB RAM, auto-sleep after 5min idle
- **Pinecone free tier**: 1 pod index (starts after 5min idle), up to 100K vectors
- **Important**: Pin `@pinecone-database/pinecone` to v8 (latest). v7 uses `vectors` key, v8 uses `records` key in upsert
- `.env` must have at minimum `OPENROUTER_API_KEY` for AI features
- Auth works entirely in-memory — no DB required to login
