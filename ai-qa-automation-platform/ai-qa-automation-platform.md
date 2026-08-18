# Master Build Prompt: AI-Powered QA Automation Platform (Web-Based, MCP-Connected, DeepEval-Driven)

> Use this document as a single prompt to an AI coding agent (Claude Code, Cursor, etc.) to scaffold
> the entire platform. This is a **multi-tenant web application** — users log in, connect their own
> GitHub repo, Jira board, and database, and the platform generates, runs, and evaluates tests using
> their real requirements, code, and data.

---

## 1. Mission Statement

Build a web-based SaaS platform where any QA team can:

1. Sign up and create a workspace.
2. Connect their **GitHub repo**, **Jira board**, and **database(s)** via secure, saved connections.
3. Optionally upload/point at their **existing test suite** so the platform learns their patterns
   instead of generating tests from scratch.
4. Let the platform read Jira user stories + the GitHub repo (code + existing tests) to generate new
   UI, API, DB, and Integration test cases.
5. Run those tests automatically, score them with DeepEval, and see results in a dashboard.
6. Gate releases based on configurable thresholds, with failures feeding back into the test suite.

---

## 2. Core Principles

1. **Bring-your-own-everything** — the platform holds no application code or data itself; it connects
   out to the user's GitHub, Jira, and DB via read-scoped credentials the user provides and controls.
2. **Per-user, per-workspace isolation** — every connection, dataset, and generated test belongs to a
   workspace. No cross-tenant data access, ever.
3. **MCP as the connector standard** — all third-party integrations (GitHub, Jira, DB, and future ones)
   are implemented as MCP servers/clients, not one-off REST integrations. This makes adding a new
   connector (Slack, Linear, Confluence, a new DB type) a config addition, not a rewrite.
4. **Learn from what the user already has** — existing test cases, if provided, are treated as
   ground-truth pattern examples, not replaced. The platform extends coverage, it doesn't discard work.
5. **Every eval is a graded score with a configurable gate**, not a binary pass/fail.
6. **Full traceability** — every generated test case is traceable back to the Jira ticket / code diff /
   existing test it was derived from, so QA can audit *why* a test exists.

---

## 3. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  WEB APP (Frontend)                                                    │
│  - Auth / workspace management                                         │
│  - Connector settings UI (GitHub, Jira, DB — connect/disconnect)       │
│  - Existing test case upload/import                                    │
│  - Test case review queue (approve AI-generated cases)                 │
│  - Run dashboard + trace viewer + release gate status                  │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │
┌───────────────────────────────▼────────────────────────────────────────┐
│  BACKEND API (workspace-scoped)                                        │
│  - Auth service, workspace/user settings store (encrypted secrets)     │
│  - Connector orchestration (invokes MCP clients per connected tool)    │
│  - Job queue trigger (generation jobs, execution jobs)                 │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │
┌───────────────────────────────▼────────────────────────────────────────┐
│  MCP CONNECTOR LAYER                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────────┐ │
│  │ GitHub MCP     │  │ Jira MCP      │  │ Database MCP               │ │
│  │ server         │  │ server        │  │ server (Postgres/MySQL/    │ │
│  │ (repo, code,   │  │ (user stories,│  │  Mongo — schema + safe     │ │
│  │  existing tests│  │  acceptance   │  │  read-only queries)        │ │
│  │  in-repo)      │  │  criteria)    │  │                            │ │
│  └───────────────┘  └───────────────┘  └────────────────────────────┘ │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │  (requirements + code + schema + existing tests)
┌───────────────────────────────▼────────────────────────────────────────┐
│  TEST GENERATION ENGINE (AI)                                           │
│  - Jira story → rubric + acceptance criteria extraction                │
│  - GitHub repo → endpoint/UI-flow/tool discovery + existing test       │
│    pattern learning (style, naming, assertion conventions)             │
│  - DB schema → data-integrity assertion generation                     │
│  - Output: draft test cases → human review queue → approved dataset    │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │
┌───────────────────────────────▼────────────────────────────────────────┐
│  EXECUTION LAYER (worker pool)                                         │
│  UI: Playwright   API: pytest+httpx   DB: pytest+SQLAlchemy            │
│  Integration: pytest+Testcontainers   AI flows: app under test         │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │  (traces: request/response/DOM/DB diff/tool calls)
┌───────────────────────────────▼────────────────────────────────────────┐
│  EVALUATION LAYER (DeepEval + custom)                                  │
│  Answer Relevancy | Groundedness | Tool Sequence Accuracy (custom) |   │
│  Completeness | Correctness | DB integrity checks                      │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │
┌───────────────────────────────▼────────────────────────────────────────┐
│  OBSERVABILITY + DASHBOARD                                             │
│  Traces → Langfuse   Results → workspace dashboard   Gate → CI hook    │
└───────────────────────────────┬────────────────────────────────────────┘
                                  │  (failures + low scores)
                                  └──────► back into review queue / dataset
                                            (closed loop, per workspace)
```

---

## 4. Connector Layer — MCP-based

Each connector is a distinct MCP server the user authorizes from the settings page. Store only
encrypted, scoped tokens — never raw passwords.

| Connector | What it reads | Auth method | Scope |
|---|---|---|---|
| **GitHub** | Repo structure, source code, existing test files, PR diffs | GitHub App install or OAuth (read-only) | Specific repo(s) the user selects, not org-wide by default |
| **Jira** | User stories, acceptance criteria, linked tickets, status | Atlassian OAuth (read-only) | Specific board(s)/project(s) the user selects |
| **Database** | Schema, table relationships; **read-only** query execution for assertions | User-provided read-only connection string, stored encrypted (KMS-backed) | Never write access; queries run through a safe, parameterized query layer |

**User Settings requirements:**
- Each workspace has a **Connections** page: Connect GitHub / Connect Jira / Connect Database, each
  showing status (connected/expired) and a disconnect option.
- Credentials are stored per-workspace, encrypted at rest (e.g., AES-256 with a KMS-managed key),
  never logged, never exposed to other workspaces.
- Token refresh handled automatically; if a connector token expires, the platform surfaces a
  reconnect prompt rather than silently failing.

---

## 5. Existing Test Case Ingestion

Since the user already has test cases in many cases, the platform must **learn from them, not ignore them**:

1. User either connects the GitHub repo (platform auto-discovers `tests/`, `spec/`, `e2e/` style
   folders) or manually uploads a test file/export (CSV, Excel, or plain text list of cases).
2. The AI parses existing cases to extract:
   - Naming conventions and structure
   - Assertion style and level of detail
   - Coverage map — which features already have tests, which don't
3. New AI-generated cases follow the **same conventions**, and are explicitly tagged as
   `source: ai-generated` vs `source: user-provided`, so nothing is silently overwritten.
4. Coverage gaps (Jira stories with no matching existing test) are prioritized first for generation.

---

## 6. Tool Stack

| Layer | Tool | Why |
|---|---|---|
| **Frontend** | Next.js (React) | Standard for a dashboard + settings + connector UI, good auth/session ecosystem |
| **Backend API** | FastAPI (Python) | Same language as the execution/eval layer, avoids context-switching, async-friendly for connector calls |
| **Auth** | Auth.js or Clerk | Handles multi-tenant login without building auth from scratch |
| **Secrets storage** | AWS/GCP KMS-backed encrypted columns, or HashiCorp Vault if self-hosting | Per-workspace encrypted connector credentials |
| **Job queue/orchestration** | Temporal or Celery + Redis | Generation and execution jobs run async, need retries/visibility |
| **MCP connectors** | GitHub MCP server, Atlassian/Jira MCP server, a Database MCP server (Postgres/MySQL/Mongo-specific) | Standardized connector protocol — new integrations become config, not custom code |
| **UI Automation** | Playwright | Fast, multi-browser, native trace/screenshot capture |
| **API Automation** | pytest + httpx | Async-capable, lightweight, integrates into the same pytest run as everything else |
| **DB Testing** | pytest + SQLAlchemy + Great Expectations | Direct state assertions + declarative data-quality rules |
| **Integration Testing** | pytest + Testcontainers | Isolated, reproducible dependency spin-up per run |
| **AI Eval Layer** | DeepEval | Native pytest integration, supports Answer Relevancy/Faithfulness/custom GEval metrics |
| **Observability** | Langfuse | Full trace capture, links traces to DeepEval scores, supports production shadow-traffic review |
| **Reporting** | Allure Report, embedded in the dashboard | Aggregates all four test layers into one navigable view per run |
| **Platform datastore** | Postgres | Workspaces, users, connections (encrypted), test metadata, run history |

---

## 7. DeepEval Metric Wiring (unchanged core, workspace-scoped now)

```python
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval
from deepeval.test_case import LLMTestCase

test_case = LLMTestCase(
    input=user_query,
    actual_output=response,
    retrieval_context=[retrieved_context],   # Groundedness
    tools_called=actual_tool_calls,          # Tool Sequence Accuracy
    expected_tools=expected_tool_sequence,   # ground truth, derived from Jira acceptance criteria
    expected_output=golden_answer,           # Correctness/Completeness, from existing tests or Jira AC
)

answer_relevancy = AnswerRelevancyMetric(threshold=0.8)          # soft gate
groundedness = FaithfulnessMetric(threshold=0.9)                 # hard gate

completeness = GEval(
    name="Completeness",
    criteria="Does the response cover every element required by the Jira acceptance criteria?",
    evaluation_params=["input", "actual_output", "expected_output"],
    threshold=0.75,
)

correctness = GEval(
    name="Correctness",
    criteria="Is the response factually and procedurally correct against the golden answer?",
    evaluation_params=["input", "actual_output", "expected_output"],
    threshold=0.85,                                             # hard gate on high-risk flows
)

tool_sequence_accuracy = GEval(
    name="ToolSequenceAccuracy",
    criteria=(
        "1) All required tools from expected_tools were called. "
        "2) No destructive/irreversible tool was called out of expected order. "
        "3) No unnecessary tool calls occurred."
    ),
    evaluation_params=["tools_called", "expected_tools"],
    threshold=0.9,
)
```

---

## 8. STLC Coverage Map (platform-native)

| STLC Phase | Platform Component |
|---|---|
| **Requirement Analysis** | Jira MCP connector pulls stories + acceptance criteria → AI extracts rubric + expected tool taxonomy |
| **Test Planning** | Workspace settings: risk-tier tagging per Jira epic/component, threshold configuration |
| **Test Case Design** | Generation engine reads Jira + GitHub repo + existing tests → drafts new cases → human review queue |
| **Test Automation (build)** | Approved cases compiled into Playwright/pytest/DeepEval suites automatically |
| **Test Execution** | Worker pool runs suites: PR-triggered smoke subset, nightly full regression, pre-release full gate |
| **Defect Reporting** | Failures auto-create Jira tickets (via the same Jira MCP connection) with trace attached |
| **Release Gate** | Dashboard shows per-metric gate status; CI webhook blocks merge/deploy on hard-gate failure |
| **Post-Release Monitoring** | Langfuse traces on production traffic (if user connects their app's trace stream) → low scores triaged into next generation cycle |

---

## 9. Deliverables Checklist for the Build Agent

- [ ] Multi-tenant auth + workspace model (Postgres schema: workspaces, users, connections, datasets, runs)
- [ ] Connector settings UI: Connect/Disconnect GitHub, Jira, Database, with encrypted token storage
- [ ] MCP client integration for GitHub, Jira, and at least one DB type (Postgres first)
- [ ] Existing-test ingestion: repo auto-discovery + manual upload path, convention extraction
- [ ] Test generation engine: Jira story + code + schema → draft test cases with source tagging
- [ ] Human review queue UI: approve/reject/edit AI-generated cases before they enter the gating suite
- [ ] Execution workers: Playwright, pytest+httpx, pytest+SQLAlchemy/Great Expectations, Testcontainers
- [ ] DeepEval suite wired to the 5 metrics above, including custom Tool Sequence Accuracy metric
- [ ] Job orchestration (Temporal/Celery) for generation and execution jobs, with retry/visibility
- [ ] Langfuse tracing integration
- [ ] Dashboard: run history, per-metric scores, release gate status, drill-down trace viewer
- [ ] Closed-loop job: low-scoring runs → auto-create review-queue items → optional Jira ticket creation
- [ ] CI webhook: expose gate status via API/webhook so any external CI (GitHub Actions, GitLab CI, Jenkins) can block on it

---

## 10. Instruction to the Build Agent

Build this platform incrementally in the order of Section 9, starting with the workspace/auth/connector
foundation before any test generation logic — nothing else works without a working connection layer.
Default to Python (FastAPI) for backend and pytest-based execution, Next.js for frontend, Postgres for
platform data. Treat MCP as the only integration pattern for third-party tools — do not hardcode a
GitHub or Jira REST call directly into business logic; route everything through the MCP connector
layer so adding a new tool later (Slack, Linear, Confluence) is a config addition. Every credential
must be encrypted at rest and scoped to a single workspace — flag and refuse any design that would
allow cross-workspace credential or data access.
