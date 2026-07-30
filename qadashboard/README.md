# QA AI Dashboard

Unified QA platform — resume & job matching, AI interview prep, document RAG, test case generation, and AI learning tutor, all in one Claude-inspired UI.

Built on Next.js 15 + Tailwind CSS v4 + OpenRouter (free AI models) + Pinecone (vector search) + Neon PostgreSQL.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| **Framework** | Next.js 15 (App Router) |
| **Database** | Neon PostgreSQL (free serverless) + Prisma ORM |
| **Vector Store** | Pinecone (free tier) |
| **AI Provider** | OpenRouter (free models: Gemma 4, Nemotron, Llama 3.3, etc.) |
| **Embeddings** | OpenRouter API (`text-embedding-3-small`) |
| **Auth** | PBKDF2 password hashing + token-based sessions |
| **Styling** | Tailwind CSS v4 + Claude.ai warm cream theme |
| **Icons** | lucide-react |
| **Markdown** | react-markdown + remark-gfm |
| **Deployment** | Vercel (free) |

---

## Modules

### 1. Dashboard `/`
Stats overview (documents, Q&A pairs, jobs, topics, projects) and quick-action cards for every module.

### 2. Resume & Job Matcher
| Page | Path | Description |
|------|------|-------------|
| Upload | `/resume` | Upload resume (PDF/DOCX) and job listing files |
| Matches | `/resume/matches` | AI-scored job opportunities with strengths/gaps detail panel |
| Email Agent | `/resume/email` | Bulk-send personalized applications via Gmail SMTP |
| Companies | `/resume/companies` | Aggregated company view with job counts and scores |

### 3. QA Interview Prep
| Page | Path | Description |
|------|------|-------------|
| Chat | `/qa` | Streaming RAG chat — ask QA questions, get answers grounded in 400+ interview Q&A pairs |
| Topics | `/qa/topics` | Two-panel topic browser (by file / AI-refined toggle)

### 4. Document RAG
| Page | Path | Description |
|------|------|-------------|
| Documents | `/documents` | Upload, list, and delete docs (PDF, DOCX, TXT, MD, CSV, XLSX) |
| Document Q&A | `/documents/[id]` | Per-document AI chat grounded in its content |

### 5. Test Architect
| Page | Path | Description |
|------|------|-------------|
| New Analysis | `/test-architect` | Paste PRD requirements + optional JIRA key → AI generates structured test cases |
| Projects | `/test-architect/projects` | CRUD for test analysis projects |

### 6. AI Learning Tutor `/learn`
Interactive AI chat for learning QA concepts, automation frameworks, and interview topics.

### 7. Settings `/settings`
Configure OpenRouter API key, Gmail SMTP credentials, and select AI model from available free tiers.

---

## Screenshots

### Login Page
![Login Page](screenshots/login.png)

### Dashboard
![Dashboard](screenshots/dashboard.png)

### QA Interview Chat
![QA Chat](screenshots/qa-chat.png)

### QA Topics Browser
![QA Topics](screenshots/qa-topics.png)

### Resume Upload
![Resume Upload](screenshots/resume-upload.png)

### Job Matches
![Job Matches](screenshots/job-matches.png)

### Email Agent
![Email Agent](screenshots/email-agent.png)

### Companies
![Companies](screenshots/companies.png)

### Documents
![Documents](screenshots/documents.png)

### Test Architect
![Test Architect](screenshots/test-architect.png)

### Projects
![Projects](screenshots/projects.png)

### Learning Tutor
![Learning Tutor](screenshots/learn.png)

### Settings
![Settings](screenshots/settings.png)

---

## Quick Start

```bash
# 1. Install dependencies
cd qadashboard
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env — add OPENROUTER_API_KEY at minimum
# Optional: DATABASE_URL (Neon), PINECONE_API_KEY

# 3. Start dev server
npm run dev

# 4. Open http://localhost:3000
#    Login with username: TarunBabbar, password: TarunBabbar
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key for AI features |
| `DATABASE_URL` | No | — | Neon PostgreSQL connection string |
| `PINECONE_API_KEY` | No | — | Pinecone API key for vector search |
| `PINECONE_INDEX_NAME` | No | `qa-dashboard` | Pinecone index name |
| `LLM_MODEL` | No | `google/gemma-4-26b-a4b-it:free` | AI model for completions |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model |
| `NEXT_PUBLIC_APP_NAME` | No | `QA AI Dashboard` | App name in headers |

---

## Deployment (Vercel)

1. Push `qadashboard/` to a GitHub repo
2. Import into Vercel
3. Add env vars:
   - `OPENROUTER_API_KEY`
   - `DATABASE_URL` (Neon free tier)
   - `PINECONE_API_KEY`
4. Deploy — all routes work out of the box

---

## Architecture

```
[Browser] → Next.js App Router → API Routes → lib/
                                               ├── openrouter.ts      (LLM client)
                                               ├── embeddings.ts      (vector embeddings)
                                               ├── auth.ts            (password hashing, tokens)
                                               ├── rag/pinecone-store (vector DB)
                                               ├── rag/rag-chain.ts   (RAG pipeline)
                                               └── rag/qa-extractor.ts (Q&A extraction)

Data flow:
  User Question → getEmbedding() → Pinecone.query(topK=5)
    → Build context with [Source] markers
    → OpenRouter LLM → Stream response via NDJSON
```

---

## License

MIT
