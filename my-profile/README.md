# Tarun Kumar Babbar — Personal Profile

A stunning, Claude-themed portfolio website built with **Next.js 16**, **Tailwind CSS v4**, and **Framer Motion**. Showcases 18+ years of QA engineering experience, AI-augmented automation frameworks, and open-source projects.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion 12 |
| Fonts | Inter (UI), JetBrains Mono (code) |
| Deployment | Vercel |

## Sections

- **Hero** — Name, title, photo, stats bar (18+ years, 6 AI platforms, 100% automation adoption, ~40% defect reduction, 3 enterprise frameworks)
- **About** — Bio with highlights grid of core skills
- **Projects** — 10 project cards with GitHub links and live demos:
  - QAE2E (Agentic Quality Engineering)
  - QA AI Dashboard
  - QA Interview Preparation Kit
  - QA RAG Platform
  - RAG Explorer
  - AI Test Architect (QA Copilot)
  - Resume Job RAG
  - 8-Layer Playwright Framework
  - Self-Healing Playwright Framework
  - QA Multi-Agent Assistant
- **Skills** — 6 category grids (Automation, AI/LLM, Vector DBs, Languages, CI/CD, Architecture)
- **Career** — Timeline with 4 roles (Coupa, Varian, TCS, Infosys) with bullet-point achievements
- **Education** — BE Computer Science, Modi Institute of Technology, Kota
- **Contact** — Phone, Email, LinkedIn, GitHub
- **Header** — Sticky nav with scroll-aware background, mobile hamburger menu

## Design

- **Theme:** Claude-inspired warm cream palette (`#faf7f5` background, `#d97706` amber accent, `#ede3da` borders)
- **Typography:** Inter for body, JetBrains Mono for code tags
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

## Tarun Bot (AI Chatbot)

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
