# Tarun Kumar Babbar — Personal Profile

A warm, Claude-inspired portfolio website built with **Next.js 16**, **Tailwind CSS v4**, and **Framer Motion**. Showcases 18+ years of QA engineering experience, AI-powered QA applications, an agentic QA pipeline that took **1st place at the AI Tester Blueprint 3x hackathon**, and the current work at **Coforge Limited for client Xplor Technologies**.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Fonts | Inter (UI), JetBrains Mono (code tags) |
| Deployment | Vercel |

## Sections

- **Hero** — Name-first intro with photo, 1st-place hackathon badge, AI QA Architect / Test Automation Architect headline, CTAs (Explore AI Apps, QAE2E Live Demo, GitHub), and stats bar (18+ years, 10+ AI apps built, #1 hackathon, 100% automation adoption)
- **About** — Bio focused on multi-agent pipelines: AI-generated requirements → test cases with auto duplicate-scenario detection → DeepEval output evaluation → model-driven decisions via agentic prompting → automation. Highlights grid included.
- **AI Applications** (`#apps`) — Featured spotlight for **QAE2E** (1st place, AI Tester Blueprint 3x) with live demo, source links, and pipeline chips, followed by cards for live AI apps:
  - QA Jobs Portal
  - QA AI Dashboard
  - QA RAG Platform
  - QA Interview Prep Kit
  - Jira QA Crew
  - Resume → Job RAG Pipeline
  - Chroma RAG Pipeline Visualizer
  - 8-Layer Playwright Framework
  - Self-Healing Playwright
- **Skills** — 6 category grids: AI & Agentic QA (DeepEval, multi-agent orchestration), Test Automation, Platforms & Workflow (Azure DevOps, TFS, YAML pipelines, Blazor), Languages, Vector DBs & Data, Frameworks & Architecture
- **Career** — Timeline: Solutions Architect at Coforge Limited (client: Xplor Technologies), AI + Test Automation R&D, Coupa Software, Varian Medical Systems, TCS, Infosys
- **Education** — BE Computer Science, Modi Institute of Technology, Kota
- **Contact** — LinkedIn, GitHub, WhatsApp, Phone, plus org-level positioning (open to Architect / Principal SDET / QA Head roles building org-wide QA AI platforms)
- **Header** — Sticky nav with scroll-aware background, mobile hamburger menu

## Design

- **Theme:** Claude-inspired warm beige palette (`#faf9f5` background, terracotta `#c96442` accent, `#e8e3d7` borders, white cards)
- **Typography:** Inter for body text; JetBrains Mono for tech chips
- **Animations:** Framer Motion scroll-triggered fade/slide/stagger on every section
- **Responsive:** Mobile-first layout with adaptive grids

## Getting Started

```bash
cd C:\Tarun\ai-learning\AILearning\my-profile
npm install
cp .env.example .env.local   # then fill in OPENROUTER_API_KEY
npx next dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tarun's AI Assistant (Chatbot)

A floating chat widget on the bottom-right of the page. Visitors can ask anything about Tarun — experience, projects, skills, education, contact — and the bot answers from the profile using **OpenRouter free models**.

### How it works

1. **Free-model fallback chain** — The bot tries the ordered list in `FREE_MODELS_JSON` (`.env`), starting with the **fastest** model first. On any failure (rate limit `429`, a delisted model, network error, timeout, or empty reply) it automatically falls back to the next model in the list until one succeeds.
2. **Profile-grounded answers** — A system prompt built from `src/lib/profile-knowledge.ts` (mirrors the `About` / `Career` / `Projects` / `Skills` / `Education` / `Contact` sections) lets the bot answer only from known profile facts.
3. **WhatsApp escalation** — When a question is outside the profile (general chat, unrelated help, anything the bot can't answer), the model returns a summary marker and the widget shows an **Open WhatsApp** button. Tapping it opens a pre-filled `wa.me` chat to Tarun's number with the visitor's summarized query.
4. **Session memory** — Multi-turn conversation context is kept in the widget for the visitor's session.

### Env variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key (**required**). Get one at [openrouter.ai](https://openrouter.ai). |
| `OPENROUTER_BASE_URL` | OpenRouter base URL (default `https://openrouter.ai/api/v1`). |
| `FREE_MODELS_JSON` | Ordered JSON array of `{id, name}` free models. **Index 0 = fastest, tried first.** Reorder/add/remove freely. Only `:free` endpoints are allowed. |
| `WHATSAPP_NUMBER` | WhatsApp number (digits only, country code first) that unanswered queries are forwarded to. |
| `WHATSAPP_PREFIX` | Display prefix (default `+91`). |
| `BOT_NAME` / `PROFILE_OWNER` | Bot persona labels. |

### Updating the model chain

Free models churn frequently on OpenRouter. To add, remove, or reorder:

1. Edit `FREE_MODELS_JSON` in `.env.local` (or the Vercel env vars in production).
2. Keep the first entry as the fastest model you want tried first.
3. No code changes needed.

Only `:free` model IDs are accepted — the server refuses anything else, so a misconfigured env can't accidentally bill you.

### Production (Vercel)

Set the same env vars in the Vercel project dashboard (Settings → Environment Variables). The `.env.local` file is gitignored and never committed.

## Build

```bash
npx next build
```

## Deployment

Deployed on Vercel with `my-profile/` as root directory. Auto-deploys on push to `main`.

## License

MIT
