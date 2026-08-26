# Glassdoor Company Details Portal

A job-seeker-facing portal (Next.js 15 / React 19, beige theme) that shows
companies categorized by type, their Glassdoor star ratings, pros vs cons
extracted from real employee reviews, and consolidated salaries per designation
(in ₹ LPA).

Data flow: **Glassdoor → JSON dump → OpenRouter LLM → enriched JSON → UI**.

## Note on Glassdoor access

Glassdoor has **no free API** and aggressively blocks automated scraping
(login wall + Cloudflare/CAPTCHA). This project is designed so the **JSON dump
is the source of truth** — the LLM pipeline and UI only read `data/*.json`.
That means:

- `npm run scrape` (Playwright login) may work **or may be blocked** by a
  CAPTCHA. If it is, you can still paste data manually (below).
- You can edit `data/companies.raw.json` by hand at any time and re-run
  `npm run analyze` — no scraping required.

Please respect Glassdoor's Terms of Service when using this tool.

---

## Quick start

```bash
npm install
npx playwright install chromium      # only needed for npm run scrape
cp .env.local.example .env.local     # add OPENROUTER_API_KEY at minimum
npm run dev                          # http://localhost:3000
```

The app already ships with a small **sample dataset** (`data/companies.enriched.json`)
so the UI works out of the box.

## Configuration (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Required for LLM categorization / summaries / salary consolidation |
| `OPENROUTER_MODEL` | OpenRouter model id (default `meta-llama/llama-3.3-70b-instruct`) |
| `OPENROUTER_TEMPERATURE` | Sampling temperature for analysis (default `0.2`) |
| `GLASSDOOR_EMAIL` / `GLASSDOOR_PASSWORD` | Used only by `npm run scrape` |
| `GLASSDOOR_BASE_URL` | Glassdoor base (default `https://www.glassdoor.com`) |

## Pipelines

### 1. Scrape → raw JSON

```bash
npm run scrape
```

Opens a headless logged-in Chromium session from `data/seed-companies.json`,
captures each company's rating, rating breakdown, review count, headcount, a
sample of reviews, and salary lines, then writes **`data/companies.raw.json`**.

If a company is blocked, it is skipped and the run continues. The seed list is
editable — add or remove companies in `data/seed-companies.json`.

### 2. Analyze → enriched JSON

```bash
npm run analyze
```

Reads `data/companies.raw.json`, calls OpenRouter once per company to:
- classify the **type** (Product / Service / Consulting / Staffing / Startup)
- normalize the **industry**
- summarize concise **good** vs **bad** bullets from the review sample
- consolidate **salaries** into ₹ LPA per designation

Writes **`data/companies.enriched.json`** (what the UI reads). If no
`OPENROUTER_API_KEY` is set, it falls back to local heuristic type
classification so the pipeline still runs.

### On-demand re-analysis

On a company's detail page, click **“Re-analyze with LLM”**. This POSTs to
`/api/analyze?slug=<slug>`, re-runs OpenRouter on that company's latest raw
reviews, and updates only that company in the enriched JSON.

---

## Manual paste (fallback when scrape is blocked)

1. Create `data/companies.raw.json` with this shape:

```json
{
  "version": 1,
  "scrapedAt": "2026-01-01T00:00:00Z",
  "companies": [
    {
      "name": "Acme Corp",
      "url": "https://www.glassdoor.com/...",
      "rating": 4.1,
      "ratingBreakdown": { "career": 4.0, "comp": 4.2, "management": 3.9, "culture": 4.3 },
      "totalReviews": 1234,
      "headcount": { "india": "10,000+", "global": "20,000+" },
      "reviews": [
        "Great work-life balance and strong learning culture...",
        "Below-market hikes at senior levels..."
      ],
      "salaries": [
        "₹20 LPA",
        "12 lakhs",
        "1.2 Cr per year"
      ]
    }
  ]
}
```

2. `npm run analyze` → generated `data/companies.enriched.json` → `npm run dev`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run scrape` | Playwright Glassdoor scrape → raw JSON |
| `npm run analyze` | OpenRouter LLM pipeline → enriched JSON |

## Tech stack

- **Next.js 15 / React 19**, App Router, Server Components
- **Tailwind CSS v4** with a beige/cream palette
- **Playwright** for scraping
- **OpenRouter** for LLM analysis
- **Zod** for schema validation

## Structure

```
app/                  Next.js routes (list, detail, /api/analyze)
components/           StarRating, TypeBadge, ProsCons, SalaryTable, cards
scripts/              scrape + analyze pipelines (Node)
scripts/lib/          openrouter client, category prompts, salary parser
data/                 seed list, raw dump, enriched dump
lib/                  zod types + server data readers
```