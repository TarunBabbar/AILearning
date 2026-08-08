# AILearning — AI & QA Engineering Projects

A multi-project monorepo of **AI-powered QA engineering tools** built by Tarun Kumar Babbar — resume/job matchers, RAG platforms, agentic QA pipelines, interview prep kits, and learning frameworks. Every project is documented in its own README and designed to run standalone.

---

## 📂 Projects at a Glance

| # | Project | What it does | Stack |
|---|---------|--------------|-------|
| 1 | **`resume-parser/`** | Upload resume + job PDFs → LLM extracts jobs, scores matches, tracks hiring pipeline, sends emails | React 19 + Vite, Express, OpenRouter, Gmail SMTP |
| 2 | **`job-details/`** | Job PDF extractor: browser-side text extraction → LLM parsing into structured jobs → PostgreSQL dashboard with auto-resolved company info | Next.js 16, Prisma 7, PostgreSQL, OpenRouter free models |
| 3 | **`qadashboard/`** | Unified QA platform: resume matching, AI interview prep (510+ Q&A), document RAG, test case generation, AI tutor — one Claude-style UI | Next.js 15, Pinecone, Neon Postgres, OpenRouter |
| 4 | **`qae2e/`** | **Agentic QA platform**: 6 specialist AI agents turn a PRD into test coverage → Playwright scripts → real Docker runs → release confidence. Ships a real MCP server (27 tools) | Next.js, 6-agent LLM orchestration, Docker, Vercel Postgres |
| 5 | **`qa-interview-preparation-kit/`** | RAG app for QA interview prep: index PDF/DOCX into Pinecone, ask questions, get grounded answers with citations | Next.js 14, Pinecone, OpenRouter |
| 6 | **`qaragplatform/`** | Document RAG: upload docs, ask questions with citations, plus Migration Studio (import 20+ sources) and Project Scanner | Next.js 14, Pinecone / in-memory, OpenRouter |
| 7 | **`ai-testarchitect/`** | **QA Copilot**: multi-agent test-case generator from PRDs, regression selection, JIRA/Zephyr/TestRail/GitHub MCP integration, framework migration | Next.js 16 + FastAPI, LangGraph, ChromaDB |
| 8 | **`ai-video-generation/`** | Mom & Son cartoon video generator: topic → script → 3D-style animated scenes → Edge-TTS voice-over → ffmpeg vertical video | Python, OpenRouter (image/video), Edge-TTS, ffmpeg |
| 9 | **`my-profile/`** | Claude-themed portfolio website with a floating "Tarun Bot" AI chatbot (OpenRouter free-model fallback chain, WhatsApp escalation) | Next.js 16, Framer Motion, OpenRouter |
| 10 | **`learning-playwright-typescript-framework/`** | Step-by-step learning journey: builds a production Playwright + TypeScript framework from zero (POM, fixtures, BDD, MCP, CI/CD phases) | TypeScript, Playwright, Cucumber (planned) |
| 11 | **`interview-preparation/`** | Senior AI QA Engineer interview prep: prioritized study plan (Python/Pytest, SQL & NL2SQL validation, LLM evals) + hands-on pytest exercise suites | Python, Pytest |

---

## 🧭 Project Details

### 1. Resume–Job Matcher — `resume-parser/`
AI-powered resume and job matching. Upload resume + job listing files, LLM extracts job details, scores matches, and ranks opportunities.

- AI job extraction from PDF/DOCX (OpenRouter + Gemini Flash 2.5 Lite)
- Auto-scoring + selective re-scoring (New / Ignored / All)
- Status workflow: New → Emailed → Waiting → Interviewing → Offered → Ignored
- Email Agent (high scores), Low-Score Agent, and Ignored Agent — bulk Gmail SMTP with `{{company}} {{title}}` placeholders
- Company info enrichment, duplicate detection, stable job IDs, timestamps
- **Stack:** React 19 + Vite 8 + Tailwind 4 · Node/Express · JSON storage · port 5001

### 2. Job Details — AI Job PDF Extractor — `job-details/`
Drop in job-listing PDFs/DOCX/TXT; text is extracted **in the browser** (no binary uploads), parsed by free OpenRouter models into structured jobs, and stored in PostgreSQL.

- Multi-file drag & drop with per-file progress
- Live list of free OpenRouter models — pick any, or type a custom id
- Dashboard: stat cards, search, status filter, sort, expandable job cards
- Auto company resolution from email domains (generic domains like gmail.com never shown)
- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 · PostgreSQL · pdfjs-dist/mammoth · Vercel-ready

### 3. QA AI Dashboard — `qadashboard/`
Six QA tools in one Claude-inspired UI: QA Interview Prep (grounded in 510+ Q&A pairs), Resume & Job Matcher, Document RAG, Test Architect, AI Learning Tutor, and Settings.

- Multi-user auth (scrypt-hashed passwords, JWT httpOnly sessions)
- Free-models-only guard — refuses any non-`:free` model id
- Model picker with 8+ free models, streaming answers with citations
- **Stack:** Next.js 15 · Tailwind CSS 4 · OpenRouter · Pinecone · Neon PostgreSQL + Prisma

### 4. QAE2E — Agentic Quality Engineering — `qae2e/`
From a product requirement to running generated tests in real DevOps — six specialist AI agents orchestrate the whole pipeline.

- **RI** (Requirement Intelligence) → **MT** (Manual Test Cases) → **AS** (Automation Scripts) → **EX** (Execution & Defects) → **DO** (DevOps Evidence) → **IQ** (Release Confidence)
- Real OpenRouter tool-calling agent loop (`:free` models only)
- Real MCP server over Streamable HTTP exposing **27 QA tools** (`/api/mcp/sse`)
- Source connectors: Jira, Confluence, Figma, GitHub, Zephyr, TestRail + connector wizard UI
- RAG-grounded generation (Pinecone), CSV/XLSX export, publish to Zephyr/TestRail
- Local Docker test runner with Playwright JSON results; GitHub check-in flow (branch → commit → dispatch CI)
- User accounts, workspaces, run history; Vercel Postgres with local JSON fallback
- **Stack:** Next.js · @modelcontextprotocol/sdk · Docker · Vercel Postgres · Playwright

### 5. QA Interview Preparation Kit — `qa-interview-preparation-kit/`
RAG application for QA interview prep. PDF/DOCX docs are indexed into a vector database; answers are grounded in your knowledge base with source citations.

- `npm run seed` → extract Q&A pairs via LLM (retries + JSON repair) → embed → Pinecone upsert
- Streaming QA chat with top-5 chunk retrieval; By File / Refined topic views
- Vector store abstraction: Pinecone (production) / ChromaDB / local NDJSON fallback
- **Stack:** Next.js 14 · Pinecone · OpenRouter (DeepSeek V4 Flash) · text-embedding-3-small

### 6. QA RAG Platform — `qaragplatform/`
Upload documents and ask AI-powered questions about them, with citations.

- Smart chunking with overlap; model picker (7+ free models); configurable embeddings
- In-memory cosine similarity (free) or Pinecone (persistent)
- **Migration Studio** — import test suites from 20+ enterprise sources (Git, CI/CD, cloud)
- **Project Scanner** — analyze framework, locator quality, and migration readiness
- **Stack:** Next.js 14 · OpenRouter · Pinecone / in-memory · Mammoth

### 7. QA Copilot — AI Test Architect — `ai-testarchitect/`
Multi-agent QA copilot: test-case generation from PRDs, automated execution, regression selection, and framework migration.

- Next.js 16 chat frontend (Claude amber theme) + FastAPI backend with SSE streaming
- LangGraph multi-agent system: JIRA agent, PRD analyzer, test generator, regression selector
- Multi-provider LLM client (OpenRouter primary, Anthropic/OpenAI fallback)
- **Phase 1–2 built:** chat UI, project CRUD, SSE streaming with real agent pipeline
- **Roadmap:** ChromaDB RAG, Zephyr/TestRail MCP, Docker-sandboxed Playwright execution, tree-sitter migration engine
- **Stack:** Next.js 16 · FastAPI (Python 3.12) · LangGraph · ChromaDB · Docker Compose

### 8. Mom & Son Cartoon Video Generator — `ai-video-generation/`
Turns any topic into a vertical 9:16 animated cartoon video where Mom teaches Son about healthy foods — 3D Pixar-style characters.

- Topic → LLM script → character images (cached) → per-scene video → Edge-TTS voice-over → ffmpeg assembly
- Hindi + English voices, subtitles, configurable duration; all settings in `config.json` (no hardcoded values)
- `--dry-run` and `python -m cartoon_gen.fake_client` for free offline testing
- **Stack:** Python 3.10+ · OpenRouter (script/image/video models) · Edge-TTS (free) · ffmpeg

### 9. Tarun Kumar Babbar — Personal Profile — `my-profile/`
Claude-themed portfolio site showcasing 18+ years of QA engineering experience.

- Sections: Hero, About, 10 Projects, Skills, Career timeline, Education, Contact
- **Tarun Bot** — floating AI chat widget answering from profile facts using an OpenRouter **free-model fallback chain**; unresolved questions offer a WhatsApp escalation button
- **Stack:** Next.js 16 · Tailwind CSS 4 · Framer Motion 12 · deployed on Vercel

### 10. Learning: Playwright + TypeScript Framework — `learning-playwright-typescript-framework/`
A from-zero learning journey that builds a production-grade test automation framework step by step.

- **Phase 0–1 done:** JS/Node/npm foundations, project scaffold, config files
- **In progress:** Page Object Model + fixtures + test data (SauceDemo)
- **Planned:** API automation, hybrid E2E flows, BDD with Cucumber, MCP-driven execution, CI/CD + Docker
- Principles: SOLID, DRY, AAA, resilient locators, no hardcoded values, isolated tests

### 11. Interview Preparation — `interview-preparation/`
Senior AI QA Engineer interview prep — a prioritized study plan plus hands-on exercises.

- **Plan:** Priority-0 foundations (Python/Pytest, SQL & NL2SQL validation logic, REST API testing) → Priority-1 AI QA concepts (LLM evals, EM/MRR/F1 metrics, golden datasets, prompt regression) → interview-ready practice
- **Exercises:** runnable pytest suites (`exercises/`) covering fixtures, parametrize, markers, conftest, and test scopes
- **Stack:** Python · Pytest (+ xdist, html plugins)

---

## 🚀 Monorepo Conventions

- Each project is **fully standalone** — its own README, package.json/requirements, and env setup.
- Most AI apps use **OpenRouter free models only** (`:free` guard where hardcoded) — no paid spend by default.
- Claude-inspired warm-cream/beige or amber UI theme is a consistent design signature.
- Vercel deployments set the subfolder as **Root Directory** (e.g. `job-details`, `qadashboard`, `qae2e`, `my-profile`).

## 📄 License

MIT
