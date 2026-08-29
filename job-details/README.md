# 📋 Job Details — AI Job PDF Extractor

> Upload job listing PDFs, extract structured job details with **free OpenRouter models**, and browse companies — all in a Claude-style beige UI.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Free_models-6366F1?logo=openai&logoColor=white)](https://openrouter.ai)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Ready-000000?logo=vercel&logoColor=white)](https://vercel.com)

---

## ✨ What this app does

**Job Details** is a job-hunting companion. Drop in the job-listing PDFs (or DOCX/TXT files) you've collected, and the app:

1. **Extracts text in your browser** — no binary uploads, no server-side PDF parsing, no Vercel upload limits.
2. **Parses every job with an LLM** (your choice of free OpenRouter models) into structured fields: title, company, contact email, location, experience required, and full description.
3. **Stores everything in PostgreSQL** via Prisma.
4. **Shows it all on a Dashboard** where you can search, filter by status, and expand any job to read the full details.
5. **Resolves company details automatically** from the job's email domain — so `hiring@acme-corp.com` becomes *Acme Corp* with type, location, and website. Personal/free email domains (`gmail.com`, `yahoo.com`, `live.com`, `outlook.com`, `google.com`, …) are **never** shown as companies.

---

## 🎨 Screenshots

> *Coming soon — add your dashboard screenshots here.*

```
┌────────────────────────────────────────────────────────────────┐
│  Job Details          ┌────────────────────────────────────┐  │
│  ┌──────────────┐     │  Job Dashboard                     │  │
│  │ 📊 Dashboard │     │  ┌────────┐ ┌────────┐ ┌────────┐  │  │
│  │ 📤 Upload    │     │  │  Total │ │Company │ │ Source │  │  │
│  └──────────────┘     │  │  Jobs  │ │  Info  │ │ Files  │  │  │
│                       │  └────────┘ └────────┘ └────────┘  │  │
│   Powered by          │  [🔍 Search jobs...] [Status ▾]    │  │
│   OpenRouter          │  ┌──────────────────────────────┐  │  │
│   free models         │  │ 💼 Sr. QA Engineer  @ Acme   │  │  │
│                       │  │    📍 Pune · ⏳ 5+ yrs       │  │  │
│                       │  └──────────────────────────────┘  │  │
│                       └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Features

### 📤 Multi-file upload
- Drag & drop or click-to-browse **multiple** PDF / DOCX / TXT / MD files at once.
- Text is extracted **in the browser** with [pdfjs-dist](https://github.com/mozilla/pdfjs-dist) and [mammoth](https://github.com/mwilliamson/mammoth.js) — the server only ever receives plain text JSON.
- Per-file progress: `Queued → Extracting → Parsing → Done (+N new)`.
- Files over 50MB are flagged and skipped.

### 🧠 LLM extraction (OpenRouter free models)
- The Upload page loads the **live list of free OpenRouter models** on page load (`GET /api/models`, cached 6h) and lets you pick any of them — no hardcoded model ids.
- **`OPENROUTER_MODEL` is the default extraction model** — every chunk tries it first; if it fails, extraction falls back through the curated free list (Nvidia + OpenAI — Google gemma models removed due to chronic upstream 429s).
- Each model chip shows its **context window** (larger = handles bigger files in one pass).
- A **Custom** option accepts any model id you type (e.g. `openrouter/free`).
- Large documents are split into overlapping chunks so output never exceeds the model's token limit.
- Results are deduplicated (by title + email + company) against existing rows.
- Strict-JSON prompting with fallback-safe parsing (handles markdown fences / prose around JSON).

### 📊 QA Jobs (default page)
- Compact job cards with search, company / location dropdown filters, and sort (newest / oldest / company).
- **Pagination** (40 per page) with First / Prev / Next / Last.
- Click a job for a **centered full-screen detail modal** (page header hidden while open).
- Client list cache via SWR (~5 min soft TTL).

### 📇 Recruiter Contacts
- **Contacts**: company → recruiter email(s), copy / mailto.
- Each row has a pastel company avatar (initials) matching the JobCard style; the copy button flashes **"Copied"** for instant feedback.
- Paginated (40 per page) with **Showing 1–40 of N**.

### 🏢 Company details (inline, no separate tab)
- Every job's email domain is checked against a **generic-domain blocklist**:
  `gmail.com, yahoo.com, hotmail.com, outlook.com, rediffmail.com, ymail.com, live.com, google.com, icloud.com, aol.com, protonmail.com, zoho.com, msn.com, qq.com, 163.com, …`
- Non-generic domains are resolved via the LLM into: **company name, type (Product/Service), location, website**.
- Results are cached in the `Company` table and linked back to jobs.
- The dashboard resolves companies on demand — jobs with personal-email domains simply show *"Company info not resolved"*.

### 🔐 Env-only API key
- The OpenRouter key is read **only** from `OPENROUTER_API_KEY` (`.env` locally, Vercel env vars in production).
- No settings page, no UI entry, no cookies — the key never reaches the browser.

### ⚠️ Free-model rate limits (HTTP 429)
- OpenRouter's `:free` models share a single **anonymous pool** per provider — when it's saturated the API returns `429` with `"limit_source":"upstream_provider_shared_pool"`, regardless of the model picked. Google AI Studio's pool is especially busy, which is why gemma models were dropped from extraction.
- Fix: add a key at https://openrouter.ai/settings/keys and set it as `OPENROUTER_API_KEY` in Vercel env vars. With `is_byok:true` the request uses **your** rate limit instead of the shared pool (free models still cost $0). Redeploy after changing env vars.
- If 429s persist, pick a model from a different provider (e.g. Nvidia instead of Google) — free pools are per-provider.
- Client-side resilience: retries honor OpenRouter's `Retry-After` header (max 60s backoff); extraction chunks rotate starting models so parallel calls don't all hammer one pool; a rate-limited model fails fast (2 tries) and the chunk switches provider.

### ⚡ Client + edge caching (Jobs / Contacts)
- List pages use **[SWR](https://swr.vercel.app)** so switching tabs reuses in-memory data instead of hitting Neon on every navigation.
- Soft TTL of **~5 minutes**: within that window, remounting a tab shows cached data with **no network/DB round-trip**.
- After a successful upload, caches for jobs / contacts are **invalidated** so the next visit refetches fresh rows.
- List GET APIs send `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` so Vercel’s edge can serve short-lived responses too (same behavior on localhost and production).

### 🎯 Match Jobs by Resume (per-user scoring)
- Nav: **Match by Resume**. Register/login, upload a resume, score shared board jobs against it.
- Compact fixed page header (title, scored/left counts, resume chip, Unscored/Rescore, Score) with a **user menu dropdown** — click the chip to see name/email and **Log out** (replaces the old separate logout button).
- Same shared filter bar as QA Jobs (**search**, **company** / **location** dropdowns, sort by score/company/location) plus score-only controls (min score, Remote) with **Showing 1–40 of N**.
- Results render as the same job cards as QA Jobs with a **fit % badge** and strengths snippet on each card; 40 cards per page.
- Click a card for a centered detail popup with strengths, gaps, and full description (header hidden while open).
- Score shared board jobs via OpenRouter. Each wave lists free `:free` models, then fires **one parallel request per model** with **10 jobs** each. Results upsert to `JobScore` as each chunk returns.
- Per-model: up to **2 tries**, then blacklist that model for the run and reassign the chunk.
- Scores keyed by `(userId, jobId)` so users never see each other’s results.
- **Single status line**: while scoring, live `processed / remaining` progress; when idle, `X scored · Y left`.
- **Rescore protection**: if everything is already scored, the confirm prompt says *"Everything is scored — rescore all N jobs?"* so a Rescore can’t silently re-process all jobs.
- Large runs (≥100 jobs) show a time warning; scoring can be resumed (unscored-only).
- Admin list of accounts: `GET /api/users` — requires non-empty `USERS_ADMIN_API_KEY`, passed as `x-api-key` or `Authorization: Bearer …`.

### 🔒 Login-gated Recruiter Contacts
- Recruiter Contacts are only visible to **logged-in users** — `/api/contacts` returns `401` without a session, and the sidebar link + page are hidden for logged-out visitors.
- The sidebar and contacts page share a session key (`/api/user/me` via SWR) so the section appears **instantly on login/logout** — no refresh needed.

### ✨ Today's Jobs (NEW badge + filter)
- Jobs added today get an eye-catching **gradient "✦ NEW" badge** (with a subtle pulse) on their card.
- A **"Today's Jobs"** toggle in the filter bar (QA Jobs + Match by Resume) filters to jobs added today (`createdAt >= start of day`).
- The dashboard header shows **"X new jobs today"**.
- The badge is date-based — a job shows NEW only on the calendar day it was added.

### 💬 AI Chat Assistant (Match by Resume)
- Floating chat widget on the Match by Resume page (logged-in users only).
- **Welcome screen** with two choices: **Ask a question** (AI answers from project knowledge + the user's own job data) or **Send a message to Tarun** (forwards to Telegram). An Ask/Message toggle in the header lets users switch modes anytime.
- User context (job counts, top matches, companies, locations) is **pre-loaded once** when the chat opens and cached in the browser — fast answers with no per-message DB query.
- Forwarded messages to Telegram include the requester's **name, email, timestamp, and full conversation history**.

### 📧 Email notifications (welcome + password reset)
- **Welcome email** — branded "QA Jobs Portal" HTML email sent automatically on registration (fire-and-forget; never blocks signup).
- **Password reset flow** — "Forgot password?" link on the login form → email with a **one-time reset link** (expires in 1 hour) → set a new password on `/reset-password`.
- Emails send via **Gmail SMTP app password** (`SMTP_*` env vars).
- The forgot-password response is **generic** whether or not the email is registered (prevents account enumeration) and reminds users to check spam; the rate limit is configurable via `RATE_LIMIT_FORGOT_PASSWORD`.

### 🕐 Background job enrichment (cron)
- A daily cron (`/api/cron/enrich-jobs`, every day at 1am) finds jobs with **missing fields** (description / location / experience / email) and re-runs the LLM to fill them.
- **Smart scoping**: if ≤ 30 jobs are incomplete, it enriches them all; if hundreds are missing data, it restricts to **today's new jobs** so the run doesn't burn LLM quota on the backlog.
- Protected by `CRON_SECRET` bearer token; can also be triggered manually via curl.

### 🛡 Security hardening
- `DELETE /api/jobs/[id]` and `POST /api/companies/resolve` now require **admin auth**.
- Session tokens reject **empty/hardcoded secrets** (no more `jobdetails-dev-secret` fallback).
- **Rate limiting** (in-memory per-IP/user) on login, register, admin login, chat, and forgot-password.
- **Security headers** via `proxy.ts`: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- **Server-side upload size cap** (5MB text) and self-hosted pdf.js worker (no CDN).
- Every user action is logged with **who** did it (`lib/action-log.ts`).

### 📊 Vercel Analytics
- Visitor analytics (daily unique visitors, page views, top paths, referrers, devices) via `@vercel/analytics`, enabled on the Vercel dashboard.

---

## 🛠 Tech stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org) (App Router) + React 19          |
| Language   | TypeScript (strict)                                               |
| Database   | PostgreSQL via [Prisma ORM 7](https://www.prisma.io)              |
| Client cache | [SWR](https://swr.vercel.app) (~5 min TTL for list pages)       |
| PDF text   | pdfjs-dist 6 — extracted **in the browser**                       |
| DOCX text  | mammoth — extracted **in the browser**                            |
| Styling    | Tailwind CSS 4, Claude-style beige palette                        |
| LLM        | OpenRouter chat completions (free models)                         |
| Deploy     | Vercel-ready (stateless API routes, env-var config)               |

---

## 🧱 Project structure

```
job-details/
├─ app/
│  ├─ (app)/                    # sidebar-wrapped pages (SWRProvider + PageChrome)
│  │  ├─ page.tsx               # QA Jobs — filtered cards + centered detail modal
│  │  ├─ contacts/              # Recruiter emails by company (login-gated)
│  │  ├─ score/                 # Match by Resume — auth, upload, scoring, results
│  │  └─ upload/                # multi-file upload + extraction (admin)
│  ├─ forgot-password/          # forgot-password form (emails reset link)
│  ├─ reset-password/           # set new password via emailed token
│  ├─ api/
│  │  ├─ upload/                # POST — extract + persist jobs
│  │  ├─ jobs/                  # GET (list/search/filters, Cache-Control) · DELETE
│  │  ├─ jobs/[id]/             # GET · DELETE single job (admin)
│  │  ├─ jobs/filters/          # GET — distinct company/location dropdown options
│  │  ├─ companies/             # GET list
│  │  ├─ companies/resolve/     # POST — resolve company info (admin)
│  │  ├─ contacts/              # GET emails by company (login required)
│  │  ├─ user/                  # register · login · logout · me · resume · score · matches · forgot/reset-password
│  │  ├─ users/                 # GET admin user list (USERS_ADMIN_API_KEY)
│  │  ├─ chat/                  # POST chat assistant · GET context snapshot
│  │  ├─ cron/enrich-jobs/      # POST — daily LLM fill of missing job fields (CRON_SECRET)
│  │  ├─ settings/              # GET — config status (key configured, model)
│  │  └─ extract-preview/       # POST — word count for pasted text
│  ├─ layout.tsx                # root layout (font, metadata, Analytics)
│  ├─ not-found.tsx
│  └─ globals.css               # Claude beige theme tokens
├─ proxy.ts                     # security headers (CSP, HSTS, X-Frame-Options, …)
├─ components/
│  ├─ Sidebar.tsx               # left navigation (auth-aware — hides Contacts when logged out)
│  ├─ SWRProvider.tsx           # shared SWRConfig for list pages
│  ├─ PageChrome.tsx            # fixed page header + scroll body
│  ├─ ListPagination.tsx        # First / Prev / Next / Last control
│  ├─ ShowingRange.tsx          # "Showing 1–40 of N" label
│  ├─ JobCard.tsx               # shared job card (QA Jobs + Match by Resume) + NEW badge
│  ├─ JobFilters.tsx            # shared search / company / location / sort / Today's Jobs bar
│  ├─ JobDetailModal.tsx        # shared job detail popup
│  ├─ ChatWidget.tsx            # floating AI chat (Ask / Message Tarun)
│  ├─ Markdown.tsx              # chat markdown renderer
│  └─ Skeleton.tsx              # loading placeholders
├─ lib/
│  ├─ client/pdf.ts             # browser-side PDF/DOCX text extraction
│  ├─ use-list-swr.ts           # SWR hook + ~5 min TTL + upload invalidate
│  ├─ swr-fetcher.ts            # shared fetcher + Cache-Control + SESSION_KEY
│  ├─ openrouter.ts             # OpenRouter client (retries, JSON parsing)
│  ├─ extract-jobs.ts           # LLM job extraction + dedupe
│  ├─ enrich-jobs.ts            # cron LLM fill of missing job fields
│  ├─ company.ts                # email-domain → company resolution
│  ├─ config.ts                 # env-var config (incl. SMTP)
│  ├─ auth.ts                   # env-only API key resolver
│  ├─ user-auth.ts              # Match-by-Resume cookie sessions + reset tokens
│  ├─ admin-auth.ts             # admin cookie sessions
│  ├─ action-log.ts             # user-aware action logging (who did what)
│  ├─ rate-limit.ts             # in-memory per-IP/user rate limiting
│  ├─ email.ts                  # SMTP sender + welcome/reset email templates
│  ├─ db.ts                     # Prisma singleton (driver adapter)
│  ├─ types.ts / utils.ts / extract.ts / sanitize.ts
├─ prisma/
│  └─ schema.prisma             # Job + Company + User + Resume + JobScore
├─ prisma.config.ts             # Prisma 7 config (DB URL for CLI)
├─ generated/                   # Prisma client (gitignored)
├─ .env.example                 # env template (checked in)
├─ .env                         # local secrets (gitignored)
└─ next.config.ts / postcss.config.mjs / eslint.config.mjs / tsconfig.json
```

---

## 📦 Getting started (local)

### Option A — PostgreSQL via Docker (easiest)

```bash
cd job-details
npm install

# 1. Start a Postgres container (matches the default DATABASE_URL in .env)
docker run -d --name jobdetails-postgres \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jobdetails \
  -p 5432:5432 -v jobdetails-pgdata:/var/lib/postgresql/data postgres:16

# 2. Create .env from the template and fill in your values
cp .env.example .env
#    DATABASE_URL        — postgresql://postgres:postgres@localhost:5432/jobdetails?schema=public
#    OPENROUTER_API_KEY  — your OpenRouter key (https://openrouter.ai/keys)
#    ADMIN_USERNAME      — admin login for the Upload page
#    ADMIN_PASSWORD      — admin password for the Upload page

# 3. Create the database schema
npx prisma db push

# 4. Run
npm run dev
# → http://localhost:3000
```

To stop/start the container later: `docker stop jobdetails-postgres` / `docker start jobdetails-postgres`.

### Option B — existing Postgres (local or cloud)

```bash
cd job-details
npm install
cp .env.example .env
#    set DATABASE_URL to your Postgres connection string (local, Neon, Vercel Postgres)
npx prisma db push
npm run dev
```

### Environment variables

| Variable             | Required | Description                                                                  | Example                                                       |
| -------------------- | -------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`       | ✅       | PostgreSQL connection string (used by Prisma CLI **and** runtime)            | `postgresql://user:pass@host:5432/jobdetails?schema=public`  |
| `OPENROUTER_API_KEY` | ✅       | OpenRouter API key — server-side only, never exposed to the client           | `sk-or-v1-…`                                                  |
| `OPENROUTER_MODEL`   | ❌       | Default model when none is selected on Upload                                | `nvidia/nemotron-nano-9b-v2:free`                             |
| `GENERIC_EMAIL_DOMAINS` | ❌     | Comma-separated personal-email domains hidden from the dashboard             | `gmail.com,yahoo.com,live.com,…`                              |
| `ADMIN_USERNAME`     | ❌       | Username that unlocks the Upload page (defaults to `admin`)                  | `admin`                                                       |
| `ADMIN_PASSWORD`     | ❌       | Password that unlocks the Upload page — without it, uploads stay locked      | `admin123`                                                    |
| `USERS_ADMIN_API_KEY`| ❌       | API key for `GET /api/users` (Match-by-Resume account list). Empty = 503.   | `your-secret-key`                                             |
| `NEXT_PUBLIC_APP_NAME` | ❌     | App name shown in the sidebar                                                | `QA Tracker`                                                  |
| `NEXT_PUBLIC_APP_URL`  | ❌     | Public app URL (used for emailed links + OpenRouter referer)                | `https://your-app.vercel.app`                                 |
| `NEXT_PUBLIC_MAX_FILE_SIZE_MB` | ❌ | Max upload size per file shown on the Upload page                          | `50`                                                          |
| `TELEGRAM_BOT_TOKEN` | ❌       | Telegram bot token for chat-widget forwarding to the owner                   | `8887227521:AA…`                                              |
| `TELEGRAM_CHAT_ID`   | ❌       | Owner's Telegram chat id for forwarded messages                              | `1622727099`                                                  |
| `CHATBOT_MODEL`      | ❌       | Optional OpenRouter model for chat auto-answers (falls back to `OPENROUTER_MODEL`) | `nvidia/nemotron-nano-9b-v2:free`                     |
| `SMTP_HOST`          | ❌       | SMTP server for welcome/reset emails (default `smtp.gmail.com`)              | `smtp.gmail.com`                                              |
| `SMTP_PORT`          | ❌       | SMTP port (default `587`)                                                   | `587`                                                         |
| `SMTP_USER`          | ❌       | SMTP account (e.g. Gmail address)                                           | `qajobs.portal@gmail.com`                                     |
| `SMTP_PASS`          | ❌       | SMTP app password (Gmail App Password, not the account password)            | `xxxx xxxx xxxx xxxx`                                         |
| `SMTP_FROM_NAME`     | ❌       | "From" display name on emails (default `QA Jobs Portal`)                     | `QA Jobs Portal`                                              |
| `SMTP_FROM_EMAIL`    | ❌       | "From" email (defaults to `SMTP_USER`)                                      | `qajobs.portal@gmail.com`                                     |
| `CRON_SECRET`        | ❌       | Bearer token protecting `/api/cron/enrich-jobs`                              | `your-secret`                                                 |
| `RATE_LIMIT_FORGOT_PASSWORD` | ❌ | Max forgot-password requests per IP per 15 min (default `5`)               | `5`                                                           |

---

## 🧪 Scripts

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Start the dev server (Turbopack)             |
| `npm run build`            | Production build                             |
| `npm run start`            | Serve the production build                   |
| `npm run lint`             | ESLint                                       |
| `npm run db:generate`      | Generate the Prisma client                   |
| `npm run db:push`          | Push the schema to the DB (no migrations)    |
| `npm run db:migrate`       | Create/apply a migration (dev)               |
| `npm run db:deploy`        | Apply migrations (prod)                      |
| `npm run db:seed`          | Seed the database                            |

> The `postinstall` script runs `prisma generate` automatically, so a plain `npm install` / `next build` works without extra steps.

---

## ☁️ Deploy to Vercel (functional guide)

The app is fully serverless-ready: PDF text is extracted **in the browser**, so no
binary uploads hit the server, and all state lives in PostgreSQL. On Vercel you
just swap the local Docker Postgres for a cloud Postgres (Neon / Vercel Postgres)
via the `DATABASE_URL` env var — no code changes.

**1. Create a Neon database (free)**
- Sign up at [neon.tech](https://neon.tech) → **New Project** → name it `jobdetails`
- Copy the **connection string** from the dashboard, e.g.
  `postgresql://user:password@ep-xxx.region.aws.neon.tech/jobdetails?sslmode=require`

**2. Push the schema to Neon (run locally)**
```bash
cd job-details
set DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/jobdetails?sslmode=require"
npx prisma db push
```

**3. Deploy on Vercel**
- [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo
- **Root Directory**: set to **`job-details`** (the repo root contains multiple projects)
- Framework: **Next.js** (auto-detected)
- Add **Environment Variables** (Project → Settings → Environment Variables):
  - `DATABASE_URL` — the Neon connection string
  - `OPENROUTER_API_KEY` — your OpenRouter key
  - `OPENROUTER_MODEL` — default `nvidia/nemotron-nano-9b-v2:free`
  - `GENERIC_EMAIL_DOMAINS` — the comma-separated personal-domain list
  - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — upload page credentials
  - `NEXT_PUBLIC_APP_URL` — `https://<your-project>.vercel.app`
- **Deploy**. The `postinstall` script runs `prisma generate` during the build.

**4. Function duration note**
The upload route sets `maxDuration = 300` so LLM calls (which can take a couple
of minutes) aren't cut off. Vercel Hobby allows up to 300s.

**5. Company details (batched resolve)**
Company type + description in the Contacts table are resolved from email
domains by an LLM and **persisted** in the `Company` table — the UI only reads
them.

**Do not** resolve hundreds of domains in one Vercel request — it will hit
`FUNCTION_INVOCATION_TIMEOUT`. Prefer one of:

**A. Local script against Neon (best for a full backfill)**
```bash
# PowerShell — use your Neon connection string
$env:DATABASE_URL="postgresql://…@….neon.tech/jobdetails?sslmode=require"
npm run resolve-companies
```

**B. Batched HTTP calls on Vercel** (after deploy). Each call resolves ~10 domains:
```powershell
do {
  $r = Invoke-RestMethod -Uri "https://qajobs.vercel.app/api/companies/resolve" `
    -Method Post -ContentType "application/json" -Body '{"limit":10}'
  $r | ConvertTo-Json -Compress
} while (-not $r.done)
```

When the LLM can't determine a value it's stored as empty (`NULL`) and the UI
shows `—` instead of "Unknown".

**6. First-load note**
Neon's free tier auto-pauses after ~5 min of inactivity — the first request after
a pause takes a few seconds to wake the DB. That's normal.

### Prisma 7 notes for Vercel
- Prisma 7 uses **driver adapters** (`@prisma/adapter-pg`) at runtime — the `DATABASE_URL` must be a **direct TCP connection string** (not `prisma://`/Accelerate or a pooled connection pooler URL).
- Schema changes are applied with `prisma db push` / `prisma migrate deploy` locally — they are **not** run during the Vercel build.
- If you get SSL certificate errors against your DB, the app already passes `rejectUnauthorized: false` in production.

---

## 🔄 How extraction works (end to end)

```
[ User uploads PDFs ]        [ Browser ]                  [ Server ]                [ DB ]
         │                         │                           │                       │
         │  PDF/DOCX/TXT files     │  pdfjs / mammoth          │                       │
         ├────────────────────────▶│  extracts plain text      │                       │
         │                         ├──────────────────────────▶│  POST /api/upload     │
         │                         │  { fileName, text }       │  (text only, no bin) │
         │                         │                           ├──────────────────────▶│
         │                         │                           │  chunk text (~6k)    │
         │                         │                           │  LLM → strict JSON   │
         │                         │                           │  dedupe vs existing  │
         │                         │                           │  createMany jobs     │
         │                         │                           │                       │
         │  Dashboard (GET /api/jobs)  ◀── jobs + companyInfo ──┤                       │
         │                         │                           │                       │
         │  Tab switch within ~5 min → SWR memory cache (no Neon hit)                  │
         │  After upload → invalidateListCaches() → next visit refetches               │
         │                         │                           │                       │
         │  POST /api/companies/resolve                        │                       │
         │                         │                           │  domain blocklist    │
         │                         │                           │  LLM → Company rows  │
         │                         │                           │  link jobs → company │
```

---


## 📐 Data model

### `Job`
| Field         | Type       | Notes                                  |
| ------------- | ---------- | -------------------------------------- |
| `id`          | `uuid`     | PK                                     |
| `title`       | `string`   | Job title / position                   |
| `company`     | `string`   | Company name as extracted              |
| `email`       | `string?`  | Contact / application email            |
| `location`    | `string?`  | e.g. "Pune", "Remote", "Bangalore/Pune"|
| `experience`  | `string?`  | e.g. "5-8 Yrs", "Fresher"              |
| `description` | `text?`    | Full job description                   |
| `fileName`    | `string?`  | Source upload                          |
| `status`      | `string`   | `new` · `reviewed` · `applied` · `interview` · `offer` · `rejected` |
| `companyId`   | `uuid?`    | FK → `Company` (SetNull on delete)     |

### `Company`
| Field         | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `id`          | `uuid`    | PK                                       |
| `domain`      | `string`  | Unique email domain                      |
| `name`        | `string`  | Resolved company name                    |
| `type`        | `string?` | `Product` / `Consulting` / `Staffing` / `Service` / `Unknown` |
| `description` | `text?`   | 1-2 sentence summary of what the company does |
| `location`    | `string?` | HQ location (if known)                   |
| `website`     | `string?` | Company website (if known)               |
| `source`      | `string?` | `llm`                                    |

---

## 📡 API reference

| Method | Endpoint                 | Description                                        | Query / Body                                        |
| ------ | ------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| `GET`  | `/api/jobs`              | List jobs with company info (edge-cached 60s)       | `search`, `status`, `company`, `location`, `sort`, `today` |
| `GET`  | `/api/jobs/:id`          | Single job + company info                           | —                                                   |
| `DELETE` | `/api/jobs`            | Clear all jobs (admin)                              | —                                                   |
| `DELETE` | `/api/jobs/:id`        | Delete one job (admin)                              | —                                                   |
| `GET`  | `/api/jobs/filters`      | Distinct company/location dropdown options (edge-cached 60s) | `search`, `company`, `location`          |
| `POST` | `/api/upload`            | Extract + persist jobs from text                    | `{ fileName, text, model? }`                        |
| `GET`  | `/api/companies`         | List companies with job counts                      | —                                                   |
| `GET`  | `/api/contacts`          | Recruiter emails by company (login required)        | `search`, `page`, `pageSize`                        |
| `POST` | `/api/companies/resolve` | Resolve/backfill company info in batches (admin). Repeat until `remaining` is 0. | `{ model?, limit? }` |
| `GET`  | `/api/settings`          | Config status: service configured, default model, app name      | —                                                   |
| `POST` | `/api/extract-preview`   | Word/char count for pasted text                     | `{ text }`                                          |
| `POST` | `/api/user/register`     | Create account + send welcome email                 | `{ name, email, password }`                         |
| `POST` | `/api/user/login`        | Log in (sets httpOnly session cookie)               | `{ email, password }`                               |
| `POST` | `/api/user/logout`       | Log out                                             | —                                                   |
| `GET`  | `/api/user/me`           | Current user + resume metadata (or `{user:null}`)   | —                                                   |
| `POST` | `/api/user/resume`       | Upsert the logged-in user's resume                  | `{ filename, content, mimeType? }`                  |
| `POST` | `/api/user/forgot-password` | Email a one-time reset link (generic response, no enumeration) | `{ email }`                                  |
| `POST` | `/api/user/reset-password` | Set a new password via a valid reset token        | `{ token, password }`                               |
| `GET`  | `/api/user/matches`      | Scored jobs for the logged-in user (searchable/filterable)        | `search`, `company`, `location`, `minScore`, `remote`, `today`, `sort`, `order`, `page`, `pageSize` |
| `GET`  | `/api/user/score`        | Score preview counts for the logged-in user                       | `search`                                             |
| `POST` | `/api/user/score`        | Score shared jobs against the user's resume (NDJSON stream)       | `{ scope, search? }`                                |
| `POST` | `/api/chat`              | Chat assistant — answer a question or forward a message to the owner's Telegram | `{ message, mode?, history?, context? }` |
| `GET`  | `/api/chat/context`      | User job-data context snapshot (cached client-side)  | —                                                   |
| `POST` | `/api/cron/enrich-jobs`  | Fill missing job fields via LLM (bearer `CRON_SECRET`) | `{ limit? }`                                      |

> List GET routes that say **edge-cached** return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. The browser client still uses `cache: "no-store"` so SWR owns freshness after uploads.

---

## 🔧 Troubleshooting

| Problem | Fix |
| ------- | --- |
| `No OpenRouter API key configured` | Set `OPENROUTER_API_KEY` in `.env` (local) or Vercel env vars. |
| `OpenRouter returned 402` | The model needs credits or has no free variant — pick a free model id on the Upload page. |
| `OpenRouter rejected the API key (401)` | Double-check the key at [openrouter.ai/keys](https://openrouter.ai/keys); it must be `sk-or-v1-…`. |
| `DATABASE_URL is not set` | Add `DATABASE_URL` to `.env` / Vercel env vars. |
| `P1010: User was denied access` / SSL errors | The app uses `rejectUnauthorized: false` in production; verify the direct connection string and DB credentials. |
| No jobs extracted from a file | The file may not contain job listings, or the text extraction found too little text (< 50 chars). |
| Large PDF stalls | Files over 50MB are skipped; very large PDFs take longer in-browser — try splitting the file. |

---

## 📄 License

MIT — free to use for your job search. Built with ❤️ for the beige theme enjoyers.
