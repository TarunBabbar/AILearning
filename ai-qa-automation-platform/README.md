# AI QA Automation Platform

> **Status:** active development · **Last README update:** 2026-08-16

Multi-tenant SaaS platform that runs the **full STLC** (Software Testing Life Cycle) autonomously:
connect your **GitHub repo**, **Jira board**, and **database**; a team of AI agents analyzes
requirements, plans, designs, builds, executes, evaluates, reports defects, and gates releases —
with human review checkpoints and a CI webhook for release blocking.

```
┌────────────────────────────────────────────────────────────┐
│  WEB APP — Next.js 16 (App Router) + NextAuth + Tailwind    │
│  login · dashboard · generate · connections · review ·      │
│  runs · settings + API Route Handlers (/api/v1/*)           │
└───────────────────────────┬────────────────────────────────┘
                            │ Prisma + Neon Postgres
┌───────────────────────────▼────────────────────────────────┐
│  SAME-ORIGIN API (Next.js Route Handlers — Vercel-native)   │
│  connections · requirements · testcases · runs · webhooks   │
│  cron (nightly regression)                                  │
└───────────────────────────┬────────────────────────────────┘
                            │ direct REST (no MCP needed)
┌───────────────────────────▼────────────────────────────────┐
│  CONNECTORS — GitHub (Octokit) · Jira (REST) · Database     │
│  secrets: AES-256-GCM encrypted, per-workspace              │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│  AGENTS — Supervisor + 7 STLC phase agents (LLM-agnostic)   │
│  RequirementsAnalyst → TestPlanner → TestDesigner →         │
│  AutomationBuilder → Executor → DefectReporter → ReleaseGater│
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│  EXECUTION + EVAL — LLM-judge metrics · release gate        │
│  (hard/soft) → CI webhook → closed loop                     │
└────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Quick Start (local)](#quick-start-local)
- [Deploy to Vercel](#deploy-to-vercel)
- [Environment Variables](#environment-variables)
- [LLM Providers (swappable)](#llm-providers-swappable)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Agent Team](#agent-team)
- [STLC Coverage](#stlc-coverage)
- [Evaluation & Release Gate](#evaluation--release-gate)
- [CI Gate Webhook](#ci-gate-webhook)
- [Running Tests](#running-tests)
- [Changelog](#changelog)

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend + API | **Next.js 16.3** (App Router, Route Handlers), React 19 | Turbopack default, `proxy.ts` (was middleware) |
| Auth | **NextAuth v4** (JWT strategy) | Credentials + optional GitHub/Google OAuth |
| Database | **Postgres 16** (Neon serverless) + **Prisma** | All tables carry `workspaceId` |
| LLM | **OpenRouter** or **Command Code** (swappable) | Provider registry, switched via env |
| GitHub | **Octokit** (direct REST) | Read repo files, existing tests, PR diffs |
| Jira | **Atlassian REST** | Read stories/AC, create defect tickets |
| Eval | **LLM-judge metrics** (DeepEval-style) | 5 metrics, serverless-safe, fail-closed |
| Orchestration | **Vercel cron** | Nightly regression, manual runs in-request |
| Secrets | **AES-256-GCM** (env-derived key) | Per-workspace connection secrets |
| Hosting | **Vercel** | Next.js-native, no MCP/Temporal needed |

---

## Repository Layout

```
ai-qa-automation-platform/
├── apps/
│   └── web/                     # THE app — Next.js 16 (UI + API)
│       ├── app/
│       │   ├── (login, workspace/*)     # pages
│       │   ├── api/v1/*                # Route Handlers (same-origin API)
│       │   ├── api/cron/nightly        # Vercel cron (nightly regression)
│       │   └── api/auth/[...nextauth]  # NextAuth route
│       ├── components/          # Providers, shared UI
│       ├── lib/
│       │   ├── agents/          # supervisor + 7 phase agents (TS)
│       │   ├── connectors/      # github.ts (Octokit), jira.ts (REST)
│       │   ├── eval/            # LLM-judge metric wiring
│       │   ├── exec/            # run orchestrator (execute → eval → gate)
│       │   ├── generation/      # Analyst→Planner→Designer pipeline
│       │   ├── llm/             # provider registry (openrouter, command-code)
│       │   ├── auth.ts          # NextAuth options (Prisma-backed)
│       │   ├── auth-helpers.ts  # workspace-scoped route auth
│       │   ├── api.ts           # same-origin client
│       │   ├── db.ts            # Prisma singleton
│       │   └── secrets.ts       # AES-256-GCM encrypt/decrypt
│       ├── prisma/schema.prisma # workspace-scoped models
│       ├── proxy.ts             # Next 16 auth guard (was middleware.ts)
│       └── vercel.json          # cron config
├── apps/api/                    # (legacy FastAPI backend — not used on Vercel)
├── mcp-servers/                 # (legacy — not used on Vercel)
└── infra/                       # (legacy AWS — not used on Vercel)
```

---

## Quick Start (local)

**Prereqs:** Node 20.9+, Neon project (or local Postgres).

**1. Configure env** — `apps/web/.env.local` (copy from `.env.example`):

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=some-long-random-string
DATABASE_URL=postgresql://neondb_owner:XXX@ep-XXX.REGION.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=another-long-random-string
LLM_PROVIDER=openrouter
LLM_MODEL=openrouter/auto
LLM_API_KEY=sk-or-v1-...
CRON_SECRET=random-string-for-cron
```

**2. Push schema + run:**

```bash
cd apps/web
npx prisma db push          # creates all tables in Neon
npm install
npm run dev                 # http://localhost:3000
```

Sign in with any email → create requirements → Generate → approve in Review Queue → Run suite.

---

## Deploy to Vercel

**1. Push to GitHub**, then import the repo in Vercel:

- **Framework:** Next.js (auto-detected)
- **Root directory:** `apps/web`
- **Build command:** `npm run build`
- **Install command:** `npm install && npx prisma generate`

**2. Set env vars** (Vercel → Settings → Environment Variables):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | Random string |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `JWT_SECRET` | Random string (secret encryption key) |
| `LLM_PROVIDER` | `openrouter` |
| `LLM_MODEL` | e.g. `openrouter/auto` |
| `LLM_API_KEY` | OpenRouter key |
| `CRON_SECRET` | Random string for `/api/cron/nightly` guard |

**3. Deploy.** The nightly regression cron (`0 3 * * *` in `vercel.json`) runs automatically once the
cron feature is enabled on the Hobby/Pro plan.

---

## Environment Variables

> **Local** = `apps/web/.env.local` (loaded by `npm run dev`). **Vercel** = dashboard env vars.
> **Prisma CLI** reads `apps/web/.env` (not `.env.local`). Same `process.env.X` code path everywhere.

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | yes | App URL |
| `NEXTAUTH_SECRET` | yes | NextAuth signing |
| `DATABASE_URL` | yes | Postgres (Neon) — `+psycopg2` NOT needed for Prisma |
| `JWT_SECRET` | yes | AES-256-GCM key derivation for connection secrets |
| `LLM_PROVIDER` | yes | `openrouter` \| `command-code` |
| `LLM_MODEL` | no | Provider model id |
| `LLM_API_KEY` | yes* | OpenRouter key (*not for command-code) |
| `LLM_BASE_URL` | no | OpenRouter override |
| `CMDCODE_BIN` | no | command-code binary path (local only) |
| `CRON_SECRET` | yes | Guards `/api/cron/nightly` |
| `GITHUB_ID`/`GITHUB_SECRET` | no | GitHub OAuth |
| `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` | no | Google OAuth |

---

## LLM Providers (swappable)

All agents go through `lib/llm/client.ts` → active provider from `LLM_PROVIDER`.

| Provider | How it works | Requires |
|---|---|---|
| `openrouter` | OpenAI SDK → `https://openrouter.ai/api/v1` | `LLM_API_KEY`, `LLM_MODEL` |
| `command-code` | `cmdc -p` headless one-shot (local dev only) | `cmdc` on PATH |

**Adding a provider** = one class in `lib/llm/client.ts` + one registry entry. No other changes.

---

## Database Schema

Workspace-scoped (every row carries `workspaceId`) — the multi-tenant isolation invariant.
Managed by **Prisma** (`prisma/schema.prisma`), pushed via `npx prisma db push`.

| Model | Purpose |
|---|---|
| `User` / `Workspace` / `WorkspaceMember` | Auth + tenants + roles |
| `Connection` | GitHub/Jira/DB, AES-encrypted secrets |
| `Requirement` | Jira stories + AC + rubric + risk tier |
| `TestCase` | Drafts/approved, `source: ai-generated\|user-provided` |
| `CoverageMap` | Requirement ↔ test-case traceability |
| `Run` / `RunResult` | Run history + per-case outcome |
| `MetricScore` | Per-metric score vs threshold, hard/soft gate |
| `Trace` | Trace refs + artifact keys |
| `ReviewItem` | Closed-loop queue |
| `WorkspaceSettings` | Thresholds, risk tiers, gate policy |

---

## API Reference

All same-origin under `/api/v1` (server-rendered Route Handlers, no CORS).

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/connections` | List / create connectors (secrets encrypted) |
| `POST/DELETE` | `/connections/[id]` | Test connection / disconnect |
| `GET/POST` | `/requirements` | Jira stories + acceptance criteria |
| `POST` | `/requirements/generate` | Run agent pipeline → draft test cases |
| `GET/POST` | `/testcases` | List / upload user-provided tests |
| `POST` | `/testcases/[id]/review` | Approve / reject / edit |
| `POST` | `/runs` | Trigger suite run (execute → eval → gate) |
| `GET` | `/runs` | Run history |
| `GET` | `/runs/[runId]/metrics` | Per-metric scores |
| `GET` | `/webhooks/gate/[runId]` | CI gate status |
| `GET` | `/workspaces/[workspaceId]/settings` | Thresholds |
| `PUT` | `/workspaces/[workspaceId]/settings` | Update thresholds |
| `GET` | `/api/cron/nightly` | Vercel cron (CRON_SECRET-guarded) |

**Auth:** `requireAuth()` (server-side) validates the NextAuth session + workspace claim on every
route. No cross-workspace access.

---

## Agent Team

The **Supervisor** routes work across 7 STLC phase agents (TS, `lib/agents/`). Every agent returns
structured JSON via the active LLM provider.

| Agent | STLC Phase | Input → Output |
|---|---|---|
| `requirements_analyst` | Requirement Analysis | Jira stories → rubric + expected tools + checklist |
| `test_planner` | Test Planning | rubrics + coverage + settings → risk-tiered plan |
| `test_designer` | Test Case Design | plan + repo + existing tests → draft cases |
| `automation_builder` | Test Automation | approved cases → compiled suites |
| `executor` | Test Execution | suites + trigger → results + artifacts |
| `defect_reporter` | Defect Reporting | failures → Jira tickets (via Jira REST) |
| `release_gater` | Release Gate | scores vs thresholds → pass/block |

---

## Evaluation & Release Gate

Five LLM-judge metrics (DeepEval-style, serverless-safe), thresholds per-workspace:

| Metric | Type | Default |
|---|---|---|
| Answer Relevancy | soft | 0.8 |
| Groundedness | **hard** | 0.9 |
| Completeness | soft | 0.75 |
| Correctness | **hard** on high-risk | 0.85 |
| Tool Sequence Accuracy | **hard** | 0.9 |

- Hard-gate failure → release **blocked**.
- Thresholds snapshotted per run at trigger time.
- **Fail-closed:** no LLM key → deterministic tool-sequence fallback; broken LLM can't pass a release.

---

## CI Gate Webhook

External CI blocks on the gate:

```yaml
VERDICT=$(curl -sS "$URL/api/v1/webhooks/gate/$RUN_ID" -H "Authorization: Bearer $TOKEN")
test "$(echo $VERDICT | jq -r '.gate_verdict')" != "block"
```

---

## Running Tests

```bash
cd apps/web
npm run build    # type-checks + compiles everything
npm run lint
```

CI (`.github/workflows/ci.yml`) runs lint + build on every push/PR.

---

## Changelog

### 2026-08-16 — Vercel-native rewrite
- **Next.js-only**: FastAPI backend, MCP gateway, Temporal, AWS Terraform dropped from the hosted path (kept under `apps/api/`, `mcp-servers/`, `infra/` as legacy)
- **Prisma + Neon**: workspace-scoped schema, `prisma db push`, client singleton
- **Route Handlers** replace FastAPI: connections, requirements, testcases, runs, webhooks, settings
- **GitHub via Octokit** (direct REST), **Jira via REST** — no MCP servers
- **LLM-judge eval** replaces DeepEval (serverless-safe), fail-closed gate
- **Vercel cron** for nightly regression; `vercel.json` with `0 3 * * *`
- **Secrets**: AES-256-GCM (env-derived key) replaces KMS
- **Env**: `.env.local` for local dev, Vercel dashboard for prod — same `process.env` code path

### 2026-08-16 — Next.js 16 migration
- Next 16.3.1 + React 19.1, `middleware.ts` → `proxy.ts`, `eslint .` flat config

### 2026-08-16 — Initial build
- Full monorepo scaffold per spec (`ai-qa-automation-platform.md`)
