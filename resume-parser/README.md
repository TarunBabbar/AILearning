# Resume–Job Matcher

AI-powered resume and job matching application. Upload your resume (PDF/DOCX) and job listing files, then let the LLM extract job details, score matches, and rank opportunities — all from a beautiful Claude-inspired UI.

![Dashboard Screenshot](screenshots/dashboard.png)

## Features

- **AI Job Extraction** — Parse job listings from PDF/DOCX using OpenRouter + Gemini Flash
- **Intelligent Matching** — LLM scores each job against your resume with strengths/gaps analysis
- **Status Workflow** — Track jobs through stages: New → Emailed → Waiting → Interviewing → Offered → Ignored
- **Email Agent** — Bulk-send personalized emails via Gmail SMTP with template support
- **Smart Filtering** — Auto-hides non-company emails (gmail, yahoo), invalid titles ("Unknown Position"), and email-company mismatches
- **Duplicate Detection** — Skips already-parsed jobs on re-upload
- **Incremental Scoring** — Only scores new jobs, preserving existing scores
- **Timestamps** — Tracks when jobs were added, emailed, and status changed

## Screenshots

_Coming soon_

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS 4 |
| Backend | Node.js + Express |
| LLM | OpenRouter API (`google/gemini-2.5-flash-lite`) |
| PDF Parsing | pdf-parse + mammoth (DOCX) |
| Email | Nodemailer + Gmail SMTP |
| Storage | JSON file (`data.json`) |

## Quick Start

```bash
# 1. Install
npm install
cd client && npm install && cd ..

# 2. Configure — create .env with your OpenRouter key
echo OPENROUTER_API_KEY=sk-or-v1-xxx > .env
echo OPENROUTER_MODEL=google/gemini-2.5-flash-lite >> .env
echo OPENROUTER_MAX_TOKENS=8192 >> .env

# 3. Build frontend
npm run build

# 4. Start
npm start
```

Open `http://localhost:5000`

## Architecture

```
resume-parser/
├── server.js              # Express server, API routes, scoring
├── openrouter.js          # LLM client (OpenRouter API)
├── parser.js              # Text extraction + LLM job parsing
├── client/                # React SPA
│   └── src/components/
│       ├── Layout.tsx     # Sidebar navigation
│       ├── Dashboard.tsx  # Upload, match, results
│       └── EmailAgent.tsx # Gmail bulk email
├── data.json              # Persistent store (jobs + scores)
└── .env                   # Configuration
```

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/upload-resume` | Upload and parse resume file |
| `POST` | `/api/upload-jobs` | Upload and extract jobs from files |
| `POST` | `/api/match` | Score all unscored jobs against resume |
| `GET` | `/api/jobs?status=X` | List jobs with optional status filter |
| `PATCH` | `/api/jobs/:idx/status` | Update job status |
| `DELETE` | `/api/jobs/:idx` | Delete a job |
| `POST` | `/api/send-email` | Send email to a job's contact |
| `POST` | `/api/verify-gmail` | Verify Gmail credentials |
| `POST` | `/api/clear` | Clear all data |
| `GET` | `/api/status` | Get system status |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash-lite` | LLM model |
| `OPENROUTER_MAX_TOKENS` | `8192` | Max output tokens |
| `PARSE_CHUNK_CHARS` | `12000` | Chars per LLM chunk |
| `PARSE_MAX_TOKENS` | `16384` | Max tokens for job extraction |
| `SCORE_BATCH_SIZE` | `4` | Jobs per scoring batch |
| `SCORE_MAX_TOKENS` | `8192` | Max tokens for scoring |
| `PORT` | `5000` | Server port |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `465` | SMTP port |

## License

MIT
