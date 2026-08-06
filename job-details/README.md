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
- Each model chip shows its **context window** (larger = handles bigger files in one pass).
- A **Custom** option accepts any model id you type (e.g. `openrouter/free`).
- Large documents are split into overlapping chunks so output never exceeds the model's token limit.
- Results are deduplicated (by title + email + company) against existing rows.
- Strict-JSON prompting with fallback-safe parsing (handles markdown fences / prose around JSON).

### 📊 Dashboard (default page)
- **Stat cards**: total jobs, jobs with company info, unique source files.
- **Search** across title, company, location, experience, and email (debounced).
- **Status filter** and **sort** (newest / oldest / company A–Z).
- **Expandable job cards** showing the full job description, source file, and resolved company info inline.

### 🏢 Company details (inline, no separate tab)
- Every job's email domain is checked against a **generic-domain blocklist**:
  `gmail.com, yahoo.com, hotmail.com, outlook.com, rediffmail.com, ymail.com, live.com, google.com, icloud.com, aol.com, protonmail.com, zoho.com, msn.com, qq.com, 163.com, …`
- Non-generic domains are resolved via the LLM into: **company name, type (Product/Service), location, website**.
- Results are cached in the `Company` table and linked back to jobs.
- The dashboard resolves companies on demand — jobs with personal-email domains simply show *"Company info not resolved"*.

### 🔐 Env-only API key
- The OpenRouter key is read **only** from `OPENROUTER_API_KEY` (`.env` locally, Vercel env vars in production).
- No settings page, no UI entry, no cookies — the key never reaches the browser.

---

## 🛠 Tech stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org) (App Router) + React 19          |
| Language   | TypeScript (strict)                                               |
| Database   | PostgreSQL via [Prisma ORM 7](https://www.prisma.io)              |
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
│  ├─ (app)/                    # sidebar-wrapped pages
│  │  ├─ page.tsx               # Dashboard (default) — jobs + company info
│  │  └─ upload/                # multi-file upload + extraction
│  ├─ api/
│  │  ├─ upload/                # POST — extract + persist jobs
│  │  ├─ jobs/                  # GET (list/search) · DELETE (clear all)
│  │  ├─ jobs/[id]/             # GET · DELETE single job
│  │  ├─ companies/             # GET list
│  │  ├─ companies/resolve/     # POST — resolve company info from emails
│  │  ├─ settings/              # GET — config status (key configured, model)
│  │  └─ extract-preview/       # POST — word count for pasted text
│  ├─ layout.tsx                # root layout (font, metadata)
│  ├─ not-found.tsx
│  └─ globals.css               # Claude beige theme tokens
├─ components/
│  └─ Sidebar.tsx               # left navigation
├─ lib/
│  ├─ client/pdf.ts             # browser-side PDF/DOCX text extraction
│  ├─ openrouter.ts             # OpenRouter client (retries, JSON parsing)
│  ├─ extract-jobs.ts           # LLM job extraction + dedupe
│  ├─ company.ts                # email-domain → company resolution
│  ├─ config.ts                 # env-var config
│  ├─ auth.ts                   # env-only API key resolver
│  ├─ db.ts                     # Prisma singleton (driver adapter)
│  ├─ types.ts / utils.ts / extract.ts
├─ prisma/
│  └─ schema.prisma             # Job + Company models
├─ prisma.config.ts             # Prisma 7 config (DB URL for CLI)
├─ generated/                   # Prisma client (gitignored)
├─ .env.example                 # env template (checked in)
├─ .env                         # local secrets (gitignored)
└─ next.config.ts / postcss.config.mjs / eslint.config.mjs / tsconfig.json
```

---

## 📦 Getting started (local)

```bash
cd job-details
npm install

# 1. Create .env from the template and fill in your values
cp .env.example .env
#    DATABASE_URL        — your Postgres connection string
#    OPENROUTER_API_KEY  — your OpenRouter key (https://openrouter.ai/keys)

# 2. Create the database schema
npx prisma db push

# 3. Run
npm run dev
# → http://localhost:3000
```

### Environment variables

| Variable             | Required | Description                                                        | Example                                                        |
| -------------------- | -------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `DATABASE_URL`       | ✅       | PostgreSQL connection string (used by Prisma CLI **and** runtime)  | `postgresql://user:pass@host:5432/jobdetails?schema=public`    |
| `OPENROUTER_API_KEY` | ✅       | OpenRouter API key — server-side only, never exposed to the client | `sk-or-v1-…`                                                   |
| `OPENROUTER_MODEL`   | ❌       | Default model when none is selected on Upload                      | `deepseek/deepseek-v4-flash`                                   |
| `NEXT_PUBLIC_APP_NAME` | ❌     | App name shown in the sidebar                                       | `Job Details`                                                  |

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

## ☁️ Deploy to Vercel

1. Push this folder to a GitHub repo (the repo root is `job-details/`).
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Vercel auto-detects **Next.js**.
3. Create a Postgres database — [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) or [Neon](https://neon.tech) — and copy its connection string.
4. Add **Environment Variables** (Project → Settings → Environment Variables):
   - `DATABASE_URL` — the Postgres connection string (use the *direct* URL, not a pooled URL, since Prisma 7 uses a driver adapter).
   - `OPENROUTER_API_KEY` — your OpenRouter key.
   - `OPENROUTER_MODEL` — optional, defaults to `deepseek/deepseek-v4-flash`.
5. Deploy. That's it — `postinstall` runs `prisma generate` during the build.

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
| Field      | Type      | Notes                          |
| ---------- | --------- | ------------------------------ |
| `id`       | `uuid`    | PK                             |
| `domain`   | `string`  | Unique email domain            |
| `name`     | `string`  | Resolved company name          |
| `type`     | `string?` | `Product` / `Service` / `Unknown` |
| `location` | `string?` | HQ location (if known)         |
| `website`  | `string?` | Company website (if known)     |
| `source`   | `string?` | `llm`                          |

---

## 📡 API reference

| Method | Endpoint                 | Description                                        | Query / Body                                        |
| ------ | ------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| `GET`  | `/api/jobs`              | List jobs with company info                         | `search`, `status`, `company`, `sort`, `limit`      |
| `GET`  | `/api/jobs/:id`          | Single job + company info                           | —                                                   |
| `DELETE` | `/api/jobs`            | Clear all jobs                                      | —                                                   |
| `DELETE` | `/api/jobs/:id`        | Delete one job                                      | —                                                   |
| `POST` | `/api/upload`            | Extract + persist jobs from text                    | `{ fileName, text, model? }`                        |
| `GET`  | `/api/companies`         | List companies with job counts                      | —                                                   |
| `POST` | `/api/companies/resolve` | Resolve company info for unresolved email domains   | `{ model? }`                                        |
| `GET`  | `/api/settings`          | Config status: key configured, source, model, models| —                                                   |
| `POST` | `/api/extract-preview`   | Word/char count for pasted text                     | `{ text }`                                          |

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
