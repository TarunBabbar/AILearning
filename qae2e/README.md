# QAE2E — Agentic Quality Engineering

**AI-Powered Quality Engineering. From Requirement to Release Confidence.**

QAE2E is an **end-to-end agentic QA platform**. Paste a requirement and six specialist AI agents
orchestrate the whole pipeline: analyze → test coverage → Playwright automation → execution →
release confidence. Every stage is verified by an **in-app AI evaluation judge** (precision/accuracy/
completeness) and re-runs with feedback until the output matches the requirement.

> **Current scope: copy-pasted requirements only.** MCP connector integrations (Jira, Confluence,
> GitHub, Zephyr, TestRail, Pinecone) are placeholders — external connections are coming soon. The
> official DeepEval framework integration is tracked as work-in-progress; stage evaluation runs on a
> free in-app LLM judge today (see [AI Evaluation](#ai-evaluation-llm-judge)).

---

## Table of contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [The 6 agents](#the-6-agents)
- [AI Evaluation (LLM judge)](#ai-evaluation-llm-judge)
- [Live logs & pipeline trace](#live-logs--pipeline-trace)
- [The MCP server & tools](#the-mcp-server--tools)
- [Where things are saved](#where-things-are-saved)
- [Running tests (local Docker / remote runner)](#running-tests-local-docker--remote-runner)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)

---

## Highlights

- **6 specialist AI agents**, each with a focused role, tool access, and live streaming logs.
- **Real agent loop** — OpenRouter tool-calling (`tools` + `tool_calls`), JSON persistence, no SDK needed.
- **AI Evaluation at every stage** — an in-app LLM judge (free `EVAL_MODEL`) scores each agent's output
  against the previous stage's ask: **precision** (correct & relevant output), **accuracy** (nothing
  missed), plus **completeness**, hallucinated/missed counts, per-item verdicts, and judge confidence.
- **Eval-driven retry loop** — if a stage scores below threshold, the judge's feedback is fed back to the
  agent and it re-runs (up to 2 retries) until it matches the requirement.
- **Live pipeline trace + terminal-style live logs** — every stage, tool call, artifact, and evaluation
  score streamed to the UI in real time with an app-themed, auto-scrolling log.
- **Server-side Playwright POM** — AS builds a full runnable suite under `tests/` from coverage via
  `automation_framework_generate` (free LLMs truncate huge `script_save` payloads; quality gates reject
  empty/`{` stubs; orchestrator retries AS then falls back to deterministic scripts).
- **Local Docker test runner** — runs the generated Playwright suite in a container (auto-pulls the
  image, preflights node/npm/Chromium), parses Playwright JSON results, LLM auto-fix on failure.
- **Remote Docker runner** — point `TEST_RUNNER_URL` at any machine with Docker (your dev box, a VPS)
  so Vercel (no Docker) can still run real Playwright suites.
- **Traceability by design** — every artifact links back to one `requirementId`.
- **Stoppable pipeline** — Stop stays active until the NDJSON stream fully ends.
- **Free models only** — a hard guard refuses any model without a `:free` suffix. No accidental spend.
- **Neon/Postgres-backed persistence** — users, sessions, workspaces, artifacts, evaluations, and run
  history live in serverless Postgres (Neon); local dev falls back to `data/db.json`.

## How it works

```
Requirement ──▶ AI Analysis ──▶ Test Coverage ──▶ Automation Scripts ──▶ Test Cycle ──▶ Release Confidence
   (pasted)       (RI)            (MT, editable)        (AS)             (EX + DO)        (IQ)
                   │                 │                    │                 │                │
                AI Eval ◀───────── AI Eval ◀─────────── AI Eval ◀──────── AI Eval ◀─────── AI Eval
              (retry w/ feedback if score < 60%)
```

Run the **6-step pipeline** from the workspace:

1. **Connect** — paste a requirement (copy-paste only; the source selector and MCP connector fetch
   flows were removed). The **MCP connections** card in the right rail shows which connectors are
   "coming soon".
2. **Analyze** — the Requirement Intelligence Agent (RI) loads the pre-saved requirement via
   `requirement_analyze` and extracts summary, business rules, acceptance criteria, risks, edge cases,
   scenarios, and test data.
3. **Coverage** — the Manual Test Case Agent (MT) drafts review-ready manual test cases
   (`requirement_analyze` → `coverage_save`); edit steps, priority, and expected results before they're
   saved. Export as CSV/XLSX.
4. **Automate** — the Automation Script Agent (AS) loads coverage (`coverage_get`), then calls
   `automation_framework_generate` to persist a **complete Playwright + TypeScript POM** (pages,
   fixtures, specs, config) under `tests/e2e`, `tests/pages`, `tests/fixtures`, `tests/utils`.
5. **Execute** — after AS, the orchestrator **materializes scripts and runs them** (local Docker or the
   remote runner; autofix up to 3 attempts). EX records those real results on a cycle; failures become
   defects. DO links real automated evidence — never invents CI/build numbers.
6. **Release** — the Quality Intelligence Agent (IQ) computes confidence, pass rate, coverage, risk.
   The release gauge explains **why** the confidence score is what it is (coverage 40% + pass rate 40% +
   defects 20%) and what to do to reach 100%.

After each agent finishes, **AI Evaluation** scores its output. Below-threshold scores re-run the agent
with the judge's feedback (visible in the logs and trace). The **live log** shows everything happening:
agent start/finish, tools called, artifacts saved, evaluation scores, and retries.

## The 6 agents

| Code | Agent | Step | What it does |
|------|-------|------|--------------|
| **RI** | Requirement Intelligence | Analyze | Loads the pasted requirement → executive summary, business rules, AC, risks, edge cases, scenarios, test data. |
| **MT** | Manual Test Case | Coverage | Generates review-ready, editable manual test cases from the analysis. |
| **AS** | Automation Script | Automate | Builds TypeScript + Playwright POM via `automation_framework_generate` (server-side from coverage). Retries + deterministic fallback if the LLM skips tools. |
| **EX** | Execution & Defect | Execute | Records real test results on the cycle; raises defects for real failures. Never fabricates evidence — reports "tests were not run" if no real execution happened. |
| **DO** | DevOps Execution | Execute | Links real automated run evidence to the cycle using the real cycleId; never invents CI/build results. |
| **IQ** | Quality Intelligence | Release | Correlates manual + automated outcomes, defects, coverage → release readiness + where to act. |

## AI Evaluation (LLM judge)

> Honest framing: this is **not** the DeepEval Python framework. It is an in-app, TypeScript
> re-implementation of the same G-Eval/custom-judge approach, powered by a **free OpenRouter model**
> (`EVAL_MODEL`). The official DeepEval framework requires a Python runtime and is planned as a
> separate evaluation service (see [Roadmap](#roadmap)).

Each stage is scored against the previous stage's ask:

| Stage | Input (what was asked) | Output (what was delivered) |
|-------|------------------------|-----------------------------|
| Analyze | The requirement text | RI's analysis (rules, AC, risks, edge cases…) |
| Coverage | The analysis | MT's manual test cases |
| Automate | The coverage | AS's Playwright files |
| Execute | Real cycle/test results | EX/DO's executions + defects |
| Release | All artifacts | IQ's release report |

**Metrics produced** (per stage):

- **Precision (0-100)** — of everything the agent produced, how much is correct/grounded (no hallucination, nothing off-topic).
- **Accuracy (0-100)** — of everything the requirement asked for, how much was actually delivered (omissions lower this).
- **Completeness** — share of judged items that fully passed.
- **Hallucinated count** — output items that were made up / off-topic.
- **Missed asks** — requirement points not fully delivered.
- **Judge confidence** — how sure the judge is of its scores.
- **Per-item verdicts** — pass/fail/partial with reasons (expandable in the UI).
- **Overall + improvements** — plain-language explanation and actionable ways to raise the score.

**Retry loop:** if precision OR accuracy < 60%, the agent is re-run (up to 2 times) with the judge's
feedback injected into its prompt. The re-run, the feedback, and the final score are all visible in the
live log and pipeline trace.

**Fallback:** if the judge model is unavailable (free provider down / no API key), a deterministic
lexical-overlap score is used so the pipeline never blocks.

## Live logs & pipeline trace

- **Live logs** (right rail) — an app-themed, auto-scrolling feed of everything happening: agent
  start/finish, tools called (in plain language, e.g. "Read requirement", "Save test coverage"),
  artifacts saved, evaluation scores, retries, and test-run results. No GUIDs or raw JSON — user-facing
  summaries only. Pause / jump-to-latest / copy controls included.
- **Pipeline trace** (left column) — every stage with its status (Queued / Working / Completed /
  Stopped / Failed), the tools it called, artifacts it produced, and the interleaved **AI Evaluation**
  row showing the live score (P.. · A..) or "Scoring…" state. Re-runs show "Re-running with AI
  evaluation feedback (attempt 1/2)…".
- **Status banner** — one banner shows either the running agent ("Agent 1/6: RI — Requirement
  Intelligence Agent running…") or the evaluator ("AI Evaluation — checking the analyze output against
  the requirement…"). Never both.

## The MCP server & tools

The app ships a **real MCP server** (`@modelcontextprotocol/sdk`) over Streamable HTTP.

- **Endpoint:** `http://localhost:3001/api/mcp/sse` (default dev server port; adjust if yours differs)
- **Connect with:** Claude Code, MCP Inspector, or any MCP client.
- **Handlers:** the exact same tool handlers the web UI uses (`lib/agents/tools.ts` + integrations).

**Core tools (MCP-shaped: `{ name, description, inputSchema, handler }`):**

| Tool | Purpose |
|------|---------|
| `requirement_save` | Capture a requirement → returns the traceability `requirementId`. |
| `requirement_analyze` | Load a stored requirement's content for AI analysis. |
| `coverage_save` | Persist a coverage document (manual test cases with steps/priority/type). |
| `coverage_get` | Load the latest saved coverage for a requirement (falls back to the latest if the id is dropped). |
| `automation_framework_generate` | **Preferred.** Build a complete Playwright + TS POM **server-side** from coverage. |
| `script_save` | Optional low-level file save; rejects truncated/empty/config-only payloads. |
| `cycle_create` | Open a test cycle for a requirement. |
| `execution_record` | Append/update a pass/fail/blocked execution with evidence on a cycle. |
| `defect_create` | Raise a defect from a failed case (severity + evidence). |
| `release_confidence` | Compute release confidence from coverage + executions + open defects. |

**Integration tools** — connector-backed tools (Jira/Confluence/Figma/GitHub/Zephyr/TestRail/Pinecone
RAG) are **MCP placeholders**: they keep the MCP shape so the surface is stable, but return a
`NOTE: MCP connector "X" is not connected yet…` string without any network call. Still real
(no external credentials): `cases_export`, `api_test_generate`, `image_extract`, `test_run_local`.

## Where things are saved

- **Database:** all persistence lives in **Neon (serverless Postgres)** via `@vercel/postgres` when
  `POSTGRES_URL` (or `DATABASE_URL`) is set — `users`, `sessions`, `workspaces`, `artifacts`
  (requirements, analyses, coverages, scripts, cycles, defects, releases, **evaluations**), and
  `qae2e_runs` (run history). Tables are created automatically on first use.
- **Local dev without a DB:** everything falls back to `data/db.json` + `data/runs.json`.
- **Traceability:** every artifact stores the shared `requirementId` → requirement → analysis →
  coverage → scripts → cycle/executions → defects → release report → evaluations.
- **API:** `GET /api/artifacts?workspaceId=...&requirementId=...` returns the full artifact bundle
  (including evaluations); `PUT /api/artifacts` edits (e.g. coverage); `GET /api/export?coverageId=...&format=csv|xlsx` downloads exports.

## Running tests (local Docker / remote runner)

### Local Docker

The pipeline (and the **Run tests** button in the workspace) runs the generated Playwright suite in a
**local Docker container** using `mcr.microsoft.com/playwright:v1.51.0-jammy`. The runner handles
everything needed to make the tests actually execute:

1. **Docker** — if the Docker engine is not running, a clear "Start Docker Desktop, then retry" error.
2. **Image** — auto-pulls the configured image when missing.
3. **Preflight** — verifies node/npm, runs `npm install` when `node_modules` is missing, installs
   `playwright install chromium` when the browser is missing.
4. **Test command** — defaults to `npm test || npx --yes playwright@1.51.0 test --project=chromium`
   (override with `TEST_COMMAND`). Results parsed from Playwright's JSON reporter.
5. **Auto-fix** — failing tests are passed to the free LLM (up to 3 attempts) to fix locators/assertions
   and re-run.

### Remote Docker runner (for Vercel / machines without Docker)

Vercel has no Docker daemon, so real test execution needs a machine that does. Run the bundled
standalone runner on any Docker-capable host and point the app at it:

```bash
# On your Docker machine (dev box / VPS / home server):
node scripts/remote-runner.mjs 8787 <optional-token>
```

Then in the app env:

```
TEST_RUNNER_URL=http://<your-ip>:8787/run
TEST_RUNNER_TOKEN=<same token, optional>
```

The app POSTs the full suite (files + command) to the runner; it materializes, runs in Docker, and
returns the same normalized result (summary, failures, results). When unset, the local Docker path is
used; when neither is available, the execution agents report "no real test execution available".

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment (see Configuration)
cp .env.example .env   # add OPENROUTER_API_KEY (required) + EVAL_MODEL, POSTGRES_URL, etc.

# 3. Run the dev server
npm run dev            # http://localhost:3001 (Next.js may pick 3001 if 3000 is taken)
```

Open **http://localhost:3001** → landing page → **Get started / Sign in** → create an account → create
a workspace → open it → the requirement is pre-filled with a SauceDemo login sample (or paste your own)
→ **Run pipeline**. Watch the live logs + pipeline trace, edit coverage, export CSV/XLSX, and see the
release-confidence gauge with its "why this score" breakdown and per-stage AI evaluation cards.

### User accounts & workspaces

- **Auth:** self-contained email + password (scrypt-hashed, httpOnly session cookie). `/signup`,
  `/login`, `/workspaces` dashboard, Sign out in the header.
- **Workspaces:** personal (single-owner). Every artifact, run, and evaluation is scoped to the
  workspace you're in.
- **Persistence:** Neon Postgres when `POSTGRES_URL` is configured; otherwise `data/db.json` locally.

### Hosting on Vercel

- Import the repo, set **Root Directory** to `qae2e` (Next.js preset auto-detected).
- Add env vars in **Project → Settings → Environment Variables**: `OPENROUTER_API_KEY`, `EVAL_MODEL`
  (optional), `POSTGRES_URL` (your Neon connection string — tables auto-create), and optionally
  `TEST_RUNNER_URL`/`TEST_RUNNER_TOKEN` for real test execution.
- Hobby plan caps serverless functions at **300s** — routes already respect this (`maxDuration = 300`).

**MCP smoke test** (requires the dev server running):

```bash
node scripts/mcp-smoke.mjs
```

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | — | **Required.** OpenRouter key for agent calls. |
| `LLM_MODEL` | `nvidia/nemotron-3-ultra-550b-a55b:free` | **Free model only.** A model without `:free` is refused at runtime. |
| `EVAL_MODEL` | `nvidia/nemotron-3-ultra-550b-a55b:free` | **Free model only.** AI Evaluation judge (scores each stage). |
| `VISION_MODEL` | `google/gemma-4-26b-a4b-it:free` | **Free vision model** for image → text extraction. |
| `DATA_DIR` | `data` | Where the dev JSON fallback persists (`data/db.json`). |
| `NEXT_PUBLIC_APP_NAME` | `QAE2E Agentic Quality Engineering` | App name shown in UI/headers. |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL, sent as the OpenRouter HTTP-Referer (optional). |
| `POSTGRES_URL` (or `DATABASE_URL`) | — | **Neon/Postgres** connection. When set, all data lives in Postgres; otherwise dev JSON fallback. |
| `DOCKER_IMAGE` | `mcr.microsoft.com/playwright:v1.51.0-jammy` | Image for Docker test runs (auto-pulled when missing). |
| `TEST_COMMAND` | `npm test \|\| npx --yes playwright@1.51.0 test --project=chromium` | Command run inside the container **after** preflight. |
| `TEST_RUNNER_URL` | — | Remote Docker runner endpoint (e.g. `http://192.168.1.50:8787/run`). When set, suites POST here instead of running docker locally. |
| `TEST_RUNNER_TOKEN` | — | Optional bearer token shared with the remote runner. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Optional OpenRouter base URL override. |

> **Free-models policy:** `lib/llm/openrouter.ts` hard-refuses any model that does not end in `:free`.
> You cannot accidentally spend money with a paid model. Verified tool-calling free models (probed
> 2026-08): `nvidia/nemotron-3-ultra-550b-a55b:free` (default), `openai/gpt-oss-20b:free`,
> `google/gemma-4-26b-a4b-it:free`, `inclusionai/ling-3.0-flash:free`, `cohere/north-mini-code:free`,
> `poolside/laguna-s-2.1:free`. See `.env.example` for the full annotated list.

> **Removed with the MCP-placeholder refactor** (no longer present): connector REST clients
> (`lib/connectors/client.ts`, `test.ts`), encrypted secrets storage (`lib/secrets/`), Pinecone RAG
> (`lib/rag/`), webhook notifications (`lib/notify/`), the legacy connector routes, the GitHub check-in
> API/UI, and the scheduled cron route. The `.env` is intentionally minimal — no connector credentials.

## Project structure

```
qae2e/
├── app/
│   ├── page.tsx                       # Landing page
│   ├── login/page.tsx, signup/page.tsx  # Auth pages
│   ├── workspaces/page.tsx            # Workspace dashboard (create / list / open)
│   ├── history/page.tsx               # User-scoped run history (with eval score chips)
│   ├── workspace/page.tsx             # Suspense wrapper → WorkspaceClient.tsx (pipeline UI)
│   ├── settings/page.tsx              # Settings (Integrations tab → MCP/DeepEval placeholders)
│   └── api/
│       ├── agents/[agentId]/route.ts    # POST → NDJSON event stream per agent
│       ├── pipeline/route.ts            # POST → NDJSON full 6-agent run (one-click)
│       ├── artifacts/route.ts           # GET/PUT artifacts (workspace-scoped, incl. evaluations)
│       ├── auth/{signup,login,logout,me}/route.ts  # Session auth
│       ├── workspaces/route.ts          # GET list / POST create
│       ├── export/route.ts              # GET CSV/XLSX download
│       ├── run/route.ts                 # POST streaming local/remote Docker test run
│       ├── upload/route.ts              # POST image upload → vision text extraction
│       └── mcp/sse/route.ts             # Real MCP server (Streamable HTTP)
├── components/
│   ├── landing/                       # Hero, FlowSteps, AgentCards, Integrations, CtaPanel, Header
│   ├── workspace/                     # Stepper, LiveLogs (terminal feed), PipelineTrace (stages +
│   │                                  #   eval rows), PipelineSummary, AnalysisView, TestCasesEditor,
│   │                                  #   ScriptView, ReleaseGauge (why-this-score breakdown),
│   │                                  #   TraceabilityRail, McpConnectionsCard, EvaluationCard,
│   │                                  #   TestRunner, TestRunReport
│   ├── settings/                      # IntegrationsTab (MCP + DeepEval WIP placeholders)
│   └── ui/                            # Button, Card, Badge
├── lib/
│   ├── llm/openrouter.ts              # OpenRouter chat + tool-call primitives (free-only guard)
│   ├── eval/                          # metrics.ts (stage rubrics + judge prompt + fallback),
│   │                                  #   run.ts (judge call, metrics derivation, persistence)
│   ├── connectors/                    # registry.ts (defs), index.ts (placeholder status), defs.ts
│   ├── export/                        # index.ts (CSV + XLSX generation)
│   ├── exec/                          # index.ts (Docker runner + Playwright JSON parser + remote
│   │                                  #   dispatch), remote.ts (remote runner client),
│   │                                  #   autofix.ts (materialize + LLM auto-fix loop),
│   │                                  #   fallback-scripts.ts (server-side POM from coverage),
│   │                                  #   script-quality.ts (reject truncated/empty scripts),
│   │                                  #   api-scripts.ts (OpenAPI contract tests)
│   ├── vision/                        # index.ts (image → text via free vision model)
│   ├── agents/                        # registry (6 agents), runner (tool loop + nudges),
│   │                                  #   tools.ts (core tools), tools.integrations.ts (MCP
│   │                                  #   placeholder integration tools), prompts/playwright-pom.ts,
│   │                                  #   persist.ts, orchestrator (chain + AI eval retry loop)
│   ├── auth/                          # password.ts (scrypt), session.ts (httpOnly cookie), guard.ts
│   ├── db.ts                          # Postgres layer (users/sessions/workspaces/artifacts/runs) +
│   │                                  #   data/db.json fallback
│   ├── runs/store.ts                  # Run history (Postgres or data/runs.json)
│   ├── mcp/server.ts                  # McpServer wired to the same tool handlers
│   ├── store.ts                       # async workspace-scoped artifact store (withWorkspace context)
│   ├── types.ts                       # Shared artifact/agent/event/evaluation types
│   ├── utils.ts                       # cn() + awaitable readNdjsonStream (Stop stays until done)
│   └── config.ts                      # Env config (LLM + eval + vision + DB + Docker + remote runner)
├── scripts/remote-runner.mjs          # Standalone remote Docker runner (for Vercel/self-host)
├── scripts/mcp-smoke.mjs              # MCP client smoke test
├── data/                              # gitignored dev fallback (db.json, runs.json)
└── .env.example                       # Minimal env template (no connector creds)
```

## Roadmap

**Phase 1 — Core pipeline ✅ (built)**
- ✅ Copy-paste requirement → 6-agent pipeline (RI → MT → AS → EX → DO → IQ)
- ✅ OpenRouter tool-calling loop (free models only), server-side POM generation, local Docker run
- ✅ Editable coverage, CSV/XLSX export, release-confidence gauge
- ✅ User accounts, workspaces, Neon Postgres persistence, run history

**Phase 2 — AI Evaluation ✅ (built)**
- ✅ Per-stage LLM judge: precision / accuracy / completeness / hallucinated / missed / judge confidence
- ✅ Per-item verdicts + "how to improve" guidance
- ✅ Eval-driven retry loop (agent re-runs with judge feedback until ≥60%)
- ✅ Live logs + pipeline trace showing evaluation state and scores in real time
- ✅ Release gauge "why this score" breakdown (coverage 40% + pass rate 40% + defects 20%)

**Phase 3 — Real DeepEval framework (work in progress)**
- Official DeepEval framework (G-Eval, Faithfulness, Answer Relevancy, Hallucination) requires a Python
  runtime — planned as a separate evaluation service that the pipeline calls as a remote evaluator.
- Placeholder card in Settings → Integrations tracks this.

**Phase 4 — MCP connectors (coming soon)**
- Real connections for Jira, Confluence, GitHub, Zephyr, TestRail, Pinecone RAG — the tool surface is
  already in place (placeholders); wiring real clients only means replacing handler bodies.

**Phase 5 — Remote test execution**
- ✅ Remote Docker runner (`scripts/remote-runner.mjs` + `TEST_RUNNER_URL`)
- ⏳ CI/CD integration (GitHub Actions dispatch, Jenkins) as an alternative execution backend
