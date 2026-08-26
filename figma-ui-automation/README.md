# Figma → Playwright Multi-Agent System

Two problems, one shared pipeline, six agents + a rule-based orchestrator:

- **Pipeline A — Regression Validation:** validate live/staging UI against Figma designs (source of truth), flag visual/structural drift.
- **Pipeline B — Shift-Left Testing:** for screens still in design, generate test cases + Playwright automation *before* dev finishes — tests are ready the moment the screen ships.

## Quickstart (no external keys needed)

```bash
npm install --include=dev   # --include=dev needed if your global npm config has `omit=dev`
npm run setup:sample        # register the two bundled sample screens
npm run pipeline:a -- --screen login --sample     # validate the "built" login screen
npm run pipeline:b -- --screen checkout --sample  # shift-left for the "unbuilt" checkout screen
npm run status              # orchestrator state per screen
npm run test                # unit tests (schema contract)
```

The sample mode runs every agent on bundled data — no Figma token, no OpenRouter key, no staging URL. The login screen ships with a simulated implementation "drift" so you can see a real drift report.

## Agents

| # | Agent | I/O | Model tier |
|---|-------|-----|-----------|
| 1 | Design Extraction | Figma (REST API primary; MCP/provider interface) → `design-spec.json` + screenshot | cheap/deterministic |
| 2 | Implementation Inspector | Staging URL (Playwright crawl) → `impl-spec.json` (same shape) | cheap/deterministic |
| 3 | Validation / Diff | both specs → drift report (pixel + token diff, then LLM vision on flagged deltas only) | no-LLM + vision |
| 4 | Test Case Generation | design-spec (+ PRD context) → Gherkin/YAML → **human approval gate** | best reasoning model |
| 5 | Automation Codegen | approved cases → `.spec.ts` (framework profile) → `tsc` gate | strong coding model |
| 6 | Evaluation | outputs of 3/4/5 → faithfulness/hallucination/drift-quality gate | cheap model (DeepEval sidecar) |
| — | Orchestrator | state machine + SQLite store + run log (never LLM-driven) | none |

Screen states: `design-only → design-extracted → impl-inspected → validated` (A) or `tests-generated → tests-approved → automation-generated → pending-dev → dev-shipped` (B), with `eval-failed` as a blocked state.

## Live mode

1. `cp .env.example .env` and fill in:
   - `OPENROUTER_API_KEY` — LLM brain for test-gen, codegen, vision judgment
   - `FIGMA_ACCESS_TOKEN`, `FIGMA_FILE_KEY` — design extraction
   - `STAGING_URL` — app under test for impl inspection
2. `npm run pipeline:a -- --screen <your-screen>` / `npm run pipeline:b -- --screen <your-screen>`

DeepEval sidecar (optional; the pipeline works without it via a deterministic mock judge):

```bash
cd agents/evaluation
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt                 # + pip install deepeval for real evals
uvicorn main:app --port 8010
# .env: DEEPEVAL_MODE=server
```

## CLI

```bash
npm run pipeline:a -- --screen login [--sample] [--skip-eval-gate]
npm run pipeline:b -- --screen checkout [--sample]
npm run extract-design -- --screen login      # agent 1 only
npm run inspect-impl -- --screen login        # agent 2 only
npm run validate -- --screen login            # agent 3 only
npm run generate-tests -- --screen checkout   # agent 4 only
npm run review-tests                          # approval gate (list / approve / approve-all)
npm run codegen -- --screen checkout          # agent 5 only
npm run eval                                  # agent 6 (DeepEval sidecar or mock)
npm run status                                # state + run log per screen
npm run test                                  # unit tests
npm run test:pw                               # Playwright (generated specs in tests/generated)
```

## Repository layout

```
agents/
  design-extraction/   # figma-client (REST), agent, sample-data
  impl-inspector/      # Playwright crawl → impl-spec
  validation/          # pixel diff (pixelmatch) + token diff + LLM judgment + HTML report
  test-case-gen/       # design-spec (+ PRD) → Gherkin/YAML
  automation-codegen/  # approved cases → .spec.ts
  evaluation/          # FastAPI DeepEval sidecar + TS client (mock fallback)
  orchestrator/        # state machine + SQLite store
  screens/<id>/        # PRD context per screen
shared/
  schemas/             # design-spec.schema.json + validator (the contract)
  types/               # TS types mirroring the schema
  lib/                 # config, logger, openrouter, models, state-store, fs
tests/                 # minimal Playwright framework + framework-profile.json + unit tests
specs/                 # design-spec.json / impl-spec.json / test-cases per screen, versioned
artifacts/ reports/ data/   # screenshots, drift reports, SQLite store
scripts/               # CLI entry points
```

## Framework profile (drop in your real Playwright framework)

`tests/framework-profile.json` describes the conventions the codegen agent targets (testDir, baseUrl, import source, POM/naming rules, example spec). When your real Playwright + TS framework is ready, point `exampleSpec` at your best 2–3 spec files and update `conventions` — generated tests will match your house style without code changes.
