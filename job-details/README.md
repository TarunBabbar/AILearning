# Job Details — AI Job PDF Extractor

A **Next.js 16 + Prisma + PostgreSQL** app that extracts job details from uploaded PDFs (and DOCX/TXT) using **free OpenRouter models**, stores them in a database, and presents them in a Claude-style **beige** UI with company details resolved from email domains.

## Features

- **Multi-file upload** — drag & drop PDF/DOCX/TXT/MD files. Text is extracted **in the browser** (pdfjs-dist), so no binary uploads and no Vercel 4.5MB request limit issues.
- **LLM extraction** — job title, company, email, location, experience, description extracted via OpenRouter (chunked, deduped). Defaults to a free model.
- **Job Dashboard (default page)** — search, filter by status, sort, expandable job cards with full description.
- **Company details inline** — email domains are resolved to company names via the LLM. Generic/personal domains (gmail.com, yahoo.com, live.com, outlook.com, google.com, etc.) are **never** treated as companies.
- **Env-only API key** — the OpenRouter key is read from `OPENROUTER_API_KEY` in the environment (`.env` locally, Vercel env vars in production). No UI/key entry.
- **Vercel-ready** — stateless API routes + Postgres (Vercel Postgres/Neon) + Prisma.

## Tech stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19                  |
| Database   | PostgreSQL via Prisma 7                             |
| PDF text   | pdfjs-dist 6 (browser-side)                         |
| DOCX text  | mammoth (browser-side)                              |
| Styling    | Tailwind CSS 4 with a Claude beige palette          |
| LLM        | OpenRouter API (free models, e.g. `deepseek/deepseek-v4-flash`) |

## Getting started

```bash
cd job-details
npm install

# 1. Create .env from the template (copy .env.example → .env) and fill in:
#    DATABASE_URL  — your Postgres connection string
#    OPENROUTER_API_KEY — your OpenRouter key (https://openrouter.ai/keys)
cp .env.example .env
npx prisma db push

# 2. Run
npm run dev
# open http://localhost:3000
```

## Vercel deployment

1. Push this folder to a GitHub repo.
2. In Vercel, **Import Project** → pick the repo → framework preset **Next.js**.
3. Create a Postgres database (Vercel Postgres or Neon) and add its connection string as `DATABASE_URL`.
4. Add env vars in **Project Settings → Environment Variables**:
   - `DATABASE_URL` — Vercel Postgres / Neon connection string.
   - `OPENROUTER_API_KEY` — your OpenRouter key (required; read server-side only).
   - `OPENROUTER_MODEL` — default model id (defaults to `deepseek/deepseek-v4-flash`).
5. Add build command `npx prisma generate && next build` (the `postinstall` script already runs `prisma generate`, so a plain `next build` also works). For schema changes use `prisma db push` / `prisma migrate deploy` locally, not in the build.

## How extraction works

1. Browser extracts plain text from each uploaded file (pdfjs / mammoth).
2. `POST /api/upload` sends the text (not the binary) to the server.
3. The server chunks the text (~6k chars, overlapping) and calls the selected OpenRouter model with a strict-JSON prompt.
4. Parsed jobs are deduped against the DB and saved.
5. The Dashboard lists jobs; expanding a card shows the description. Company info is resolved from the job's email domain via `POST /api/companies/resolve` (on the Dashboard) — generic/personal domains are skipped.

## Project structure

```
job-details/
├─ app/
│  ├─ (app)/              # sidebar-wrapped pages
│  │  ├─ page.tsx         # Dashboard (default) — jobs + company info inline
│  │  └─ upload/          # multi-file upload + extraction
│  ├─ api/
│  │  ├─ upload/          # extract + persist jobs
│  │  ├─ jobs/            # list/search/delete jobs
│  │  ├─ companies/       # resolve + list companies
│  │  └─ settings/        # env/key config status
│  ├─ layout.tsx
│  └─ globals.css
├─ components/Sidebar.tsx # left nav
├─ lib/                   # config, openrouter, extract-jobs, company, db
├─ prisma/schema.prisma   # Job + Company models
├─ .env                   # local secrets (gitignored)
└─ .env.example           # checked-in template
```
