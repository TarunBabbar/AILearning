# Figma → Playwright Multi-Agent System: Implementation Plan

## 1. Problem Statement

Two problems, one shared pipeline foundation:

1. **Regression Validation (Pipeline A)** — For screens already built, continuously validate the live/staging UI against the Figma source of truth and flag visual/structural drift.
2. **Shift-Left Testing (Pipeline B)** — For screens still in design, generate test cases and Playwright automation *before* development finishes, so tests are ready to run the moment the screen ships.

Both pipelines feed into and extend your existing Playwright + TypeScript automation framework rather than replacing it.

## 2. Decisions Locked In

- **Build order**: both pipelines in parallel, thin end-to-end slice first (not one pipeline fully, then the other).
- **Figma access**: Figma access token already available (Dev Mode MCP server preferred over raw REST API).
- **App under test**: Web app only (no mobile/native complexity for v1).
- **Tooling**: Cursor + OpenRouter for LLM routing across agents.
- **Eval**: DeepEval for grading agent outputs (Python sidecar).

## 3. Agent Architecture — 6 Agents + 1 Rule-Based Orchestrator

| # | Agent | Input | Output | Shared by |
|---|-------|-------|--------|-----------|
| 1 | Design Extraction Agent | Figma file (via Dev Mode MCP) | `design-spec.json` per screen/component | A + B |
| 2 | Implementation Inspector Agent | Staging URL (Playwright crawl) | `impl-spec.json` (same shape as design spec) | A |
| 3 | Validation / Diff Agent | design-spec + impl-spec | Drift report (deterministic diff + LLM judgment on flagged deltas) | A |
| 4 | Test Case Generation Agent | design-spec (+ PRD/flow context) | Gherkin/YAML test cases → human approval gate | B |
| 5 | Automation Codegen Agent | Approved test cases | `.spec.ts` files (semantic locators, page objects) | B |
| 6 | Evaluation Agent (DeepEval) | Outputs of agents 3, 4, 5 | Faithfulness / hallucination / compile-check reports | A + B |
| — | Orchestrator (not an LLM) | All of the above | State machine + JSON/SQLite state store | A + B |

**Orchestrator states per screen:**
`design-only → tests-generated → tests-approved → automation-generated → pending-dev → dev-shipped → validated`

**v1 leanness option** (not chosen, noted for later): merge Agent 1+2 into a single dual-mode "extraction" agent, and merge 4+5 into a single "spec-to-code" agent, dropping to 4 agents. Recommendation: start with 6, split further only if a single agent's prompt gets bloated or accuracy degrades from doing two jobs.

## 4. Pipelines

### Pipeline A — Regression Validation
```
Figma (source of truth) → Design Extraction Agent → design-spec.json
Staging URL → Implementation Inspector Agent → impl-spec.json
design-spec.json + impl-spec.json → Validation/Diff Agent → Drift Report
Drift Report → Evaluation Agent → Eval Report
```

### Pipeline B — Shift-Left
```
Figma (not-yet-built screen) → Design Extraction Agent → design-spec.json
design-spec.json + PRD context → Test Case Gen Agent → test-cases.yaml (Gherkin/YAML)
→ Human review/approval gate →
Approved test cases → Automation Codegen Agent → *.spec.ts (semantic locators)
Status: pending-dev
On dev ship: re-run locator resolution against real DOM → status: dev-shipped → validated
```

## 5. Model Routing (via OpenRouter)

| Agent | Model tier | Rationale |
|---|---|---|
| Design Extraction | Small/cheap, often no LLM (parsing code) | Deterministic token/prop extraction from Figma MCP output |
| Implementation Inspector | Small/cheap, often no LLM | DOM/computed-style/a11y-tree capture is deterministic |
| Validation — deterministic layer | No LLM | pixelmatch/resemble.js + structural token diff |
| Validation — semantic judgment layer | Vision-capable (Claude/GPT-4o class) | Only called on flagged deltas — keeps spend low |
| Test Case Generation | Best reasoning model available | Highest-leverage, highest-risk step; human-approved before becoming code |
| Automation Codegen | Strong coding model, few-shot on your real framework files | Needs to match your existing conventions exactly |
| Evaluation (DeepEval) | Cheaper model | DeepEval's deterministic metrics do most of the work |

## 6. Repo Structure

```
/agents
  /design-extraction
  /impl-inspector
  /validation
  /test-case-gen
  /automation-codegen
  /evaluation        # Python sidecar, calls DeepEval, exposed over HTTP
  /orchestrator       # deterministic state machine, JSON/SQLite store
/specs                # design-spec.json + impl-spec.json per screen, versioned
/tests                # existing Playwright + TS framework
/reports              # drift reports, eval reports
/shared
  /schemas            # JSON schema for design-spec / impl-spec (single source of truth for shape)
  /prompts            # versioned prompt templates per agent
```

## 7. Implementation Plan — Thin Slice First, Both Pipelines in Parallel

The goal of Phase 0–1 is **one screen, fully through both pipelines end-to-end**, before scaling to your whole screen inventory. This validates the architecture cheaply before you sink time into edge cases.

### Phase 0 — Foundations (Week 1)
- Set up repo structure above.
- Define the shared `design-spec.json` / `impl-spec.json` JSON schema (this is the contract every agent depends on — get it right first).
- Set up Figma Dev Mode MCP connection in Cursor; confirm token scopes and test extraction on one real screen.
- Set up OpenRouter account/routing config; smoke-test one call per model tier.
- Stand up the orchestrator as a minimal state machine (SQLite) with the state list from Section 3, no agents wired yet.

### Phase 1 — Thin End-to-End Slice (Weeks 2–3)
Pick **one already-built screen** and **one not-yet-built screen**, run each fully through its pipeline:

- Build Agent 1 (Design Extraction) — get real `design-spec.json` out for both screens.
- Build Agent 2 (Implementation Inspector) — get real `impl-spec.json` for the built screen.
- Build Agent 3 (Validation/Diff), deterministic layer only first (pixel + token diff) — produce a real drift report. Add the LLM judgment layer once the deterministic layer works.
- Build Agent 4 (Test Case Gen) for the unbuilt screen — produce Gherkin/YAML, manually review quality before building the approval UI/flow.
- Build Agent 5 (Automation Codegen) — turn approved cases into `.spec.ts` matching your existing framework conventions; run it in CI once to confirm it compiles and executes.
- Wire the orchestrator to actually track both screens through their states.

**Exit criterion for Phase 1**: both screens reach a terminal state (`validated` for A, `pending-dev` or further for B) without manual glue code — everything driven by the state store.

### Phase 2 — Evaluation Layer (Week 4)
- Stand up the Python DeepEval sidecar service, expose via HTTP.
- Wire Agent 6 to grade: test-case faithfulness to design-spec, `.spec.ts` compile/run success, hallucinated locators/elements.
- Add eval reports to `/reports`, feed failures back as a blocking gate before an artifact moves state (e.g., a test case that fails faithfulness check shouldn't reach the human approval queue).

### Phase 3 — Human-in-the-Loop Approval UI (Week 5)
- Since Agent 4's output is the highest-risk step, build a lightweight review interface (could start as a CLI or simple web view over the state store) where a human approves/edits/rejects generated test cases before Agent 5 runs.
- Log approval/edit decisions — useful later for few-shotting or fine-tuning prompts.

### Phase 4 — Scale to Full Screen Inventory (Weeks 6+)
- Batch-run Agent 1 across the full Figma file / all relevant frames.
- Prioritize which existing screens go through Pipeline A first (e.g., highest-traffic or most recently changed).
- Set up scheduled/triggered runs: Pipeline A on a cadence (nightly/on staging deploy), Pipeline B triggered on new Figma frame publish.
- Add locator re-resolution step for Pipeline B: when a `pending-dev` screen ships, re-run Implementation Inspector on it and heal semantic locators against the real DOM.

### Phase 5 — Hardening
- Add retry/error handling per agent (LLM calls fail, Figma/staging can be flaky).
- Version prompts and specs so drift reports are diffable over time, not just point-in-time.
- Dashboard/report surface (can be simple markdown/HTML reports in `/reports` initially — no need to build a full UI for v1).

## 8. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hallucinated test cases | Human approval gate before codegen (Agent 4 → Agent 5 boundary) |
| False-positive drift flags (anti-aliasing, font hinting) | Two-layer validation: deterministic diff first, LLM judgment only on flagged deltas |
| Orchestrator making bad workflow decisions | Keep it 100% rule-based (state machine), never LLM-driven |
| Codegen not matching existing framework conventions | Few-shot Codegen agent with real files from your framework, not generic examples |
| Cost creep from LLM calls on every screen | Model routing table (Section 5) — cheap/no-LLM for deterministic steps, expensive models only where reasoning is genuinely needed |
| Schema drift between design-spec and impl-spec | Single shared JSON schema in `/shared/schemas`, both extraction agents validate against it |

## 9. Open Questions to Resolve Before/During Phase 0

- Which Playwright+TS framework conventions (page object pattern, fixture structure, naming) should Agent 5 be few-shotted on? (Point it at 2–3 of your best existing test files.)
- Where does the human approval UI live — CLI tool, internal web app, or PR-based (generated test cases as a PR for review)?
- What's the staging URL access pattern for Implementation Inspector (auth, environment stability)?
- Cadence for Pipeline A re-runs — per deploy, nightly, or on-demand?

## 10. Next Step

Once this plan is confirmed, implementation starts at **Phase 0**: repo scaffolding + shared JSON schema definition, since every other agent depends on that contract being right.