# Resume–Job Matcher

AI-powered resume and job matching application. Upload your resume (PDF/DOCX) and job listing files, then let the LLM extract job details, score matches, and rank opportunities — all from a beautiful Claude-inspired UI.

## Features

- **AI Job Extraction** — Parse jobs from PDF/DOCX using OpenRouter + Gemini Flash 2.5 Lite
- **Auto-Scoring** — After upload & parse, jobs are automatically scored against the resume
- **Selective Re-Scoring** — Score Again dropdown lets you re-score by scope: New, Ignored, or All jobs
- **Status Workflow** — Track jobs: New → Emailed → Waiting → Interviewing → Offered → Ignored
- **Email Agent** — Bulk-send personalized emails via Gmail SMTP with template and `{{company}} {{title}}` placeholders
- **Ignored Agent** — Separate page for extraction-failed jobs with fixed generic template
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
| Storage | JSON file (`data.json`) |

## Quick Start

```bash
npm install
cd client && npm install && cd ..
# Create .env with OPENROUTER_API_KEY
npm run build
npm start
```

Open `http://localhost:5000`

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash-lite` | LLM model |
| `OPENROUTER_MAX_TOKENS` | `8192` | Max output tokens |
| `PARSE_CHUNK_CHARS` | `12000` | Chars per LLM chunk |
| `SCORE_BATCH_SIZE` | `4` | Jobs per scoring batch |
| `SCORE_MAX_TOKENS` | `8192` | Max tokens for scoring |
| `PORT` | `5000` | Server port |

## License

MIT
