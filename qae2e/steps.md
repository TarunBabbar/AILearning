# QAE2E — Step-by-step walkthrough

> How to connect, where to start, what runs, and where everything is saved.
> `→` = next step. Statuses: ✅ works today · ⏳ planned.

---

## 1 · What you need before you start

- Node.js (18+) installed
- An **OpenRouter API key** → https://openrouter.ai/keys
- `npm install` done
- `.env` configured (see [README → Configuration](README.md#configuration))

```bash
npm install
cp .env.example .env   # then paste your OPENROUTER_API_KEY into .env
npm run dev            # app opens at http://localhost:3001 (may differ if port taken)
```

---

## 2 · The big picture (one flow)

```
Start
  │
  ▼
① Connect  ──▶ ② Analyze  ──▶ ③ Coverage  ──▶ ④ Automate  ──▶ ⑤ Execute  ──▶ ⑥ Release
 (source)       (RI agent)      (MT agent)      (AS agent)      (EX + DO)      (IQ agent)
```

Each step has an agent and a tool. Everything you create is saved locally in `data/artifacts.json`.

---

## 3 · Start here: open the workspace

```
http://localhost:3001          → Landing page (hero, flow, 6 agent cards, integrations)
   │
   ▼  click "Open the workspace" (header, hero, or CTA panel)
http://localhost:3001/workspace → The 6-step pipeline screen
```

You are now at **step ① Connect** — the requirement capture card.

---

## 4 · Step ① — Connect your source

**What it is:** the card titled **"1 · Connect your source"** at the top of the workspace.

**What to fill in:**

| Field | What to put |
|-------|-------------|
| **Requirement title** | e.g. "Login flow for web app" |
| **Source** (dropdown) | `Manual input` · `Jira` · `Confluence` · `Other` |
| **Ticket key** (optional) | e.g. `QA-123` (metadata only for now) |
| **Requirement text** (big box) | paste your requirement — or use the pre-filled sample |

> **About Jira / Confluence:** the dropdown + ticket-key field, plus the **Fetch from source** button,
> pass a source hint to the RI agent, which calls the matching fetch tool (`jira_fetch_issue` /
> `confluence_fetch_page` / `figma_fetch_file`) inside the pipeline when the matching connector is
> configured. With no connector configured, paste the requirement text directly and the pipeline still
> runs to local results.

**Then run the pipeline:**

1. Open the **Optional configuration** card (collapsible) and provide anything you have — source key/ID,
   GitHub repo + token, Jira project key, TestRail run ID, Docker image. **All optional**: skip it all
   and the pipeline still converts your requirement into full automation locally.
2. Click **"Run the 6-agent pipeline"** → runs the full chain RI → MT → AS → EX → DO → IQ on one
   `requirementId`, streaming every agent's activity. A banner shows which agent is running
   ("Agent 3/6: AS running…"); the stepper advances as each agent finishes.

Watch the **Agent activity** panel — each agent is an expandable card showing its tool call → result
pairs live, duration, artifact badges, final output, and any issues. Filter by Tools / Output / Errors,
expand all, or copy the whole log.

After AS generates scripts, the pipeline **runs them in local Docker** (your Docker must be running)
and **auto-fixes failures with the LLM** — watch for "Running generated tests in Docker…" /
"Tests passed after N attempt(s)" status lines. A **Run summary** card then shows every agent's
status, artifact counts, and any issues (e.g. Pinecone not configured, tests still failing).

---

## 5 · Step ② — Analyze (Requirement Intelligence Agent · RI)

The pipeline now runs **RI**, which:

1. saves the requirement (tool `requirement_save`)
2. reads it back (tool `requirement_analyze`)
3. writes a structured analysis: **summary, business rules, acceptance criteria, risks, edge cases,
   scenarios, test data, missing info**

**Where the output appears:** the **"Requirement Intelligence"** card under the activity stream.

**Where it is saved:** `data/artifacts.json` → `analyses[]` (linked by `requirementId`).

**What you can do:** read it — no editing needed here.

---

## 6 · Step ③ — Coverage (Manual Test Case Agent · MT)

**MT** drafts review-ready test cases (tool `coverage_save`):

- happy path, negative paths, boundary conditions
- each case: title, description, priority, test type, scenario type, steps `action → expected`

**Where the output appears:** the **"Manual Test Coverage"** card.

**Edit before it's final** (recommended):
```
Click a case          → expands steps
Click "Edit"          → edit description and each action/expected step
Changes save via PUT /api/artifacts (type=coverage) as you edit
```

**Where it is saved:** `data/artifacts.json` → `coverages[]` (linked by `requirementId`).

---

## 7 · Step ④ — Automate (Automation Script Agent · AS)

**AS** turns your coverage into **TypeScript + Playwright** UI automation specs (tool `script_save`).
This is the only supported stack — no Selenium/Cypress/API/mobile.

**Where the output appears:** the **"Automation Script"** card with file tabs.

**What you can do:**
- switch between generated files
- click **Copy** to take the code into your own repo/tooling

**Where it is saved:** `data/artifacts.json` → `scripts[]` (linked by `requirementId` + `coverageId`).

> **GitHub:** scripts are generated and stored locally. Use the **Check in & run** section (collapsed,
> at the end of the workspace) to read the repo framework, create a branch, commit the generated
> scripts, and dispatch a GitHub Actions workflow.

---

## 8 · Step ⑤ — Execute (Execution & Defect Agent · EX + DevOps Agent · DO)

**EX** records **real** test results onto the cycle:

- if the AS agent produced scripts, the pipeline **runs them in local Docker** (auto-fixing failures
  with the LLM, up to 3 attempts) and creates a real cycle with the actual pass/fail counts
- EX records those real executions (`execution_record`) and raises a Jira-style defect for every real
  failure (`defect_create`)
- if no Docker run happened, EX does **not** invent results — it reports "tests were not run"

**DO** links the real automated run evidence to the cycle using the real `cycleId` — it never fabricates
CI/build numbers or screenshots.

**Where it is saved:** `data/artifacts.json` → `cycles[]`, `executions[]` inside cycles, `defects[]`.

> **Real execution:** when scripts exist and Docker is running, the pipeline genuinely runs the tests
> and records the results. If Docker is off, scripts missing, or the LLM hits a rate limit, the pipeline
> stops or reports "tests not run" instead of showing fake results.

---

## 9 · Step ⑥ — Release (Quality Intelligence Agent · IQ)

**IQ** calls the `release_confidence` tool, which computes from real saved data:

```
coveragePercent = executed cases / total cases
passRate        = passed / executed
confidence      = coveragePercent × 0.4 + passRate × 0.4 + defect bonus
risk            = low (≥80) · medium (≥55) · high (<55)
```

**Where the output appears:**
- **right rail** → the **Release confidence** gauge (%, risk, coverage, pass rate, open defects)
- **below** → the **Release report** card (summary, findings, recommendations)

**Where it is saved:** `data/artifacts.json` → `releases[]`.

---

## 10 · MCP server — what's available & how to connect

The app runs a **real MCP server** at:

```
http://localhost:3001/api/mcp/sse   (default dev server port; adjust if yours differs)
```

**Clients that can connect:** Claude Code, MCP Inspector, any MCP client.

**Quick check with MCP Inspector:**

```bash
npx @modelcontextprotocol/inspector
# transport: Streamable HTTP, URL: http://localhost:3001/api/mcp/sse
```

**Or the included smoke script** (server must be running):

```bash
node scripts/mcp-smoke.mjs
```

### Tools exposed by the MCP server

| Tool | Used by | What it does |
|------|---------|--------------|
| `requirement_save` | RI | Capture a requirement → returns `requirementId` |
| `requirement_analyze` | RI, MT, AS | Load a stored requirement's content |
| `coverage_save` | MT | Save editable test cases (steps/priority/type) |
| `script_save` | AS | Save TypeScript + Playwright UI automation scripts |
| `cycle_create` | EX | Open a test cycle for a requirement |
| `execution_record` | EX, DO | Record pass/fail/blocked result with evidence |
| `defect_create` | EX, DO | Raise a Jira-style defect from a failed case |
| `release_confidence` | IQ | Compute confidence/risk from coverage + executions + defects |

All 8 tools use the **same handlers** as the web UI — call them from the workspace or from any MCP client.

---

## 11 · Where everything is saved (recap)

```
data/artifacts.json
├── requirements[]   ← step ①  (requirement_save)
├── analyses[]       ← step ②  (Requirement Intelligence)
├── coverages[]      ← step ③  (coverage_save, editable via UI)
├── scripts[]        ← step ④  (script_save)
├── cycles[]         ← step ⑤  (cycle_create + execution_record)
├── defects[]        ← step ⑤  (defect_create)
└── releases[]       ← step ⑥  (release_confidence)
```

Every artifact carries the shared `requirementId` — that's the **traceability chain** you see in the
right rail (Requirement → Analysis → Coverage → Automation → Execution → Defects → Release).

---

## 12 · Reading your data

| Want | API call |
|------|----------|
| All artifacts | `GET /api/artifacts` |
| One type | `GET /api/artifacts?type=coverage` |
| One item | `GET /api/artifacts?type=analysis&id=<id>` |
| One requirement's whole chain | `GET /api/artifacts?requirementId=<id>` |
| Edit an artifact (e.g. coverage) | `PUT /api/artifacts` `{type, id, payload}` |

---

## 13 · What's NOT wired yet (honest status)

- ⏳ Jenkins / CI trigger (DO simulates the pipeline; GitHub Actions dispatch is available via the
  GitHubCheckin panel — `github_dispatch_workflow`)
- ⏳ Real end-to-end validation with live connector credentials (Jira/Confluence/Zephyr/TestRail) —
  the connectors are implemented; the user's free accounts/trials + credentials are the remaining input

Everything else above works today. Note: Jira/Confluence live fetch, the GitHub connector
(read/branch/commit/dispatch), and the local Docker test runner are all **implemented** — they activate
when the matching credentials are configured (see README → Configuration).
