# QA Copilot — Comprehensive Architecture & Implementation Plan

## Overview

A full-stack QA Copilot platform: a Claude-like web UI backed by a multi-agent AI system that handles test case generation from PRDs, automated test execution, regression selection, JIRA integration, vector-based test retrieval, and test framework migration (e.g., Java+Selenium → TS+Playwright).

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────┐
│                  Frontend (Next.js)               │
│   Chat UI  │  Dashboard  │  Test Viewer  │  Config │
│   (Claude-like dark theme, amber accents)         │
└────────────────────┬─────────────────────────────┘
                     │ REST + WebSocket
┌────────────────────▼─────────────────────────────┐
│             Backend API (FastAPI + Python)         │
│   Auth  │  Projects  │  Agent Orchestrator  │  WS │
└────────────────────┬─────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌────────────┐   ┌──────────────┐
│ LangGraph│   │  ChromaDB  │   │  MCP Layer   │
│ Multi-   │   │  Vector    │   │  JIRA        │
│ Agent    │   │  Store     │   │  Zephyr/     │
│ System   │   │            │   │  TestRail    │
└────┬─────┘   └────────────┘   │  GitHub      │
     │                          └──────────────┘
     ▼
┌──────────────────────────────────────────────────┐
│              Execution Engine                      │
│   Playwright  │  Selenium  │  Pytest  │  Docker   │
└──────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python 3.11+) |
| AI/LLM | Anthropic Claude API (primary), OpenAI (fallback) |
| Agent Orchestration | LangGraph |
| Vector DB | ChromaDB |
| Test Execution | Playwright + Pytest |
| MCP Servers | @modelcontextprotocol/server-github, custom JIRA/Zephyr servers |
| Database | PostgreSQL (metadata) + ChromaDB (embeddings) |
| Auth | Clerk or NextAuth.js |
| Deployment | Docker Compose (dev) |

---

## 3. Directory Structure

```
qa-copilot/
├── frontend/                    # Next.js app
│   ├── src/
│   │   ├── app/                 # App router pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # Chat interface (main)
│   │   │   ├── dashboard/       # Project dashboard
│   │   │   ├── tests/           # Test case viewer/editor
│   │   │   ├── reports/         # Execution reports
│   │   │   └── migrate/         # Migration tool UI
│   │   ├── components/
│   │   │   ├── chat/            # Chat bubbles, input, streaming
│   │   │   ├── sidebar/         # Project nav, history
│   │   │   ├── test-viewer/     # Test case display/edit
│   │   │   ├── reports/         # Charts, tables, diff views
│   │   │   ├── migrate/         # Migration wizard
│   │   │   └── ui/              # Shared primitives (theme)
│   │   ├── hooks/               # useChat, useWebSocket, useProject
│   │   ├── lib/                 # API client, utils, theme config
│   │   └── styles/              # Tailwind theme (amber+dark)
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     # FastAPI app
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings, env vars
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── chat.py      # Chat endpoint (streaming)
│   │   │   │   ├── projects.py  # CRUD projects
│   │   │   │   ├── tests.py     # Test case operations
│   │   │   │   ├── executions.py# Trigger/test runs
│   │   │   │   ├── reports.py   # Test reports
│   │   │   │   ├── migrate.py   # Migration endpoints
│   │   │   │   └── integrations.py # JIRA/Zephyr config
│   │   │   └── ws.py            # WebSocket for real-time
│   │   ├── agents/
│   │   │   ├── orchestrator.py  # Routes to specialized agents
│   │   │   ├── jira_agent.py    # Fetch & classify JIRA issues
│   │   │   ├── prd_agent.py     # Analyze PRDs
│   │   │   ├── test_gen_agent.py# Generate test cases
│   │   │   ├── test_auto_agent.py # Generate automation code
│   │   │   ├── regression_agent.py # Identify regression tests
│   │   │   ├── execution_agent.py  # Run tests
│   │   │   ├── analyze_agent.py # Analyze results
│   │   │   └── migrate_agent.py # Framework migration
│   │   ├── graph/
│   │   │   ├── state.py         # LangGraph state schema
│   │   │   ├── workflows/
│   │   │   │   ├── prd_to_tests.py
│   │   │   │   ├── bug_regression.py
│   │   │   │   ├── execute_tests.py
│   │   │   │   └── migrate_framework.py
│   │   │   └── edges.py         # Conditional routing
│   │   ├── mcp/
│   │   │   ├── jira_server.py    # JIRA MCP server wrapper
│   │   │   ├── zephyr_server.py  # Zephyr MCP server wrapper
│   │   │   ├── testrail_server.py# TestRail MCP wrapper
│   │   │   └── github_server.py  # GitHub MCP wrapper
│   │   ├── vectordb/
│   │   │   ├── chroma_client.py  # ChromaDB wrapper
│   │   │   ├── embeddings.py     # Embedding generation
│   │   │   ├── test_indexer.py   # Index test cases
│   │   │   └── retriever.py      # Similarity search
│   │   ├── execution/
│   │   │   ├── runner.py         # Test execution engine
│   │   │   ├── playwright_runner.py
│   │   │   ├── selenium_runner.py
│   │   │   └── docker_executor.py # Sandboxed execution
│   │   ├── migrate/
│   │   │   ├── parser.py         # AST/code parser
│   │   │   ├── transformers/
│   │   │   │   ├── java_to_ts.py
│   │   │   │   ├── selenium_to_playwright.py
│   │   │   │   └── testng_to_jest.py
│   │   │   └── templates.py      # Framework templates
│   │   ├── models/
│   │   │   ├── project.py
│   │   │   ├── test_case.py
│   │   │   ├── execution.py
│   │   │   └── jira.py
│   │   └── db/
│   │       ├── postgres.py       # SQLAlchemy models
│   │       └── migrations/
│   ├── tests/
│   └── requirements.txt
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 4. Agent System Design (LangGraph)

### 4.1 State Schema (`state.py`)

```python
class AgentState(TypedDict):
    request_id: str
    project_id: str
    intent: Literal["generate_tests", "regression_select", "execute", "migrate", "analyze"]
    jira_issue: Optional[JiraIssue]
    requirement_text: str
    test_plan: list[TestPlanItem]
    test_cases: list[TestCase]
    execution_results: list[ExecutionResult]
    analysis: Optional[Analysis]
    migration_config: Optional[MigrationConfig]
    migrated_code: Optional[str]
    errors: list[str]
    status: str
```

### 4.2 Agent Descriptions

| Agent | Input | Output | Key Responsibility |
|---|---|---|---|
| **Orchestrator** | User message | Intent classification + routing | Classify: PRD→testgen, Bug→regression, code→migrate |
| **JIRA Agent** | JIRA issue ID | Structured issue data | Extract type, description, linked PRDs, comments |
| **PRD Analyzer** | PRD text | Feature list, acceptance criteria, edge cases | Structured feature breakdown from PRD |
| **Test Generator** | Features + criteria | Structured test cases | Generate ID, title, steps, expected, type, priority |
| **Test Automator** | Test cases + framework config | Runnable test scripts | Write Playwright/TS, Selenium/Java automation code |
| **Regression Selector** | Bug/story + vector DB | Ranked list of relevant tests | Semantic matching of bug to existing tests |
| **Execution Agent** | Test scripts | Execution results | Run tests in sandboxed Docker environment |
| **Result Analyzer** | Execution results | Pass/fail summary, root cause | Categorize failures, suggest fixes |
| **Migration Agent** | Source code + target config | Converted test code | AST-level language/framework conversion |

### 4.3 Key Workflows

**Workflow A: PRD → Test Cases**
```
User: "Generate test cases for PRD-123"
  → Orchestrator (intent: generate_tests)
  → JIRA Agent (fetch PRD-123 content)
  → PRD Analyzer (extract features, acceptance criteria, edge cases)
  → Test Generator (create structured test cases)
  → Vector DB Indexer (store for future retrieval)
  → Return structured test cases to UI
```

**Workflow B: Bug → Regression Selection**
```
User: "What tests cover BUG-456?"
  → Orchestrator (intent: regression_select)
  → JIRA Agent (fetch BUG-456 content)
  → Regression Selector:
      - Embed bug description
      - Query ChromaDB for semantically similar test cases
      - Rank by relevance score
      - Categorize: manual / automated / auto-runnable-on-PR
  → Return ranked list with execution recommendations
```

**Workflow C: Test Execution**
```
User: "Run regression tests for BUG-456"
  → Orchestrator (intent: execute)
  → Regression Selector (identify tests)
  → Test Automator (generate automation for manual tests if needed)
  → Execution Agent (Docker-sandboxed Playwright/Selenium)
  → Result Analyzer (report generation)
  → Return report with pass/fail, screenshots, failure analysis
```

**Workflow D: Migration**
```
User: "Migrate LoginTest.java to TypeScript + Playwright"
  → Orchestrator (intent: migrate)
  → Migration Agent:
      - Parse Java AST via tree-sitter
      - Map Selenium → Playwright patterns
      - Convert TestNG → Jest/Vitest patterns
      - Generate TypeScript code
      - LLM review for edge cases
  → Return migrated code in chat + artifacts panel
```

---

## 5. Frontend Design (Claude-like UI)

### 5.1 Theme Configuration
- **Background**: `#0d0d0d` (deepest), `#1a1a1a` (base), `#262626` (surface)
- **Amber accents**: `#d97706` (primary-600), `#f59e0b` (primary-500), `#fbbf24` (primary-400)
- **Text**: `#f5f5f5` (primary text), `#a3a3a3` (secondary), `#737373` (muted)
- **Chat bubbles**: Agent = `#262626` with amber left border (`2px solid #d97706`), User = `#1e3a5f` with right alignment
- **Code blocks**: `#111111` background, amber syntax highlighting tokens, copy button top-right
- **Font**: Inter for UI, JetBrains Mono for code

### 5.2 Page Routes

| Route | Description |
|---|---|
| `/` | Main chat interface — project selector sidebar + chat area |
| `/dashboard` | All projects overview, recent runs, health stats |
| `/dashboard/[projectId]` | Single project: test suite stats, run history, integration status |
| `/tests/[projectId]` | Test case browser: table view with filters (type, status, priority), click to edit |
| `/reports/[runId]` | Execution report: summary cards, pass/fail pie, test-by-test detail, screenshots, logs |
| `/migrate` | Migration wizard: upload/source selector → target config → preview → apply |
| `/settings` | Integrations config (JIRA, Zephyr/TestRail), API keys, LLM provider |

### 5.3 Chat Interface Features
- Streaming responses via Server-Sent Events (SSE) — text appears progressively
- Markdown rendering with `react-markdown` + `rehype-highlight`
- Artifacts panel: Structured outputs (test case tables, code diffs, reports) rendered in a right-side pane
- Tool call cards: Inline status chips showing agent activity ("🔍 Fetching JIRA issue BUG-456...", "✅ Generated 12 test cases")
- Conversation history sidebar per project
- File upload (drag & drop) for PRDs, source code files
- "@" command menu: `@jira`, `@generate`, `@regression`, `@execute`, `@migrate`

### 5.4 Key Components
- `ChatInput`: Auto-resizing textarea with send button, file upload, @-mention support
- `ChatMessage`: Role-aware bubble with markdown, tool calls, artifact references
- `ArtifactPanel`: Slide-out panel showing structured data (tables, diffs, code)
- `TestCard`: Individual test case card with steps, expected, priority badge, automation toggle
- `ExecutionTimeline`: Visual timeline of test run with pass/fail/skip states
- `MigrationDiff`: Side-by-side code diff (monaco editor) for migration preview

---

## 6. MCP Integration Layer

### 6.1 JIRA MCP Server
**Tools exposed:**
- `jira_get_issue(issue_key: str)` → returns type, title, description, comments, linked issues, attachments
- `jira_search(jql: str, max_results: int)` → search with JQL
- `jira_get_sprint(sprint_id: int)` → all issues in sprint
- `jira_get_project(project_key: str)` → project metadata

**Setup flow:** User provides JIRA URL + API token in Settings → stored encrypted with Fernet key → MCP server connects on project creation.

### 6.2 Zephyr / TestRail MCP Server
**Tools exposed:**
- `get_test_cases(project_key: str)` → bulk fetch all test cases
- `get_test_cycle(cycle_id: str)` → fetch execution cycle with results
- `update_result(test_case_key: str, status: str, comment: str)` → push result back
- `create_test_case(project_key: str, data: dict)` → create new test case

**Initial sync:** On project setup → fetch all existing test cases → embed each one → store in ChromaDB `test_cases` collection with metadata (external ID, project, type, automation status).

### 6.3 GitHub MCP Server
**Tools exposed:**
- `get_pr_diff(owner: str, repo: str, pr_number: int)` → changed files with diff
- `get_file(owner: str, repo: str, path: str, ref: str)` → file content at ref
- Webhook listener: `POST /api/webhooks/github` → PR opened/updated event

**PR integration flow:** PR webhook received → analyze changed files → semantic search ChromaDB for tests covering those areas → auto-execute automated tests → post status check back to PR.

---

## 7. Vector Database Strategy (ChromaDB)

### 7.1 Collections

| Collection | What's Stored | Embedding Model | Metadata |
|---|---|---|---|
| `test_cases` | Test title + steps + expected results concatenated | `text-embedding-3-small` (1536d) | project_id, external_id, type, automation_status, framework, last_run |
| `requirements` | PRD sections chunked by heading | `text-embedding-3-small` | project_id, jira_key, section_header |
| `bugs` | Bug title + description + steps to reproduce | `text-embedding-3-small` | project_id, jira_key, severity, status |
| `code_patterns` | Automation code snippets (for migration) | `text-embedding-3-small` | framework, language, pattern_type |

### 7.2 Indexing Pipeline
1. **On project setup:** Fetch all test cases from Zephyr/TestRail → chunk → embed → upsert to `test_cases`
2. **On PRD import:** Parse PRD text → split by Markdown headings → embed each section → upsert to `requirements`
3. **On test creation:** After AI generates tests → auto-embed and upsert to `test_cases`
4. **On migration analysis:** Index source code snippets → `code_patterns` for future pattern matching

### 7.3 Retrieval for Regression Selection
```
1. Embed bug description text
2. Query test_cases collection: chroma_collection.query(query_embedding, n_results=20)
3. Filter by project_id match
4. Rank by cosine similarity score (threshold: >0.7)
5. Tag each result: "manual", "automated", "auto-runnable" (automated + has code_path)
6. Return ranked list to Regression Selector agent for final LLM curation
```

---

## 8. Migration Engine Design

### 8.1 Supported Conversion Paths

| Source | Target |
|---|---|
| Java + Selenium WebDriver + TestNG | TypeScript + Playwright + Vitest |
| Java + Selenium WebDriver + TestNG | Python + Playwright + Pytest |
| Python + Selenium + Pytest | TypeScript + Playwright + Vitest |
| C# + Selenium + NUnit | TypeScript + Playwright + Vitest |

### 8.2 Migration Pipeline

```
Source Code
    │
    ▼
┌─────────────────┐
│   AST Parser     │  tree-sitter grammars per language
│  (tree-sitter)   │  Extract: classes, methods, locators, assertions
└────────┬────────┘
         ▼
┌─────────────────┐
│ Semantic Mapper  │  Pattern-matching rules:
│                  │  driver.findElement(By.id("x")) → page.locator("#x")
│                  │  @Test(priority=1) → test("...", async () => {})
│                  │  Assert.assertEquals(a, b) → expect(a).toBe(b)
│                  │  driver.quit() → await browser.close()
└────────┬────────┘
         ▼
┌─────────────────┐
│ Template Engine  │  Apply framework boilerplate:
│                  │  - Imports (playwright, vitest)
│                  │  - test.describe / fixture setup
│                  │  - beforeEach/afterEach hooks
│                  │  - tsconfig.json, playwright.config.ts
└────────┬────────┘
         ▼
┌─────────────────┐
│  LLM Polisher    │  Claude reviews for:
│                  │  - Edge cases mapper missed
│                  │  - Best practices (waitFor, data-testid)
│                  │  - Code comments & formatting
└────────┬────────┘
         ▼
    Target Code
```

### 8.3 Semantic Mapping Rules (Examples)

| Selenium (Java) | Playwright (TypeScript) |
|---|---|
| `WebDriver driver = new ChromeDriver()` | `const browser = await chromium.launch()` |
| `driver.get(url)` | `await page.goto(url)` |
| `driver.findElement(By.id("x"))` | `page.locator("#x")` |
| `driver.findElement(By.xpath("//div"))` | `page.locator("//div")` |
| `element.click()` | `await locator.click()` |
| `element.sendKeys("text")` | `await locator.fill("text")` |
| `element.getText()` | `await locator.textContent()` |
| `driver.quit()` | `await browser.close()` |
| `@Test` (TestNG) | `test("...", async () => {})` (Vitest) |
| `@BeforeMethod` | `test.beforeEach()` |
| `Assert.assertEquals(a, b)` | `expect(a).toBe(b)` |
| `Assert.assertTrue(cond)` | `expect(cond).toBeTruthy()` |
| `WebDriverWait(driver, 10).until(...)` | `await page.waitForSelector(...)` |

---

## 9. Execution Engine

### 9.1 Architecture
- Each test run spawns a fresh Docker container with the target framework pre-installed
- Container images: `qa-copilot/playwright:latest`, `qa-copilot/selenium:latest`
- Test code is mounted as a volume
- Output captured: stdout/stderr logs, Playwright trace, screenshots, videos
- Results streamed back via WebSocket to the UI in real-time

### 9.2 Execution Flow
```
POST /api/executions/run { test_ids: [...], trigger: "manual"|"pr" }
    → Create execution record (status: queued)
    → For each test (parallel, max concurrency=4):
        → Spin up Docker container
        → Execute test script
        → Capture output (SSE to UI)
        → On completion: store result, screenshots, logs
    → Aggregate results
    → Trigger Result Analyzer agent
    → Update execution record (status: complete)
```

### 9.3 CI Integration (GitHub PR)
```
PR opened/updated webhook
    → Extract changed files from diff
    → Semantic search ChromaDB: which test cases cover these areas?
    → Filter to auto-runnable tests
    → Queue execution (status: pending on PR)
    → Execute tests
    → Post status check to PR commit
    → On failure: auto-comment with failure summary
```

---

## 10. Database Schema (PostgreSQL)

```sql
-- Core
projects (id UUID PK, name TEXT, jira_url TEXT, test_mgmt_type TEXT, created_at TIMESTAMPTZ)
users (id UUID PK, email TEXT UNIQUE, name TEXT, created_at TIMESTAMPTZ)
project_members (project_id UUID FK, user_id UUID FK, role TEXT)

-- Integrations
jira_configs (id UUID PK, project_id UUID FK UNIQUE, url TEXT, api_token_encrypted BYTEA, created_at TIMESTAMPTZ)
zephyr_configs (id UUID PK, project_id UUID FK UNIQUE, type TEXT, url TEXT, api_key_encrypted BYTEA, created_at TIMESTAMPTZ)

-- Test cases (canonical store, ChromaDB is search index)
test_cases (
    id UUID PK, project_id UUID FK, external_id TEXT,
    title TEXT, description TEXT, steps JSONB, expected_result TEXT,
    priority TEXT CHECK (priority IN ('critical','high','medium','low')),
    type TEXT CHECK (type IN ('functional','regression','smoke','e2e','api','performance')),
    automation_status TEXT CHECK (automation_status IN ('manual','automated','in_progress')),
    framework TEXT, code_path TEXT,
    tags TEXT[], created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

-- Executions
test_runs (id UUID PK, project_id UUID FK, triggered_by UUID FK, trigger_type TEXT, status TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ)
test_results (id UUID PK, run_id UUID FK, test_case_id UUID FK, status TEXT, duration_ms INT, logs TEXT, screenshots TEXT[], error_message TEXT)

-- Conversations
conversations (id UUID PK, project_id UUID FK, user_id UUID FK, title TEXT, created_at TIMESTAMPTZ)
messages (id UUID PK, conversation_id UUID FK, role TEXT, content TEXT, artifacts JSONB, created_at TIMESTAMPTZ)

-- Migrations
migrations (id UUID PK, project_id UUID FK, user_id UUID FK, source_code TEXT, source_lang TEXT, source_framework TEXT, target_lang TEXT, target_framework TEXT, result_code TEXT, status TEXT, created_at TIMESTAMPTZ)
```

---

## 11. API Design

### Chat
```
POST   /api/chat/stream          # SSE streaming chat (accepts message + conversation_id)
GET    /api/conversations        # List conversations for project
GET    /api/conversations/:id    # Get conversation messages
DELETE /api/conversations/:id    # Delete conversation
```

### Projects
```
GET    /api/projects             # List user's projects
POST   /api/projects             # Create project
GET    /api/projects/:id         # Get project details
PATCH  /api/projects/:id         # Update project
DELETE /api/projects/:id         # Delete project
```

### Test Cases
```
GET    /api/tests?project_id=X   # List test cases (filterable: type, status, priority, search)
GET    /api/tests/:id            # Get single test case
POST   /api/tests/generate       # Generate test cases from PRD/JIRA (async, returns request_id)
PUT    /api/tests/:id            # Update test case
DELETE /api/tests/:id            # Delete test case
POST   /api/tests/:id/automate   # Generate automation code for a test case
```

### Executions
```
POST   /api/executions/run       # Trigger execution { test_ids, trigger_type }
GET    /api/executions           # List past runs
GET    /api/executions/:id       # Get run details + results
GET    /api/executions/:id/report # Full report (HTML/JSON)
```

### Regression
```
POST   /api/regression/analyze   # { jira_issue_key } → returns ranked test list
```

### Migration
```
POST   /api/migrate/analyze      # Upload source code, get analysis
POST   /api/migrate/convert      # Convert with specified target config
GET    /api/migrations           # History of past migrations
```

### Integrations
```
POST   /api/integrations/jira    # Configure JIRA
POST   /api/integrations/zephyr  # Configure Zephyr/TestRail
POST   /api/integrations/:type/sync # Trigger sync
GET    /api/integrations/status  # Check all integration health
```

### Webhooks
```
POST   /api/webhooks/github      # GitHub PR events
```

### WebSocket
```
WS     /ws/executions/:run_id    # Real-time execution updates
WS     /ws/chat/:conversation_id # Real-time streaming agent responses
```

---

## 12. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Working shell with auth, chat UI, project management.

- [ ] Scaffold Next.js frontend with Tailwind (amber+dark theme)
- [ ] Scaffold FastAPI backend with project CRUD, SQLAlchemy + Alembic
- [ ] PostgreSQL setup with Docker Compose
- [ ] Clerk/NextAuth authentication
- [ ] Basic chat interface with SSE streaming (mock backend)
- [ ] Project creation & management UI

**Deliverable:** You can log in, create a project, and send messages that stream back.

---

### Phase 2: Core Agents (Weeks 3-4)
**Goal:** First AI workflow: JIRA → PRD analysis → test case generation.

- [ ] LangGraph setup with state schema
- [ ] Orchestrator agent (intent classification)
- [ ] JIRA MCP server + integration config UI
- [ ] PRD Analyzer agent
- [ ] Test Generator agent
- [ ] End-to-end: "Generate tests for PRD-123" → returns structured test cases
- [ ] Test case storage in PostgreSQL
- [ ] Test case display UI (table + card view)
- [ ] Chat UI artifact panel for structured outputs

**Deliverable:** Type a JIRA key, get a structured list of test cases in a beautiful panel.

---

### Phase 3: Vector DB & Regression (Weeks 5-6)
**Goal:** Synced test cases, semantic regression selection.

- [ ] ChromaDB setup + embedding pipeline
- [ ] Zephyr/TestRail MCP server + integration config
- [ ] Initial sync: bulk import + embed + store
- [ ] Index-on-create: auto-index new AI-generated tests
- [ ] Regression Selector agent (semantic search + LLM curation)
- [ ] End-to-end: "What tests cover BUG-456?" → ranked list
- [ ] Regression results UI with categorization (manual/automated/auto-runnable)

**Deliverable:** Type a bug key, get a smart ranked list of tests you should run.

---

### Phase 4: Execution Engine (Weeks 7-8)
**Goal:** Auto-execute tests, view results.

- [ ] Test Automator agent (test case → Playwright/TS code)
- [ ] Docker-based execution engine (sandboxed containers)
- [ ] Playwright + Pytest runner
- [ ] Real-time execution updates via WebSocket
- [ ] Result Analyzer agent (pass/fail, failure categorization)
- [ ] Execution reports UI (summary + detail + screenshots)
- [ ] End-to-end: "Run regression for BUG-456" → executes + reports

**Deliverable:** Click "Run", watch tests execute live, get a detailed report.

---

### Phase 5: Migration Engine (Weeks 9-10)
**Goal:** Framework migration tool.

- [ ] tree-sitter parsers (Java, Python, C#, TypeScript)
- [ ] Semantic mapper (Selenium→Playwright, TestNG→Vitest/Jest)
- [ ] Template engine for target frameworks
- [ ] LLM polish step
- [ ] Migration UI wizard (upload → config → preview → apply)
- [ ] Side-by-side diff viewer (Monaco editor)

**Deliverable:** Upload a Java Selenium file, get working TypeScript Playwright code.

---

### Phase 6: CI & Polish (Weeks 11-12)
**Goal:** Production-ready with CI integration.

- [ ] GitHub MCP server + webhook handler
- [ ] PR-triggered test execution flow
- [ ] Status check posting back to PRs
- [ ] Error handling & retry logic across all agents
- [ ] Rate limiting, input validation
- [ ] Admin dashboard
- [ ] Onboarding flow & documentation

**Deliverable:** PR opens → relevant tests run automatically → status posted.

---

## 13. Verification Plan

### Unit Tests
- **Backend:** pytest for each agent (mocked LLM calls), DB models, API routes
- **Frontend:** Vitest + React Testing Library for components, hooks

### Integration Tests
- Agent workflow tests: PRD→tests, bug→regression (mocked JIRA/MCP, real ChromaDB)
- Migration pipeline tests: known input → expected output for each conversion path

### E2E Tests
- Playwright tests for critical flows:
  1. Login → Create project → Configure JIRA → Generate tests → View results
  2. Bug regression flow: Input bug ID → Get ranked tests → Execute → View report
  3. Migration flow: Upload file → Preview → Download result

### Manual Verification (per phase)
- Phase 2: Generate tests from a real JIRA PRD — review quality
- Phase 3: Sync real Zephyr test cases — verify search relevance
- Phase 4: Execute generated Playwright tests against a real app
- Phase 5: Migrate a real Java+Selenium file — verify correctness
- Phase 6: Open a real PR — verify auto-execution triggers

---

## 14. Key Design Decisions & Rationale

1. **Python backend (not Node.js):** LangGraph, ChromaDB, Playwright are all Python-first. Keeping the AI/agent layer in Python avoids serialization overhead. The Next.js frontend only handles rendering.

2. **ChromaDB over Pinecone/Weaviate:** Self-hosted, zero-cost, Python-native, supports metadata filtering and embedding. Perfect for this scale. Can upgrade to a managed vector DB later.

3. **Tree-sitter + rules over pure LLM migration:** Deterministic AST parsing handles 80% of the conversion reliably. LLM polishes the remaining 20% (edge cases, best practices). This is cheaper and more predictable than pure LLM.

4. **Docker-per-execution:** Security isolation. Test code could be anything — sandboxing is non-negotiable. Also ensures clean state per run.

5. **LangGraph over custom orchestration:** Provides state persistence, conditional routing, streaming, and a visual graph. The article's author used it for the same reasons.

6. **Amber-on-dark theme (Claude-like):** Users are familiar with this pattern from Claude.ai. The amber (#d97706) differentiates from Claude's orange while maintaining warmth and readability on dark backgrounds.
