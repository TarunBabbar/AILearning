# Resume–Job Matcher

AI-powered resume and job matching application. Upload your resume (PDF/DOCX) and job listing files, then let the LLM extract job details, score matches, and rank opportunities — all from a beautiful Claude-inspired UI.

## Features

- **AI Job Extraction** — Parse jobs from PDF/DOCX using OpenRouter + Gemini Flash 2.5 Lite
- **Auto-Scoring** — After upload & parse, jobs are automatically scored against the resume
- **Selective Re-Scoring** — Score Again dropdown lets you re-score by scope: New, Ignored, or All jobs
- **Status Workflow** — Track jobs: New → Emailed → Waiting → Interviewing → Offered → Ignored
- **Email Agent** — Bulk-send personalized emails via Gmail SMTP with template and `{{company}} {{title}}` placeholders
- **Ignored Agent** — Separate page for extraction-failed jobs with fixed generic template
- **Low Score Agent** — Separate page for scored jobs below 60%
- **Company Info** — Browse and enrich company domains from job emails with LLM lookups
- **Smart Filtering** — Auto-hides non-company emails, "Unknown Position" titles, and email-company mismatches
- **Duplicate Detection** — Stores duplicates in a separate tab with original reference
- **Unique Job IDs** — Every job has a stable `id` field, immune to array reordering
- **Timestamps** — `created_at`, `email_sent_at`, `status_updated_at` on every job

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS 4 |
| Backend | Node.js + Express |
| LLM | OpenRouter API (`google/gemini-2.5-flash-lite`) |
| PDF Parsing | pdf-parse + mammoth (DOCX) |
| Email | Nodemailer + Gmail SMTP |
| Storage | JSON file (`data.json`) + company-info.json |

## Quick Start

```bash
# 1. Install server dependencies
npm install

# 2. Install client dependencies
cd client && npm install && cd ..

# 3. Create .env with OPENROUTER_API_KEY (copy from .env.example or configure)
#    Minimum required: OPENROUTER_API_KEY, OPENROUTER_MODEL

# 4. Build the React frontend
npm run build   # runs cd client && npm run build internally

# 5. Start the server
npm start
```

Open `http://localhost:5001`

> Note: The server runs on port 5001 by default (configured in `.env`). Change via `PORT` in `.env` if needed.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash-lite` | LLM model |
| `OPENROUTER_MAX_TOKENS` | `16384` | Max output tokens |
| `PARSE_CHUNK_CHARS` | `12000` | Chars per LLM chunk |
| `PARSE_MAX_TOKENS` | `16384` | Max tokens for parsing |
| `SCORE_BATCH_SIZE` | `4` | Jobs per scoring batch |
| `SCORE_MAX_TOKENS` | `8192` | Max tokens for scoring |
| `COMPANY_MODEL` | `perplexity/sonar-pro` | Model for company info enrichment |
| `PORT` | `5001` | Server port |
| `HOST` | `127.0.0.1` | Server host |

## Project Structure

```
resume-parser/
├── server.js              — Express API routes, scoring, company info, email
├── parser.js              — Text extraction + LLM job parsing (chunked)
├── openrouter.js          — LLM API client (OpenRouter/OmniRoute)
├── client/                — React SPA (Vite + Tailwind)
│   └── src/
│       ├── components/
│       │   ├── Dashboard.tsx         — Upload, score, filter jobs
│       │   ├── EmailAgent.tsx        — High-score email sender
│       │   ├── LowScoreAgent.tsx     — Low-score email sender
│       │   ├── IgnoredEmailAgent.tsx — Bad-data email sender
│       │   ├── CompanyInfo.tsx       — Domain enrichment table
│       │   └── Layout.tsx            — Sidebar nav
│       └── lib/
│           ├── api.ts                — All fetch() calls
│           ├── types.ts              — TypeScript interfaces
│           └── utils.ts              — Helpers (filter, validate, format)
├── .env                  — Configuration
├── data.json             — Persistent job store
└── company-info.json     — Company domain cache
```

## License

MIT
