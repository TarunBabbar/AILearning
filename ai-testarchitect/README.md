# QA Copilot — AI Test Architect

An AI-powered QA Copilot platform: a Claude-like web UI backed by a multi-agent system for test case generation from PRDs, automated test execution, regression selection, JIRA integration, vector-based test retrieval, and test framework migration.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Frontend (Next.js)               │
│   Chat UI  │  Dashboard  │  Test Viewer  │  Config │
│   (Claude-like dark + amber theme)                │
└────────────────────┬─────────────────────────────┘
                     │ REST + SSE Streaming
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

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS v4 |
| Backend | FastAPI (Python 3.12+) |
| AI/LLM | Anthropic Claude API (primary), OpenAI (fallback) |
| Agent Orchestration | LangGraph |
| Vector DB | ChromaDB |
| Test Execution | Playwright + Pytest |
| MCP Integration | Custom MCP servers for JIRA, Zephyr, TestRail, GitHub |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Deployment | Docker Compose |

---

## Project Structure

```
qa-copilot/
├── frontend/                          # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx             # Root layout (dark theme)
│   │   │   ├── page.tsx               # Main chat interface
│   │   │   └── globals.css            # Amber-dark theme + markdown styles
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatArea.tsx        # Chat container with SSE streaming
│   │   │   │   ├── ChatMessage.tsx      # Role-aware bubble (markdown, streaming)
│   │   │   │   └── ChatInput.tsx        # Auto-resize textarea + send button
│   │   │   └── sidebar/
│   │   │       └── Sidebar.tsx         # Project nav, collapsible, mock projects
│   │   └── lib/
│   │       ├── api.ts                  # REST + SSE API client
│   │       └── utils.ts               # cn() class merge utility
│   ├── Dockerfile
│   └── package.json
│
├── backend/                           # FastAPI app
│   ├── app/
│   │   ├── main.py                    # FastAPI entry point + CORS
│   │   ├── config.py                  # Pydantic settings (DB, LLM, Chroma)
│   │   ├── api/routes/
│   │   │   ├── projects.py            # CRUD: GET/POST/PATCH/DELETE /api/projects
│   │   │   └── chat.py                # SSE streaming: POST /api/chat/stream
│   │   ├── models/
│   │   │   ├── project.py             # Project SQLAlchemy model
│   │   │   ├── test_case.py           # TestCase model
│   │   │   ├── execution.py           # TestRun + TestResult models
│   │   │   └── conversation.py        # Conversation + Message models
│   │   ├── db/
│   │   │   └── database.py            # Async SQLAlchemy engine + session
│   │   ├── agents/                    # Agent stubs (Phase 2+)
│   │   ├── graph/                     # LangGraph workflows (Phase 2+)
│   │   ├── mcp/                       # MCP servers (Phase 2+)
│   │   ├── vectordb/                  # ChromaDB client (Phase 3+)
│   │   ├── execution/                 # Docker-sandboxed runners (Phase 4+)
│   │   └── migrate/                   # AST parsers + transformers (Phase 5+)
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml                 # PostgreSQL + backend + frontend
├── qa-copilot-architecture.md         # Full architecture & implementation plan
└── README.md
```

---

## What's Implemented (Phase 1 — Foundation)

### Frontend
- Next.js 16 with TypeScript, Tailwind CSS v4, App Router
- Claude-like amber/dark theme (`#0d0d0d` bg, `#d97706` accent)
- Streaming chat interface with auto-resize input, Enter-to-send
- Agent/user chat bubbles with markdown rendering (tables, code blocks, bold)
- Animated streaming cursor during responses
- Sidebar with collapsible navigation and project list
- Suggestion chips for common commands

### Backend
- FastAPI with CORS middleware and async lifespan
- SQLite database with SQLAlchemy async + all schema tables created at startup
- Project CRUD: `GET/POST/PATCH/DELETE /api/projects`
- SSE streaming chat: `POST /api/chat/stream`
- Mock agent responses (keyword-matches: generate, regression, migrate)
- Health check: `GET /api/health`

### Infrastructure
- Docker Compose for all services
- Dockerfiles for both frontend and backend
- Environment config via `.env`

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- npm

### 1. Clone & install

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
```

### 2. Configure environment

```bash
# backend/.env
DB_URL=sqlite+aiosqlite:///./qacopilot.db
ANTHROPIC_API_KEY=your-key-here   # optional, uses mock responses without it
```

### 3. Start services

```bash
# Terminal 1 — Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### 4. Open the app

Go to `http://localhost:3000` and try:
- **"Generate test cases for login"** — returns a table of 5 test cases
- **"What tests cover BUG-456?"** — returns ranked regression list
- **"Migrate LoginTest.java to Playwright"** — returns converted TypeScript code

### 5. Docker (optional)

```bash
docker compose up -d
```

---

## API Reference

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:id` | Get project |
| `PATCH` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |

### Chat (SSE Streaming)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | Send message, receive SSE stream |

```json
// Request
{ "message": "Generate test cases for login", "project_id": null }

// Stream: event:message + data:chunk per character
```

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | `{ "status": "ok" }` |

---

## Roadmap

### Phase 1 — Foundation ✅
- [x] Next.js frontend with Claude-like theme
- [x] FastAPI backend with project CRUD
- [x] SQLite/PostgreSQL with Alembic-ready models
- [x] SSE streaming chat with mock agent
- [x] Docker Compose

### Phase 2 — Core Agents (next)
- [ ] LangGraph state schema + Orchestrator agent
- [ ] JIRA MCP integration (fetch issues)
- [ ] PRD Analyzer agent
- [ ] Test Generator agent
- [ ] LLM-powered responses (Claude API)

### Phase 3 — Vector DB & Regression
- [ ] ChromaDB setup + embedding pipeline
- [ ] Zephyr/TestRail MCP integration
- [ ] Bulk sync: fetch test cases → embed → store
- [ ] Regression Selector agent (semantic search)

### Phase 4 — Automation & Execution
- [ ] Test Automator agent (code generation)
- [ ] Docker-sandboxed Playwright execution
- [ ] Result Analyzer agent
- [ ] Execution reports UI

### Phase 5 — Migration Engine
- [ ] Tree-sitter AST parsers (Java, Python, C#, TypeScript)
- [ ] Semantic mappers (Selenium→Playwright, TestNG→Vitest/Jest)
- [ ] Template engine + LLM polish
- [ ] Migration UI wizard

### Phase 6 — CI & Production
- [ ] GitHub MCP + PR webhook handler
- [ ] PR-triggered test execution
- [ ] Admin dashboard
- [ ] Rate limiting, caching, auth

---

## Design Decisions

- **Python backend (not Node.js):** LangGraph, ChromaDB, Playwright are Python-first. Keeps AI/agent layer in Python.
- **ChromaDB over Pinecone:** Self-hosted, zero-cost, Python-native. Good for this scale.
- **tree-sitter + rules over pure LLM migration:** Deterministic AST parsing handles 80% of conversion. LLM polishes remaining 20%.
- **Docker-per-execution:** Security sandboxing for user-submitted test code. Clean state per run.
- **Amber-on-dark theme:** Familiar Claude.ai pattern; amber (#d97706) differentiates branding.

---

## License

MIT
