# AILearning — AI & QA Engineering Projects

A multi-project monorepo of **AI-powered QA engineering tools** built by Tarun Kumar Babbar — resume/job matchers, RAG platforms, agentic QA pipelines, interview prep kits, and learning frameworks. Every project is documented in its own README and designed to run standalone.

---

## 📂 Projects at a Glance

| # | Project | What it does | Stack | Live |
|---|---------|--------------|-------|------|
| 1 | **[`resume-parser/`](https://github.com/TarunBabbar/AILearning/tree/main/resume-parser)** | Upload resume + job PDFs → LLM extracts jobs, scores matches, tracks hiring pipeline, sends emails | React 19 + Vite, Express, OpenRouter, Gmail SMTP | — |
| 2 | **[`job-details/`](https://github.com/TarunBabbar/AILearning/tree/main/job-details)** | Job PDF extractor: browser-side text extraction → LLM parsing into structured jobs → PostgreSQL dashboard with auto-resolved company info | Next.js 16, Prisma 7, PostgreSQL, OpenRouter free models | [🌐 Live](https://qajobs.vercel.app) |
| 3 | **[`qadashboard/`](https://github.com/TarunBabbar/AILearning/tree/main/qadashboard)** | Unified QA platform: resume matching, AI interview prep (510+ Q&A), document RAG, test case generation, AI tutor — one Claude-style UI | Next.js 15, Pinecone, Neon Postgres, OpenRouter | [🌐 Live](https://qadashboard-lime.vercel.app) |
| 4 | **[`qae2e/`](https://github.com/TarunBabbar/AILearning/tree/main/qae2e)** | **Agentic QA platform**: 6 specialist AI agents turn a PRD into test coverage → Playwright scripts → real Docker runs → release confidence. Ships a real MCP server (27 tools) | Next.js, 6-agent LLM orchestration, Docker, Vercel Postgres | [🌐 Live](https://qae2e.vercel.app) |
| 5 | **[`qa-interview-preparation-kit/`](https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit)** | RAG app for QA interview prep: index PDF/DOCX into Pinecone, ask questions, get grounded answers with citations | Next.js 14, Pinecone, OpenRouter | [🌐 Live](https://qa-interview-preparation.vercel.app) |
| 6 | **[`qaragplatform/`](https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform)** | Document RAG: upload docs, ask questions with citations, plus Migration Studio (import 20+ sources) and Project Scanner | Next.js 14, Pinecone / in-memory, OpenRouter | [🌐 Live](https://qaragplatform.vercel.app) |
| 7 | **[`ai-testarchitect/`](https://github.com/TarunBabbar/AILearning/tree/main/ai-testarchitect)** | **QA Copilot**: multi-agent test-case generator from PRDs, regression selection, JIRA/Zephyr/TestRail/GitHub MCP integration, framework migration | Next.js 16 + FastAPI, LangGraph, ChromaDB | — |
| 8 | **[`ai-video-generation/`](https://github.com/TarunBabbar/AILearning/tree/main/ai-video-generation)** | Mom & Son cartoon video generator: topic → script → 3D-style animated scenes → Edge-TTS voice-over → ffmpeg vertical video | Python, OpenRouter (image/video), Edge-TTS, ffmpeg | — |
| 9 | **[`my-profile/`](https://github.com/TarunBabbar/AILearning/tree/main/my-profile)** | Claude-themed portfolio website with a floating "Tarun Bot" AI chatbot (OpenRouter free-model fallback chain, WhatsApp escalation) | Next.js 16, Framer Motion, OpenRouter | [🌐 Live](https://www.tarunkumarbabbar.com) |
| 10 | **[`learning-playwright-typescript-framework/`](https://github.com/TarunBabbar/AILearning/tree/main/learning-playwright-typescript-framework)** | Step-by-step learning journey: builds a production Playwright + TypeScript framework from zero (POM, fixtures, BDD, MCP, CI/CD phases) | TypeScript, Playwright, Cucumber (planned) | — |
| 11 | **[`interview-preparation/`](https://github.com/TarunBabbar/AILearning/tree/main/interview-preparation)** | Senior AI QA Engineer interview prep: prioritized study plan (Python/Pytest, SQL & NL2SQL validation, LLM evals) + hands-on pytest exercise suites | Python, Pytest | — |
| 12 | **[`ai-qa-automation-platform/`](https://github.com/TarunBabbar/AILearning/tree/main/ai-qa-automation-platform)** | Multi-tenant SaaS that runs the full STLC autonomously: connect GitHub + Jira + DB, a supervisor + 7 phase agents generate → execute → evaluate tests and gate releases, with a CI webhook that blocks | Next.js 16, NextAuth, Prisma + Neon Postgres, OpenRouter, Octokit, Vercel cron | — |
| 13 | **[`figma-ui-automation/`](https://github.com/TarunBabbar/AILearning/tree/main/figma-ui-automation)** | Figma → Playwright multi-agent system: Pipeline A validates built screens against the Figma design (pixel + structural drift reports); Pipeline B shift-left generates test cases + automation before dev ships. Optional Next.js dashboard | Node 20+, TypeScript, Playwright, OpenRouter, Figma REST, SQLite, DeepEval | — |
| 14 | **[`mcp-connections/`](https://github.com/TarunBabbar/AILearning/tree/main/mcp-connections)** | Figma → Playwright agent pipeline: 3 agents over the official Figma MCP server + OpenRouter turn a design into a runnable Playwright + TypeScript suite | TypeScript, Figma MCP, OpenRouter | — |
| 15 | **[`glassdoor-company-details/`](https://github.com/TarunBabbar/AILearning/tree/main/glassdoor-company-details)** | Job-seeker portal: companies by type with Glassdoor ratings, pros/cons from real reviews, consolidated salaries (₹ LPA) — Glassdoor → JSON → OpenRouter → enriched JSON → UI | Next.js · React 19 · Tailwind 4, Playwright scraper, OpenRouter, Zod | — |

---

## 🌐 Live Apps

Every deployed app is hosted on Vercel (the portfolio runs on its own domain) — click through and try them:

| App | Live | Source |
|-----|------|--------|
| **QAE2E — Agentic Quality Engineering** (🏆 1st Place, AI Tester Blueprint 3x) | **[qae2e.vercel.app](https://qae2e.vercel.app)** | [`qae2e/`](https://github.com/TarunBabbar/AILearning/tree/main/qae2e) |
| **QA Jobs Portal** (Job Details — AI job extractor) | **[qajobs.vercel.app](https://qajobs.vercel.app)** | [`job-details/`](https://github.com/TarunBabbar/AILearning/tree/main/job-details) |
| **QA AI Dashboard** | **[qadashboard-lime.vercel.app](https://qadashboard-lime.vercel.app)** | [`qadashboard/`](https://github.com/TarunBabbar/AILearning/tree/main/qadashboard) |
| **QA RAG Platform** | **[qaragplatform.vercel.app](https://qaragplatform.vercel.app)** | [`qaragplatform/`](https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform) |
| **QA Interview Preparation Kit** | **[qa-interview-preparation.vercel.app](https://qa-interview-preparation.vercel.app)** | [`qa-interview-preparation-kit/`](https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit) |
| **Tarun Kumar Babbar — Portfolio** | **[tarunkumarbabbar.com](https://www.tarunkumarbabbar.com)** | [`my-profile/`](https://github.com/TarunBabbar/AILearning/tree/main/my-profile) |

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

### 12. AI QA Automation Platform — `ai-qa-automation-platform/`
Multi-tenant SaaS platform that runs the **full Software Testing Life Cycle autonomously** — from requirement to release decision, with human review checkpoints.

- Connect **GitHub (Octokit)**, **Jira (REST)**, and a **database**; per-workspace secrets are **AES-256-GCM** encrypted
- **Supervisor + 7 STLC phase agents:** RequirementsAnalyst → TestPlanner → TestDesigner → AutomationBuilder → Executor → DefectReporter → ReleaseGater
- Test cases derived from real requirements/code with traceability; failures feed a closed-loop review queue
- Five **LLM-judge eval metrics** with a **hard/soft release gate** and a CI webhook that blocks a release on hard-gate failure
- Vercel-native (Next.js Route Handlers), nightly regression via **Vercel cron**; swappable LLM provider (OpenRouter or Command Code)
- **Stack:** Next.js 16 · NextAuth · Prisma + Neon Postgres · OpenRouter · Octokit · Jira REST · Vercel cron

### 13. Figma → Playwright Multi-Agent System — `figma-ui-automation/`
Six LLM/rule-based agents + one deterministic orchestrator over a shared **Playwright + TypeScript** framework, covering two pipelines.

- **Pipeline A (regression validation):** diff the live/staging UI against the Figma design (pixel diff + structural token diff, LLM vision only on flagged deltas) → HTML drift report
- **Pipeline B (shift-left):** generate Gherkin/YAML test cases from the design spec → human approval gate → compile-gated `.spec.ts` codegen before the screen ships
- Quality gates: **schema**, **eval** (DeepEval sidecar or deterministic mock judge), **human approval**, and **`tsc` compile**
- **Sample mode** runs every agent on bundled data — no keys needed
- Optional **Next.js 16 web dashboard** (`webapp/`) wrapping the CLI with live SSE progress, drift-report viewer, and test-case approval
- **Stack:** Node 20+ · TypeScript · Playwright · OpenRouter · Figma REST · SQLite · DeepEval · Next.js 16

### 14. Figma → Playwright Agent Pipeline — `mcp-connections/`
Turns a Figma UI design into a runnable **Playwright + TypeScript** test suite, driven end-to-end by AI agents over the official **Figma MCP server**.

- Three agents: Design Analysis → Test Cases → Automation (emits `.spec.ts` + page objects, scaffolded into a project that runs with `npm test`)
- Orchestrator spawns the Framelink `figma-developer-mcp` server over stdio and calls `get_figma_data` — auth stays inside the MCP server
- **Stack:** TypeScript · @modelcontextprotocol/sdk · OpenRouter · Figma MCP

### 15. Glassdoor Company Details Portal — `glassdoor-company-details/`
Job-seeker-facing portal (beige theme) showing companies by type with their Glassdoor star ratings, pros vs cons from real employee reviews, and consolidated salaries per designation (₹ LPA).

- Data flow: **Glassdoor → JSON dump → OpenRouter LLM → enriched JSON → UI**; the JSON dump is the source of truth
- `npm run scrape` (Playwright login) → raw JSON; `npm run analyze` classifies type/industry, summarizes good vs bad bullets, and consolidates salaries
- Works without scraping — edit `data/companies.raw.json` by hand, or use on-demand "Re-analyze with LLM" per company
- **Stack:** Next.js · React 19 · Tailwind CSS 4 · Playwright · OpenRouter · Zod

---

## 🚀 Monorepo Conventions

- Each project is **fully standalone** — its own README, package.json/requirements, and env setup.
- **`save-tokens/`** is a shared **token-frugal prompting ruleset** (`.cursorrules`) for UI-test automation/fix requests — typed `[AUTO]`/`[FIX]`/`[FIX-ASSERT]`/`[DEBUG]` prompts with a minimal-context contract and capped output.
- Most AI apps use **OpenRouter free models only** (`:free` guard where hardcoded) — no paid spend by default.
- Claude-inspired warm-cream/beige or amber UI theme is a consistent design signature.
- Vercel deployments set the subfolder as **Root Directory**. Live apps: [qae2e](https://qae2e.vercel.app), [qajobs (job-details)](https://qajobs.vercel.app), [qadashboard](https://qadashboard-lime.vercel.app), [qaragplatform](https://qaragplatform.vercel.app), [qa-interview-preparation](https://qa-interview-preparation.vercel.app), and [my-profile](https://www.tarunkumarbabbar.com).

## 📄 License

MIT
