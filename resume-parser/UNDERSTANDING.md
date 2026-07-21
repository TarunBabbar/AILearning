# Resume Parser — Project Understanding

## Overview
Full-stack Node.js/Express app that uploads a resume (PDF/DOCX) and job listing files (PDF/DOCX), uses LLM via OpenRouter API to extract structured job data from listings and score each job against the resume, then displays ranked match results with strengths/gaps.

**Backend:** Express, Multer, pdf-parse, mammoth, nodemailer, OpenRouter API
**Frontend:** React + Vite + Tailwind CSS 4 + Lucide icons
**Storage:** `data.json` (persistent: resume text + jobs array + scores + timestamps)

## Architecture
```
resume-parser/
├── server.js          — Express server, API routes, scoring orchestrator
├── openrouter.js      — LLM API client (OpenRouter)
├── parser.js          — Text extraction (pdf-parse/mammoth) + LLM job parsing
├── templates/         — Legacy HTML (kept as backup)
├── client/            — React + Vite + Tailwind SPA
│   ├── src/
│   │   ├── App.tsx                 — Router + Layout
│   │   ├── components/
│   │   │   ├── Layout.tsx          — Sidebar nav + content area
│   │   │   ├── Dashboard.tsx       — Upload, match, results, detail panel
│   │   │   └── EmailAgent.tsx      — Gmail auth, template, send queue
│   │   └── lib/
│   │       ├── api.ts              — All fetch() calls to Express
│   │       ├── types.ts            — TypeScript interfaces (Job, Status)
│   │       └── utils.ts            — cn(), formatDate(), isCompanyEmail(), colors
│   ├── dist/                       — Built output (served by Express)
│   └── package.json
├── .env              — All configuration
├── data.json         — Persistent store
└── uploads/          — Uploaded files
```

## Key Flows
1. **Resume Upload** → PDF/DOCX → extractText() → stored in memory + data.json
2. **Job Upload** → PDF/DOCX → extractText() → extractJobsViaLLM() (chunked, 12000 chars) → deduplicate → store
3. **Match** → computeScores() batches jobs (4 per LLM call) → idx 0/1 both handled → strengths/gaps/score → sort by score
4. **Email Agent** → Show only company-matched emails (filters @gmail etc + domain!=company) → Gmail SMTP → bulk send

## LLM Integration
- Provider: OpenRouter
- Model: `google/gemini-2.5-flash-lite` (fast & cheap)
- Parse: chunked (12000 chars), max 16384 output tokens
- Scoring: 4 jobs per batch, 8192 max tokens
- dotenv: `config({ override: true })` everywhere (Windows env override)

## Issues & Fixes Log

### 2025-07-20: Scoring returned 0% for all jobs
**Root cause:** `computeScores()` didn't pass `maxTokens`, defaulted to 4096. Gemini Flash returns 0-based `idx` but code did `(e.idx || 0) - 1` — idx=0 became -1, scores skipped.
**Fix:** Added `SCORE_MAX_TOKENS=8192` + `override: true` in dotenv + handle both 0/1-based idx

### 2025-07-20: System env overriding .env
**Fix:** `config({ override: true })` in server.js, openrouter.js, parser.js

### 2025-07-20: Parsing performance
**Fix:** Model → `google/gemini-2.5-flash-lite`, chunk size → 12000, parse tokens → 16384

### 2025-07-20: Non-matching emails showing in UI
**Fix:** Added `isCompanyEmail()` filter (rejects generic domains + validates domain matches company name) on both Dashboard and Email Agent

### 2025-07-20: Timestamps
**Added:** `created_at`, `email_sent_at`, `status_updated_at` on every job. Shown in detail panel.

### 2025-07-20: Modern UI migration
**Done:** Replaced plain HTML templates with React + Vite + Tailwind CSS 4 SPA. Express serves `client/dist/`. Left sidebar nav (Dashboard + Email Agent). Detail slide-over panel. All existing data preserved.
