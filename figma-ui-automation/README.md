# Figma → Playwright Multi-Agent System

A multi-agent pipeline that solves two problems with one shared foundation:

- **Pipeline A — Regression Validation:** for screens already built by the dev team, continuously validate the live/staging UI against the Figma design (source of truth) and flag visual/structural drift.
- **Pipeline B — Shift-Left Testing:** for screens still being designed/rolled out by the UX team, generate test cases and Playwright automation *before* development finishes — so tests are ready to run the moment the screen ships.

Both pipelines feed the same Playwright + TypeScript framework and are driven by **six LLM/rule-based agents + one deterministic orchestrator**.

> **Web dashboard (optional):** a Next.js 16 app in `webapp/` wraps the whole pipeline in a browser UI — beige/amber Claude-style left-nav, config editor (API keys / .env), run pipelines & agents with live progress, drift-report viewer, and test-case approval. It runs the existing CLI untouched; see [Web Dashboard](#web-dashboard).

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Quickstart — Sample Mode (no keys needed)](#quickstart--sample-mode-no-keys-needed)
5. [Live Mode](#live-mode)
6. [DeepEval Evaluation Sidecar](#deepeval-evaluation-sidecar)
7. [CLI Reference](#cli-reference)
8. [How It Works — Step by Step](#how-it-works--step-by-step)
9. [Human Approval Workflow](#human-approval-workflow)
10. [Adding a New Screen](#adding-a-new-screen)
11. [Customizing Codegen to Your Framework](#customizing-codegen-to-your-framework)
12. [Repository Layout](#repository-layout)
13. [Troubleshooting](#troubleshooting)

---

## Architecture

| # | Agent | Input | Output | Model tier |
|---|-------|-------|--------|-----------|
| 1 | **Design Extraction** | Figma file (REST API primary, MCP/provider interface) | `design-spec.json` + rendered screenshot | cheap/deterministic |
| 2 | **Implementation Inspector** | Staging URL (Playwright crawl) | `impl-spec.json` (same schema shape) + locators | cheap/deterministic |
| 3 | **Validation / Diff** | design-spec + impl-spec | Drift report: pixel diff + structural token diff, **LLM vision judgment only on flagged deltas** | no-LLM + vision |
| 4 | **Test Case Generation** | design-spec (+ PRD context) | Gherkin/YAML test cases → **human approval gate** | best reasoning model |
| 5 | **Automation Codegen** | Approved test cases | `.spec.ts` files (framework profile) → `tsc` gate | strong coding model |
| 6 | **Evaluation** | Outputs of agents 3/4/5 | Faithfulness / hallucination / drift-quality reports | cheap model (DeepEval sidecar) |
| — | **Orchestrator** | All of the above | SQLite state machine + run log (never LLM-driven) | none |

**Screen states** (tracked in `data/orchestrator.db`):

```
Pipeline A: design-only → design-extracted → impl-inspected → validated
Pipeline B: design-only → design-extracted → tests-generated → tests-approved
            → automation-generated → pending-dev → dev-shipped
Blocked:    eval-failed (any gate failure)
```

**Quality gates baked in** (this is how "test cases, validation, and automation stay in place"):

1. **Schema gate** — every spec must validate against `shared/schemas/design-spec.schema.json` before the next agent runs.
2. **Eval gate** — Agent 6 scores faithfulness/hallucination (Pipeline B) and drift-report quality (Pipeline A); a failing score blocks state advancement (unless `DRY_RUN=true`).
3. **Human approval gate** — no generated test case becomes code without review (`scripts/review.ts`).
4. **Compile gate** — codegen output must pass `tsc --noEmit`.

---

## Prerequisites

- **Node.js ≥ 20** (tested on 22.x)
- **npm** (with `--include=dev` if your global config sets `omit=dev`)
- **Playwright browsers** (`npx playwright install chromium`)
- Optional: **Python 3.10+** for the DeepEval sidecar
- Optional: **Figma personal access token**, **OpenRouter API key**, **staging URL** for live mode

---

## Installation

```bash
cd figma-ui-automation
npm install --include=dev     # --include=dev needed if global npm config has `omit=dev`
npx playwright install chromium   # one-time browser download
```

Verify the install:

```bash
npm run typecheck     # tsc --noEmit — must print nothing
npm run test          # 4 schema-contract unit tests — must all pass
```

---

## Quickstart — Sample Mode (no keys needed)

Sample mode runs **every agent on bundled data** — no Figma token, no OpenRouter key, no staging URL. Two bundled screens are included:

- `login` — treated as **already built** → runs Pipeline A (regression validation)
- `checkout` — treated as **still in design** → runs Pipeline B (shift-left)

The login screen ships with a simulated implementation "drift" so you can see a real drift report.

### Step 1 — Register the sample screens

```bash
npm run setup:sample
```

Expected output:

```
[setup:sample] registered screen "login" (design-only)
[setup:sample] registered screen "checkout" (design-only)
Sample screens registered. Next:
  npm run pipeline:a -- --screen login --sample
  npm run pipeline:b -- --screen checkout --sample
  npm run status
```

### Step 2 — Run Pipeline A (validate the "built" login screen)

```bash
npm run pipeline:a -- --screen login --sample
```

Expected output ends with:

```
[PIPELINE A] "login" validated. Verdict: drift (4 deltas). Report: .../reports/drift/login-<timestamp>.html
```

The 4 deltas are the simulated drift: a changed sub-header text, a shifted sign-in button (x/y), and a pixel-level difference. Open the generated **HTML drift report** in a browser — it shows the summary stats, delta table, and design/impl screenshots.

### Step 3 — Run Pipeline B (shift-left for the "unbuilt" checkout screen)

```bash
npm run pipeline:b -- --screen checkout --sample
```

Expected output shows the full shift-left flow:

```
[test-case-gen] wrote .../specs/tests/checkout.tests.yaml (2 cases via fallback-rules)
[REVIEW GATE] 2 test cases generated for "checkout" — 0 approved, 2 pending.
[automation-codegen] wrote .../tests/generated/checkout.spec.ts (provider: template)
Status: pending-dev — tests ready to run the moment the screen ships.
```

(In sample mode with default `DRY_RUN=true`, the approval gate auto-approves so the pipeline reaches `pending-dev`.)

### Step 4 — Inspect state

```bash
npm run status
```

Shows each screen, its state, and the run log:

```
login                validated              login
  · evaluation           success  drift eval pass (0.8)
  · validation           success  verdict=drift deltas=4
  · impl-inspector       success  provider=sample elements=7
  · design-extraction    success  provider=sample elements=7
checkout             pending-dev            checkout
  · automation-codegen   success  provider=template
  · evaluation           success  faithfulness warn (0.767)
  · test-case-gen        success  2 cases via fallback-rules
  · design-extraction    success
```

### Step 5 — View the generated spec

```bash
type tests\generated\checkout.spec.ts      # Windows
cat tests/generated/checkout.spec.ts       # macOS/Linux
```

You'll see a real Playwright spec using `getByLabel()` and `text=` locators derived from the design spec — ready to run once the screen ships.

---

## Live Mode

Live mode hits real Figma, real OpenRouter models, and your real staging app.

### Step 1 — Configure `.env`

```bash
copy .env.example .env     # Windows
cp .env.example .env       # macOS/Linux
```

Fill in:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | LLM brain for test-case generation, codegen, vision judgment |
| `FIGMA_ACCESS_TOKEN` | Figma REST API token (needs access to your design files) |
| `FIGMA_FILE_KEY` | The key from your Figma file URL (`figma.com/file/<FILE_KEY>/...`) |
| `STAGING_URL` | Base URL of the app under test |
| `MODE` | `live` (default) or `sample` |
| `DRY_RUN` | `true` (default) auto-approves gates so you can see the full flow; set `false` to enforce gates strictly |
| `DEEPEVAL_MODE` | `mock` (default) or `server` (see [DeepEval section](#deepeval-evaluation-sidecar)) |

### Step 2 — Design extraction expects frames named `frame-<screenId>`

The Design Extraction agent fetches the Figma node `frame-<screenId>` from your file. Either:

- name your Figma frame exactly `frame-login`, `frame-checkout`, etc., **or**
- change the node lookup in `agents/design-extraction/agent.ts` (`getNode(fileKey, 'frame-' + screenId)`).

### Step 3 — Run the pipelines

```bash
# Validate an existing built screen against its Figma design
npm run pipeline:a -- --screen login

# Shift-left: generate tests for a screen that is still in design
npm run pipeline:b -- --screen checkout
```

Model routing (which OpenRouter model each agent uses) lives in `agents/model-routing.json` — edit to taste:

```json
{
  "designExtraction": "google/gemini-2.5-flash-lite",
  "implInspection": "google/gemini-2.5-flash-lite",
  "validationVision": "anthropic/claude-3.5-sonnet",
  "testCaseGen": "anthropic/claude-3.5-sonnet",
  "automationCodegen": "anthropic/claude-3.5-sonnet",
  "evaluation": "google/gemini-2.5-flash-lite"
}
```

---

## DeepEval Evaluation Sidecar

Agent 6 (Evaluation) has two backends:

- **Mock judge (default)** — deterministic, no Python. Works out of the box.
- **DeepEval sidecar** — real faithfulness/hallucination metrics from `deepeval`, exposed over HTTP.

### Set up the sidecar

```bash
cd agents/evaluation
python -m venv .venv
.\.venv\Scripts\activate        # Windows
source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
pip install deepeval            # optional but recommended for real evals
```

### Start it

```bash
npm run eval-server             # uvicorn on http://127.0.0.1:8010
```

Verify: `curl http://127.0.0.1:8010/health` → `{"status":"ok","deepeval":"available"}`

### Point the pipeline at it

In `.env`:

```
DEEPEVAL_MODE=server
DEEPEVAL_URL=http://127.0.0.1:8010
```

Without `deepeval` installed, the sidecar falls back to a heuristic judge (same JSON contract), so the pipeline keeps working either way.

---

## CLI Reference

| Command | What it does |
|---------|--------------|
| `npm run pipeline:a -- --screen <id> [--sample] [--skip-eval-gate]` | Full regression-validation pipeline (agents 1→2→3→6) |
| `npm run pipeline:b -- --screen <id> [--sample] [--skip-eval-gate]` | Full shift-left pipeline (agents 1→4→6→approval→5) |
| `npm run extract-design -- --screen <id> [--sample]` | Agent 1 only → `specs/design/<id>.design-spec.json` |
| `npm run inspect-impl -- --screen <id> [--sample]` | Agent 2 only → `specs/impl/<id>.impl-spec.json` |
| `npm run validate -- --screen <id>` | Agent 3 only (needs both specs on disk) → HTML drift report |
| `npm run generate-tests -- --screen <id> [--sample]` | Agent 4 only → `specs/tests/<id>.tests.yaml` |
| `npm run review-tests` | Approval gate UI (see below) |
| `npm run codegen -- --screen <id>` | Agent 5 only → `tests/generated/<id>.spec.ts` |
| `npm run eval` | Agent 6 smoke test (calls the eval backend) |
| `npm run status` | Screen states + run log |
| `npm run screens` | List registered screens |
| `npm run test` | Unit tests (schema contract) |
| `npm run test:pw` | Run Playwright specs in `tests/generated` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup:sample` | Register the bundled sample screens |
| `npm run eval-server` | Start the DeepEval sidecar |

**Flags:**

- `--sample` — run the agent on bundled data instead of live services
- `--skip-eval-gate` — bypass the Agent 6 gate (useful while iterating on prompts)

---

## How It Works — Step by Step

### Pipeline A (Regression Validation)

```
Figma (REST API) ──Agent 1──▶ design-spec.json + design.png
Staging URL      ──Agent 2──▶ impl-spec.json + impl.png (Playwright crawl)
Both specs       ──Agent 3──▶ Drift report (pixel diff + token diff + LLM judgment on flagged deltas)
Drift report     ──Agent 6──▶ Eval gate (report quality) → HTML report in reports/drift/
                              └─ pass → state: validated
```

1. **Agent 1** pulls the frame from Figma, flattens elements (type, role, text, bounds, styles, a11y) into `design-spec.json`, and renders a screenshot.
2. **Agent 2** crawls `STAGING_URL` with Playwright, reads the same element attributes from the live DOM, and emits `impl-spec.json` in the **same schema shape** — plus locators for later codegen.
3. **Agent 3** diffs structurally (layout x/y/w/h, text, styles, a11y labels, missing/extra elements) and via pixelmatch (masked regions excluded). Only if deltas are flagged does it spend LLM vision tokens to judge whether they're real drift or false positives.
4. **Agent 6** grades the report; a pass advances the screen to `validated`.

### Pipeline B (Shift-Left)

```
Figma           ──Agent 1──▶ design-spec.json
design-spec     ──Agent 4──▶ test-cases.yaml (Gherkin)  [+ PRD context from agents/screens/<id>/context.md]
test cases      ──Agent 6──▶ faithfulness/hallucination gate
approved cases  ──Human────▶ approval gate (scripts/review.ts)
approved cases  ──Agent 5──▶ .spec.ts (framework profile) → tsc gate
                 ──▶ state: pending-dev
When dev ships  ──Agent 2──▶ re-crawl → heal locators against real DOM → dev-shipped → validated
```

1. **Agent 1** extracts the design spec (same as Pipeline A).
2. **Agent 4** generates Gherkin/YAML test cases from the design spec + optional PRD context (drop a `context.md` in `agents/screens/<screenId>/`).
3. **Agent 6** checks faithfulness (do the cases reference only real elements?) — a failing score blocks approval.
4. **Human approval** — review/edit/reject before anything becomes code.
5. **Agent 5** turns approved cases into `.spec.ts` matching `tests/framework-profile.json`, gated by `tsc --noEmit`.
6. The screen sits at `pending-dev`; when development ships, re-run the Implementation Inspector to heal locators against the real DOM.

---

## Human Approval Workflow

Generated test cases are the highest-risk output, so they must be reviewed before codegen.

```bash
# List all generated cases (optionally for one screen)
npm run review-tests -- list checkout

# Approve one case
npm run review-tests -- approve checkout checkout-tc-1

# Approve every pending case for a screen
npm run review-tests -- approve-all checkout

# Check approval status
npm run review-tests -- status checkout
```

Review decisions (`approved` / `rejected` / `edited` + notes) are persisted into the YAML and logged to the SQLite store — this history is future few-shot/fine-tuning fodder for the codegen prompts.

After approval, re-run the pipeline:

```bash
npm run pipeline:b -- --screen checkout --sample
```

It will now take the `tests-approved` path and generate code.

---

## Adding a New Screen

1. **Name a Figma frame** `frame-<screenId>` (e.g. `frame-signup`), or adjust the lookup in the design-extraction agent.
2. **Register the screen**:

   ```bash
   npm run pipeline:a -- --screen signup     # registers + runs Pipeline A
   # or register only:
   node --experimental-strip-types scripts/setup-sample.ts   # for sample screens
   ```

   (Any pipeline run auto-registers a missing screen in the state store.)
3. **For shift-left** (Pipeline B), optionally add PRD context: create `agents/screens/signup/context.md` with acceptance criteria and flow notes — Agent 4 uses it.
4. **Run the pipeline** and iterate on the generated test cases at the review gate.

---

## Customizing Codegen to Your Framework

`tests/framework-profile.json` describes the conventions Agent 5 targets:

```json
{
  "testDir": "./tests/generated",
  "baseUrl": "http://localhost:3000",
  "importFrom": "@playwright/test",
  "use": { "headless": true, "viewport": { "width": 1440, "height": 900 } },
  "conventions": {
    "pageObjects": true,
    "testNaming": "kebab-case",
    "dataTestId": "[data-testid]",
    "assertions": "@playwright/test expect",
    "exampleSpec": "tests/examples/example.spec.ts"
  }
}
```

When your real Playwright + TypeScript framework is ready:

1. Drop your best 2–3 spec files into `tests/examples/`.
2. Point `exampleSpec` at them and update `conventions` (POM layout, fixtures, naming).
3. Generated specs will match your house style — **no code changes needed**.

The LLM codegen prompt (in `agents/automation-codegen/agent.ts`) injects this profile + the element locators; if no OpenRouter key is present, a deterministic template generator produces a valid spec instead.

---

## Web Dashboard

A **Next.js 16 web application** in `webapp/` that wraps the entire pipeline in a browser UI — **without modifying any existing pipeline file**. It spawns the existing CLI as a child process, reads the existing SQLite store and artifacts, and writes `.env` for you.

### Setup

```bash
cd webapp
npm install --include=dev
npm run dev        # http://localhost:3000
```

For production: `npm run build && npm run start`.

### Tabs (beige/amber Claude theme, left nav)

| Tab | What it does |
|-----|--------------|
| **Dashboard** | Registered screens + state chips + quick Run A / Run B |
| **Validation (A)** | Pick a screen → run Pipeline A with live SSE log → browse/embed drift reports |
| **Shift-Left (B)** | Pick a screen → run Pipeline B → see generated test-case files |
| **Test Review** | Approve / reject / approve-all generated test cases (persisted to YAML) |
| **Agents** | Run any single agent (design / inspect / validate / testgen / codegen / eval) |
| **Runs** | Run history from the orchestrator state store |
| **Reports** | Drift reports (iframe preview) + generated `.spec.ts` source |
| **Settings** | `.env` editor (OpenRouter key, Figma token/file key, staging URL, mode, DRY_RUN, DeepEval) + pipeline health |

### How it works

- `/api/run` spawns `node --experimental-strip-types scripts/run-pipeline.ts <a|b> --screen <id> [--sample]` with the repo root as cwd — identical behavior to the CLI.
- `/api/run/stream` streams the CLI stdout to the browser via SSE for live progress.
- All state/artifacts are read from the existing `data/orchestrator.db`, `specs/`, `reports/`, `tests/generated/`.
- Settings saves to the repo-root `.env` (gitignored); values take effect on the next run.

---

## Repository Layout

```
figma-ui-automation/
├── webapp/                  # Next.js 16 dashboard (optional, additive — see Web Dashboard)
├── package.json  tsconfig.json  .env.example  .gitignore  README.md
├── agents/
│   ├── orchestrator/        # SQLite state machine + run log (never LLM-driven)
│   ├── design-extraction/   # Figma REST client + provider interface + sample data
│   ├── impl-inspector/      # Playwright crawl → impl-spec
│   ├── validation/          # pixel diff (pixelmatch) + token diff + LLM judgment + HTML report
│   ├── test-case-gen/       # design-spec (+ PRD context) → Gherkin/YAML
│   ├── automation-codegen/  # approved cases → .spec.ts (framework profile)
│   ├── evaluation/          # FastAPI DeepEval sidecar + TS client (mock fallback)
│   ├── screens/<id>/        # PRD context markdown per screen
│   └── model-routing.json   # OpenRouter model per agent
├── shared/
│   ├── schemas/             # design-spec.schema.json + validator (the contract)
│   ├── types/               # TS types mirroring the schema (+ pixelmatch types)
│   └── lib/                 # config, logger, openrouter client, models, state-store, fs
├── tests/                   # Playwright scaffold, framework-profile.json, unit tests
│   ├── examples/            # example specs the codegen few-shots on
│   └── generated/           # codegen output (gitignored)
├── specs/                   # design-spec / impl-spec / test-cases per screen (versioned)
├── scripts/                 # CLI entry points
├── artifacts/               # screenshots + pixel diffs (gitignored)
├── reports/                 # drift + eval reports (gitignored)
└── data/                    # SQLite state store (gitignored)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm install` doesn't install `typescript` / dev deps | Your global npm config has `omit=dev`. Run `npm install --include=dev`. |
| `OPENROUTER_API_KEY is not set` / `FIGMA_ACCESS_TOKEN is not set` | You're in live mode without keys — add them to `.env` or pass `--sample`. |
| `No sample spec for screen "X"` | Only `login` and `checkout` have sample data. Use one of those, or add your own to `agents/design-extraction/sample-data.ts`. |
| `Illegal transition ... → design-extracted` | The state machine blocks some re-runs. Transitions already allow re-runs from `validated`, `pending-dev`, `dev-shipped`, `eval-failed`. If you hit a genuinely blocked path, the screen state may need a manual reset in the DB or register it fresh. |
| Vision judgment skipped in the drift report | LLM judgment only runs when `OPENROUTER_API_KEY` is set **and** `DRY_RUN=false`. |
| `credential-manager-core is not a git command` | Harmless Git credential-helper warning on Windows; the push still succeeds. |
| `deepeval: missing` in sidecar health | `deepeval` isn't installed in the venv; the sidecar uses the heuristic fallback — the pipeline still works. |
| Generated spec fails `tsc` | In live mode with `DRY_RUN=false` the compile gate blocks advancement; regenerate after fixing the framework profile or the locator map. |
| Reports/artifacts show old timestamps | Every run writes a timestamped HTML report; the newest is the latest. |
| `pipeline:a` on a screen that's already `validated` | Re-runs are allowed (`validated → design-extracted`); it re-extracts and re-validates. |
