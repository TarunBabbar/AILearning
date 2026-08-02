# QAE2E — Agentic Quality Engineering

**AI-Powered Quality Engineering. From Requirement to Release Confidence.**

QAE2E is an **end-to-end agentic QA platform**:
From a **product requirement document** to **running the newly generated test cases** in a real DevOps
environment. A suite of specialist AI agents orchestrates the whole pipeline.

> **Status: ~90% of the end-to-end vision is built.** The core 6-agent pipeline, real OpenRouter agent
> loop (free models only), real MCP server, editable coverage, artifact persistence, **real source
> connectors (Jira, Confluence, Figma, GitHub, Zephyr, TestRail), a connector wizard UI, RAG-grounded
> test generation (Pinecone + free embedding), CSV/XLSX export, publish tools, GitHub check-in flow
> (read framework → create branch → commit → dispatch CI), local Docker test runner with JUnit result
> capture, and image → text vision extraction** all work today. Remaining: end-to-end validation with
> real credentials. See [Current status](#current-status-what-is-real-vs-planned) and the
> [Roadmap](#roadmap). The canonical state document is [`understanding.md`](./understanding.md).

---

## Table of contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [The 6 agents](#the-6-agents)
- [The MCP server & tools](#the-mcp-server--tools)
- [Where things are saved](#where-things-are-saved)
- [Current status: what is real vs. planned](#current-status-what-is-real-vs-planned)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)

---

## Highlights

- **6 specialist AI agents**, each with a focused role, tool access, and a live streaming activity log.
- **Real agent loop** — OpenRouter tool-calling (`tools` + `tool_calls`), JSON persistence, no SDK needed.
- **Real MCP server** — Streamable HTTP at `/api/mcp/sse`, exposing **22 QA tools** (8 core + 14 integration).
- **Real source connectors** — Jira, Confluence, Figma, GitHub, Zephyr, TestRail REST clients + a
  connector wizard in the UI that tells you exactly what credentials are required.
- **RAG-grounded test generation** — pull existing cases from Zephyr/TestRail, embed with a free local
  model, store in Pinecone (free serverless), and generate new cases that avoid duplicates.
- **Export & publish** — download generated test cases as CSV or XLSX; publish to Zephyr / TestRail.
- **Editable artifacts** — AI-drafted test cases and scripts you can review and edit before they persist.
- **Traceability by design** — every artifact links back to one `requirementId`.
- **Free models only** — a hard guard refuses any model without a `:free` suffix. No accidental spend.
- **Zero external DB required** — artifacts live in `data/artifacts.json` (in-memory fallback); Pinecone
  is optional and only used when you configure it.

## How it works

```
Requirement ──▶ AI Analysis ──▶ Test Coverage ──▶ Automation Scripts ──▶ Test Cycle ──▶ Release Confidence
   (source)        (RI)           (MT, editable)       (AS)             (EX + DO)        (IQ)
```

Run the **6-step pipeline** from the workspace:

1. **Connect** — pick a source: manual paste, Jira (by issue key), Confluence (by page ID), or Figma
   (by file key). The **Connectors** panel in the right rail shows which tools are configured and what
   credentials are missing. Before running, a **one-shot intake form** collects everything up front
   (GitHub repo/token, Jira project key, TestRail run ID, Docker image) — **all optional**; skip it all
   and the pipeline still runs end-to-end on local results.
2. **Analyze** — the Requirement Intelligence Agent (RI) extracts summary, business rules, acceptance
   criteria, risks, edge cases, scenarios, and test data.
3. **Coverage** — the Manual Test Case Agent (MT) drafts review-ready cases grounded in existing cases
   (RAG dedupe); edit steps, priority, and expected results before they're saved. Export as CSV/XLSX.
4. **Automate** — the Automation Script Agent (AS) writes framework-ready code (Playwright by default).
5. **Execute** — the Execution & Defect Agent (EX) records a controlled test cycle; failed cases become
   Jira-style defects. The DevOps Execution Agent (DO) simulates the CI/CD leg.
6. **Release** — the Quality Intelligence Agent (IQ) computes confidence, pass rate, coverage, risk.

As the pipeline runs, an **"Agent N/6 running"** banner shows which agent is live, and an **agent
workbench** streams each agent's tool call → result pairs live (with duration, artifact badges, and a
"working…" pulse). After the run, a **run summary** card shows every agent's status, artifact counts,
and highlighted issues. If the AS agent generates scripts, the pipeline **runs them in local Docker
and auto-fixes failures with the LLM** (up to 3 attempts), recording real pass/fail on a cycle. EX and
DO record **only real test results** — they never fabricate evidence, screenshots, or CI build numbers;
if no Docker run happened they report "tests were not run". If an agent errors (e.g. LLM rate limit)
the pipeline **stops** rather than continuing on bad input. GitHub check-in and the Docker runner live
in a collapsed **"Check in & run"** section at the end.

## The 6 agents

| Code | Agent | Step | What it does |
|------|-------|------|--------------|
| **RI** | Requirement Intelligence | Analyze | Reads a requirement (Jira/manual/Figma) → executive summary, business rules, AC, risks, edge cases, scenarios, test data. |
| **MT** | Manual Test Case | Coverage | Generates review-ready, editable manual test cases organized by product/module, grounded in existing cases via RAG. |
| **EX** | Execution & Defect | Execute | Records real test results (from the Docker run) on the cycle; raises Jira-style bugs for real failures. Never fabricates evidence — reports "tests were not run" if no real execution happened. |
| **AS** | Automation Script | Automate | Transforms approved coverage into TypeScript + Playwright UI automation scripts. |
| **DO** | DevOps Execution | Execute | Links real automated run evidence to the cycle using the real cycleId; never invents CI/build results. |
| **IQ** | Quality Intelligence | Release | Correlates manual + automated outcomes, defects, coverage → release readiness + where to act. |

## The MCP server & tools

The app ships a **real MCP server** (`@modelcontextprotocol/sdk`) over Streamable HTTP.

- **Endpoint:** `http://localhost:3001/api/mcp/sse` (default dev server port; adjust if yours differs)
- **Connect with:** Claude Code, MCP Inspector, or any MCP client.
- **Handlers:** the exact same tool handlers the web UI uses (`lib/agents/tools.ts`).

**Core tools (MCP-shaped: `{ name, description, inputSchema, handler }`):**

| Tool | Purpose |
|------|---------|
| `requirement_save` | Capture a requirement (manual/Jira/Confluence) → returns the traceability `requirementId`. |
| `requirement_analyze` | Load a stored requirement's content for AI analysis. |
| `coverage_save` | Persist a coverage document (editable manual test cases with steps/priority/type). |
| `script_save` | Persist TypeScript + Playwright UI automation scripts. |
| `cycle_create` | Open a test cycle for a requirement. |
| `execution_record` | Append/update a pass/fail/blocked execution with evidence on a cycle. |
| `defect_create` | Raise a Jira-style defect from a failed case (severity + evidence). |
| `release_confidence` | Compute release confidence from coverage + executions + open defects. |

**Integration tools (added in the Phase 1/2 build):**

| Tool | Purpose |
|------|---------|
| `connector_status` | List which connectors are configured / what credentials are missing. |
| `jira_fetch_issue` | Fetch a Jira issue (requirement) by key. |
| `confluence_fetch_page` | Fetch a Confluence page (document) by page ID. |
| `figma_fetch_file` | Fetch a Figma file's frames (design source for requirements). |
| `cases_export` | Export coverage to CSV or XLSX. |
| `zephyr_publish` | Publish test cases to Zephyr Scale. |
| `testrail_publish` | Publish test cases to TestRail. |
| `cases_index` | Pull existing cases from Zephyr/TestRail → embed → index into Pinecone (RAG). |
| `cases_search` | Search indexed cases for similar existing cases (dedupe before generation). |
| `github_read_repo` | Read a file or directory listing from a GitHub repo (existing automation framework). |
| `github_branch_create` | Create a new branch in a GitHub repo. |
| `github_commit_file` | Commit a file to a branch (create or update). |
| `github_dispatch_workflow` | Trigger a GitHub Actions workflow (workflow_dispatch) on a branch. |
| `image_extract` | Extract requirement text from an uploaded image via a free vision model. |
| `test_run_local` | Run the automation locally in Docker (clones repo if `repoUrl`), parse JUnit results, record on the cycle, sync to Jira/TestRail if configured. |
| `jira_create_defect` | Create a Jira defect (Bug) for a failed run. |
| `testrail_add_result` | Post a test result to a TestRail run. |

## Where things are saved

- **Store:** `data/artifacts.json` (gitignored). JSON file per artifact type; in-memory Maps fallback if the
  filesystem is read-only (e.g. serverless).
- **Run history:** every pipeline run (events, generated code, test results) is saved to **Vercel
  Postgres** (`qae2e_runs` table) when `POSTGRES_URL` is set, else `data/runs.json` locally. Downloadable
  as a ZIP from the Run history panel — retrievable even without a GitHub connection.
- **Traceability:** every artifact stores the shared `requirementId` → requirement → analysis → coverage →
  scripts → cycle/executions → defects → release report.
- **API:** `GET /api/artifacts` (list by type or by `requirementId`), `PUT /api/artifacts` (edit, e.g. edited
  coverage).
- **Exports:** `GET /api/export?coverageId=...&format=csv|xlsx` → downloadable file.
- **Connectors:** `GET /api/connectors` (status), `POST /api/connectors` (test / save credentials to `.env`).
- **RAG:** Pinecone free-serverless index (upsert/query) + free local embeddings — used only when
  `PINECONE_API_KEY` / `PINECONE_INDEX` are set.

## Current status: what is real vs. planned

**Built so far (~90% of the vision)**

- ✅ Web landing + workspace UI (Claude-like beige theme)
- ✅ Real OpenRouter agent loop with tool-calling (`:free` models only)
- ✅ 6-agent orchestrated pipeline (RI → MT → AS → EX → DO → IQ)
- ✅ Artifact persistence to `data/artifacts.json`, editable coverage, script viewer, release gauge
- ✅ Real MCP server exposing 26 tools at `/api/mcp/sse`
- ✅ Manual paste → AI analysis → editable coverage → generated scripts → simulated cycle/defects → release gauge
- ✅ **Connector layer** — Jira, Confluence, Figma, GitHub, Zephyr, TestRail REST clients (`lib/connectors/`)
- ✅ **Connector wizard UI** — `ConnectorsPanel` in the workspace right rail; shows configured/missing
  credentials, tests connections, saves to `.env`
- ✅ **RAG pipeline** — free local embeddings (transformers.js) + Pinecone free-serverless client; MT
  agent calls `cases_search` before generating (dedupe)
- ✅ **Export** — CSV/XLSX download from the coverage editor
- ✅ **Publish tools** — `zephyr_publish`, `testrail_publish` MCP tools
- ✅ **GitHub check-in flow** — read framework tree (`github_get_tree`), create branch, multi-file commit
  (git data API), dispatch workflow — plus `GitHubCheckin` UI component
- ✅ **Local Docker test runner** — `lib/exec/` runs the suite in a container, parses JUnit XML, records
  results on the cycle; **clones the repo automatically** if a `repoUrl` is given; `TestRunner` UI with
  live stream + pass/fail summary
- ✅ **Post-run sync** — failed runs raise a Jira defect (`jira_create_defect`), results post to TestRail
  (`testrail_add_result`) when `JIRA_PROJECT_KEY` / `TESTRAIL_RUN_ID` configured
- ✅ **Image → text extraction** — `/api/upload` + free vision model; `image_extract` tool + upload UI
- ✅ **AS agent framework-aware** — reads existing GitHub framework before generating scripts
- ✅ **TypeScript + Playwright only** — the supported stack is TypeScript + Playwright UI automation
  (no Selenium/Cypress/API/supertest/mobile); AS always generates Playwright `.spec.ts` files
- ✅ **Fetch from source in Connect step** — workspace can pull a Jira issue / Confluence page / Figma file
  directly into the requirement box; RI agent also gets source hint to fetch if content empty
- ✅ **Post-run sync config in UI** — TestRunner has Jira project key + TestRail run ID inputs
- ✅ **Example CI workflow** — `scripts/e2e-workflow.yml` (copy into repo at `.github/workflows/e2e.yml`)
- ✅ **Hardened JUnit parser** — multi-suite, errors, namespaced tags
- ✅ **Live `.env` reload** — `lib/config.ts` re-reads `.env` on every call (mtime-cached); edit `.env` and
  use new keys with NO server restart; no secrets hardcoded anywhere

**Remaining (validation only)**

| Capability | Status | What's needed |
|---|---|---|
| End-to-end validation with real credentials | ⏳ | User creates free accounts / free trials and provides creds; UI already prompts for them |
| JUnit parsing edge cases (exotic reporters) | ⏳ | Rare formats beyond Playwright/Jest JUnit XML |

**Complete end-to-end vision** (see [`understanding.md`](./understanding.md) for the full detail):
connect Jira/Confluence/Figma/manual → generate test cases grounded in existing cases (RAG) →
publish to Zephyr/TestRail or export CSV/XLSX → read the user's existing automation repo from GitHub →
generate + run the new tests locally → create a branch, check in, trigger a real DevOps run → post
results back.

**Credentials & decisions** (see [`understanding.md` → Decisions locked](./understanding.md#decisions-locked-user-answers)):

- "Sigma" is **Figma** (image/design source).
- **Zephyr Scale** (Jira plugin, own API) is the recommended default.
- Vector store: **Pinecone free serverless tier** (user provides key).
- Tests run in **local Docker** (user starts Docker; GitHub Actions/Jenkins optional later).
- The user has **no live credentials yet** — the UI prompts for exactly what each connector needs; free
  accounts / free trials will be used later for end-to-end testing.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment (see Configuration)
cp .env.example .env   # then add your OPENROUTER_API_KEY (required) and connector keys (optional)

# 3. Run the dev server
npm run dev            # http://localhost:3001 (Next.js may pick 3001 if 3000 is taken)
```

Open **http://localhost:3001** → landing page → **Open the workspace** → in the **Connectors** panel
(right rail) configure any external tools → paste a requirement (or connect Jira/Confluence/Figma) →
**Run the 6-agent pipeline**. Watch the live agent activity stream, edit coverage, export CSV/XLSX,
publish to Zephyr/TestRail, and see the release-confidence gauge.

**MCP smoke test** (requires the dev server running):

```bash
node scripts/mcp-smoke.mjs
```

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | — | **Required.** OpenRouter key for agent calls. |
| `LLM_MODEL` | `nvidia/nemotron-3-ultra-550b-a55b:free` | **Free model only.** A model without `:free` is refused at runtime. |
| `DATA_DIR` | `data` | Where artifacts persist (gitignored). |
| `NEXT_PUBLIC_APP_NAME` | `QAE2E Agentic Quality Engineering` | App name shown in UI/headers. |
| `JIRA_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` | — | Jira connector (Cloud). |
| `CONFLUENCE_URL` / `CONFLUENCE_EMAIL` / `CONFLUENCE_API_TOKEN` | — | Confluence connector (Cloud). |
| `FIGMA_TOKEN` | — | Figma connector (personal access token). |
| `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` | — | GitHub connector (fine-grained PAT). |
| `ZEPHYR_BASE_URL` / `ZEPHYR_TOKEN` / `ZEPHYR_PROJECT_KEY` | — | Zephyr Scale connector. |
| `TESTRAIL_URL` / `TESTRAIL_USER` / `TESTRAIL_API_KEY` | — | TestRail connector. |
| `PINECONE_API_KEY` / `PINECONE_INDEX` / `PINECONE_HOST` | — | Pinecone free-serverless RAG (optional). |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Free local embedding model (transformers.js). |
| `VISION_MODEL` | `google/gemma-4-26b-a4b-it:free` | **Free vision model** for image → text extraction. |
| `DOCKER_IMAGE` | `mcr.microsoft.com/playwright:v1.51.0-jammy` | Image for local Docker test runs. |

> **Free-models policy:** `lib/llm/openrouter.ts` hard-refuses any model that does not end in `:free`. You
> cannot accidentally spend money with a paid model. Verified tool-calling free models (probed 2026-08):
> `nvidia/nemotron-3-ultra-550b-a55b:free` (default, best for long test/script output),
> `openai/gpt-oss-20b:free`, `google/gemma-4-26b-a4b-it:free`, `inclusionai/ling-3.0-flash:free`,
> `cohere/north-mini-code:free`, `poolside/laguna-s-2.1:free`, `poolside/laguna-xs-2.1:free`,
> `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`. See `.env.example` for the full annotated list.

> **Credentials are surfaced, never hardcoded:** the Connectors panel shows exactly what each connector
> needs and lets you test + save to `.env` (gitignored). No secrets in the repo.

## Project structure

```
qae2e/
├── understanding.md                 # Canonical state doc (vision, what's built, what remains)
├── steps.md                         # Step-by-step walkthrough
├── app/
│   ├── page.tsx                     # Landing page
│   ├── workspace/page.tsx           # 6-step pipeline workspace (+ ConnectorsPanel in right rail)
│   └── api/
│       ├── agents/[agentId]/route.ts  # POST → NDJSON event stream per agent
│       ├── pipeline/route.ts          # POST → NDJSON full 6-agent run (one-click)
│       ├── artifacts/route.ts         # GET/PUT artifacts (JSON store)
│       ├── connectors/route.ts        # GET status / POST test / POST save (.env)
│       ├── export/route.ts            # GET CSV/XLSX download
│       ├── github/route.ts            # POST tree/read/create-branch/commit/dispatch
│       ├── run/route.ts               # POST streaming local Docker test run
│       ├── upload/route.ts            # POST image upload → vision text extraction
│       └── mcp/sse/route.ts           # Real MCP server (Streamable HTTP)
├── components/
│   ├── landing/                     # Hero, FlowSteps, AgentCards, Integrations, CtaPanel, Header
│   ├── workspace/                   # Stepper, AgentStream (agent workbench), AnalysisView,
│   │                                #   TestCasesEditor, ScriptView, ReleaseGauge, TraceabilityRail,
│   │                                #   ConnectorsPanel, PipelineSetup (intake), PipelineSummary,
│   │                                #   GitHubCheckin, TestRunner
│   └── ui/                          # Button, Card, Badge
├── lib/
│   ├── llm/openrouter.ts            # OpenRouter chat + tool-call loop primitives (free-only guard)
│   ├── connectors/                  # index.ts (defs/status), client.ts (REST clients)
│   ├── rag/                         # index.ts (free embeddings + Pinecone client)
│   ├── export/                      # index.ts (CSV + XLSX generation)
│   ├── exec/                        # index.ts (local Docker runner + JUnit parser),
│   │                                #   autofix.ts (LLM auto-fix failing tests, re-run loop)
│   ├── vision/                      # index.ts (image → text via free vision model)
│   ├── agents/                      # registry (6 agents), runner (tool loop),
│   │                                #   tools.ts (8 core), tools.integrations.ts (16 integration tools),
│   │                                #   persist.ts (shared artifact persistence),
│   │                                #   orchestrator (RI→MT→AS→EX→DO→IQ + autofix run)
│   ├── mcp/server.ts                # McpServer wired to the same tool handlers
│   ├── store.ts                     # JSON persistence + in-memory fallback
│   ├── types.ts                     # Shared artifact/agent/connector/event types
│   └── config.ts                    # Env config (OpenRouter + connectors + RAG + vision + Docker)
├── data/                            # gitignored artifacts.json
└── scripts/mcp-smoke.mjs            # MCP client smoke test
```

## Roadmap

**Phase 1 — Source connectors ✅ (built)**
- ✅ Jira connector (fetch issue by Jira ID, email + API token / OAuth)
- ✅ Confluence connector (fetch page by page ID, API token)
- ✅ Figma connector (pull design/requirement frames via REST token)
- ✅ Connector setup wizard in the UI (which tool → what creds are required → test connection → status chip)

**Phase 2 — Grounded test generation + publish/export ✅ (built)**
- ✅ RAG pipeline: pull existing cases from Zephyr/TestRail, embed with a free model, store in Pinecone
  free serverless, retrieve in the MT agent's prompt (`cases_index` / `cases_search`)
- ✅ Generate test cases by comparing against the existing corpus (no duplicates, no irrelevant cases)
- ✅ Publish to Zephyr / TestRail (`zephyr_publish` / `testrail_publish`)
- ✅ Export to CSV / XLSX (`/api/export` + coverage editor buttons)

**Phase 3 — GitHub check-in + local run ✅ (built)**
- ✅ GitHub connector: connect repo, read the existing automation framework (`github_read_repo` / `github_get_tree`)
- ✅ Generate new automation in that framework's style (AS agent reads framework first)
- ✅ Create a new branch (`github_branch_create`), commit multiple files (`github_commit_multiple` via git data API)
- ✅ `GitHubCheckin` UI: read framework → create branch → commit → dispatch CI
- ✅ No repo provided → AS agent falls back to standalone Playwright code

**Phase 4 — DevOps execution (local Docker) ✅ (built)**
- ✅ `lib/exec/` local Docker runner — user starts Docker; "Run tests" triggers the suite in a local container (auto-clones repo if `repoUrl`)
- ✅ Parse JUnit results, record pass/fail on the cycle, surface summary in `TestRunner` UI
- ✅ `github_dispatch_workflow` — trigger GitHub Actions (workflow_dispatch) on the branch
- ✅ Example workflow at `scripts/e2e-workflow.yml` (copy into repo as `.github/workflows/e2e.yml`)

**Phase 5 — Real credentials & end-to-end validation**
- User creates free accounts / free trials (Jira, Confluence, TestRail) and provides credentials
- The UI prompts for each connector's requirements and surfaces what's missing (already built)
- End-to-end verification of the full flow once credentials are in place
