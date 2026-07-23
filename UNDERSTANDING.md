# Resume Parser — Project Understanding

## Overview
Full-stack Node.js/Express app that uploads a resume (PDF/DOCX) and job listing files (PDF/DOCX), uses LLM via OpenRouter API to extract structured job data and score each job against the resume.

**Backend:** Express, Multer, pdf-parse, mammoth, nodemailer, OpenRouter API  
**Frontend:** React 19 + Vite 8 + Tailwind CSS 4 + Lucide icons  
**Storage:** `data.json` (persistent JSON store with unique job IDs)

## Architecture
```
resume-parser/
├── server.js          — Express, API routes, scoring, duplicate detection, job IDs
├── openrouter.js      — LLM API client (OpenRouter), dotenv override
├── parser.js          — Text extraction + LLM job parsing (chunked, 12K chars)
├── client/            — React SPA (Vite + Tailwind)
│   ├── src/components/
│   │   ├── Layout.tsx          — Sidebar nav (Dashboard, Email Agent, Ignored Agent)
│   │   ├── Dashboard.tsx       — Upload, auto-score, results grid, Score Again popup
│   │   ├── EmailAgent.tsx      — Gmail send with template placeholders
│   │   └── IgnoredEmailAgent.tsx — Fixed template for bad-data jobs
│   └── src/lib/
│       ├── api.ts              — All fetch() calls (uses job `id`, not array index)
│       ├── types.ts            — Job interface with `id: string`
│       └── utils.ts            — isCompanyEmail, isValidJobTitle, isGenericEmail, cn
├── templates/         — Legacy HTML (backup)
├── data.json          — Persistent store (resume + jobs + scores + timestamps)
└── .env               — Configuration
```

## Key Flows

### 1. Resume Upload → parse → store in data.json
### 2. Job Upload → extract text → chunk (12000 chars) → LLM extraction → deduplicate by title+company → store new + duplicates
### 3. Auto-Scoring → after upload, auto-scores only unscored jobs → Score Again popup for selective re-scoring
### 4. Email Agent → shows only valid jobs (company email + valid title) → send with {{company}} {{title}} placeholders
### 5. Ignored Agent → shows bad-data jobs with email → fixed generic template (no placeholders)

## Job Statuses
- `new` — freshly parsed, not yet emailed
- `email_sent` — email has been sent
- `waiting_reply`, `interviewing`, `offer_received` — workflow stages
- `ignored` — manually ignored or bad data (missing email, unknown company, invalid title)
- `duplicate` — same title+company as existing job, stored with `duplicate_of` reference

## Tab Filtering Logic
- **All/New/Emailed/etc** — hides: duplicates, ignored, bad-email, bad-title jobs
- **Duplicate** — shows only `status: "duplicate"` jobs
- **Ignored** — shows `status: "ignored"` AND bad-data jobs (missing email, unknown company, gmail domains, irrelevant titles)

## LLM Configuration
- Model: `google/gemini-2.5-flash-lite`
- Parse: chunked (12000 chars/16384 tokens)
- Scoring: 4 jobs per batch, 8192 tokens, 0-based + 1-based idx handling
- dotenv: `config({ override: true })` everywhere (Windows env override)

## Issues & Fixes Log

### 2025-07-20: 0% scores
**Root cause:** `computeScores()` didn't pass `maxTokens` + Gemini Flash returns 0-based idx
**Fix:** SCORE_MAX_TOKENS=8192, handle both 0/1-based idx, `override: true` dotenv

### 2025-07-20: System env overriding .env
**Fix:** `config({ override: true })` in all three files

### 2025-07-20: Parsing slow (17 chunks)
**Fix:** Model → gemini-2.5-flash-lite, chunk → 12000, tokens → 16384

### 2025-07-21: Wrong email sent — array index bug
**Symptom:** Clicking "Send" on first job sent to wrong recipient. After scoring, `jobs.sort()` reorders array.
**Fix:** Added unique `id` field to every job. All API calls use `id` instead of array index. IgnoredEmailAgent filters `email_sent: true` out.

### 2025-07-21: Duplicates silently dropped
**Fix:** Store duplicates with `status: "duplicate"`, show in dedicated tab

### 2025-07-21: Ignored jobs not visible
**Fix:** `computeStatusCounts` and `applyFilter` now detect bad data (missing company, email, title) and show in Ignored tab. IgnoredAgent uses same logic.

### 2025-07-21: Claude.ai theme
**Fix:** Complete UI redesign — warm cream/amber/brown palette, `#faf7f5` bg, `#ede3da` borders

### 2025-07-21: Modern UI (React + Vite + Tailwind 4)
**Done:** Replaced plain HTML with React SPA. Left sidebar nav. Score Again dropdown. Two-column Email Agent layout.
