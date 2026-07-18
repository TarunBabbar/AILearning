# QA RAG Platform — Project State

## Purpose
A Retrieval-Augmented Generation (RAG) web application that lets users upload documents, split them into chunks, and ask AI-powered questions using **OpenRouter free models**. Warm "Claude-inspired" UI theme (amber/warm tones).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5.4 (strict) |
| UI | React 18.3 (Client Components via `'use client'`) |
| Styling | Tailwind CSS 3.4 (configured) + inline styles (used in pages) |
| Icons | Lucide React 0.400 |
| AI Provider | OpenRouter API (via native `fetch`, not OpenAI SDK) |
| Embeddings | Prompt-based (default, free via chat) or API-based via OpenRouter embeddings endpoint |
| Vector Store | **In-Memory** (default, cosine similarity) or **Pinecone** (when `PINECONE_API_KEY` is set) |
| Document Storage | In-memory global `Map` via `globalThis.__documentStore` (lost on restart) |
| Package Manager | npm |

### Dependencies
```
next@^14.2.0, react@^18.3.0, react-dom@^18.3.0,
lucide-react@^0.400.0, mammoth@^1.9.0, @pinecone-database/pinecone@^5.0.0,
react-markdown@^9.0.0 (unused), openai@^4.50.0 (unused)
```

### Dev Dependencies
```
typescript@^5.4.0, tailwindcss@^3.4.0, postcss@^8.4.0,
autoprefixer@^10.4.0, eslint@^8.57.0, eslint-config-next@^14.2.0,
@types/node@^20.14.0, @types/react@^18.3.0, @types/react-dom@^18.3.0
```

### Environment
```
OPENROUTER_API_KEY=sk-or-v1-your-key-here                          # Required for all AI
NEXT_PUBLIC_DEFAULT_MODEL=nvidia/nemotron-3-super-120b-a12b:free    # Default chat model
EMBEDDING_MODEL=prompt                                               # prompt | model-id (e.g. openai/text-embedding-3-small)
PINECONE_API_KEY=                                                    # Set to use Pinecone instead of in-memory
PINECONE_INDEX=rag-embeddings                                        # Pinecone index name (auto-created if missing)
```

---

## Project Structure

```
C:\Tarun\qaragplatform\
├── PROJECT.md                     # This file — project state reference
├── app/                           # Next.js App Router
│   ├── globals.css                # Global styles + CSS variables
│   ├── layout.tsx                 # Root layout (sidebar + main)
│   ├── page.tsx                   # Dashboard (home page)
│   ├── ai/page.tsx                # AI Q&A Chat Agent ✅
│   ├── upload/page.tsx            # Document Upload ✅
│   ├── documents/page.tsx         # Document Manager ✅
│   ├── search/page.tsx            # Document Explorer ⚠️ (basic keyword)
│   ├── scanner/page.tsx           # Project Scanner ✅ (built)
│   ├── migration/page.tsx         # Migration Studio ✅ (built)
│   ├── analytics/page.tsx         # Placeholder ❌
│   ├── settings/page.tsx          # Settings (API key, model info) ✅
│   ├── team/page.tsx              # Placeholder ❌
│   ├── connectors/page.tsx        # Placeholder ❌
│   ├── graph/page.tsx             # Placeholder ❌
│   ├── audit/page.tsx             # Placeholder ❌
│   ├── webhooks/page.tsx          # Placeholder ❌
│   ├── prompts/page.tsx           # Placeholder ❌
│   └── api/
│       ├── chat/route.ts          # POST /api/chat
│       ├── upload/route.ts        # POST /api/upload
│       ├── documents/route.ts     # GET/DELETE /api/documents
│       └── migration/route.ts     # POST /api/migration (built)
├── components/
│   ├── Sidebar.tsx                # Main navigation (collapsible)
│   └── PlaceholderPage.tsx        # Reusable placeholder component
├── lib/
│   ├── openrouter.ts              # OpenRouter chat API client + FREE_MODELS list
│   ├── embeddings.ts              # Embedding abstraction (prompt-based or API-based via EMBEDDING_MODEL)
│   ├── vector-store.ts            # Vector store abstraction (in-memory or Pinecone, runtime-configurable)
│   ├── rag.ts                     # RAG pipeline (uses vector-store for retrieval)
│   ├── document-store.ts          # In-memory document metadata storage
│   └── utils.ts                   # Helpers (formatSize, generateId, extractText)
├── tailwind.config.ts             # Tailwind theme (warm tones)
├── tsconfig.json                  # Strict mode, @/* alias
├── next.config.js                 # Empty defaults
├── .env.example                   # Env template
└── package.json
```

---

## Routes & Pages (15 total)

### Fully Implemented (6 active pages)

| Route | Page | Status |
|---|---|---|
| `/` | Dashboard | Stats cards, quick actions to Upload/AI/Documents |
| `/ai` | AI Q&A Agent | Chat with model selector (7 free models), doc filter, source citations |
| `/upload` | Upload Documents | Drag-drop, supports .txt/.md/.csv, chunking, progress |
| `/documents` | Document Manager | List all docs, chunk count, size, date, delete |
| `/settings` | Settings | API key input (UI only), all free models listed, embedding info |
| `/scanner` | Project Scanner | Drop zone, scan button, framework detect, locator quality score, readiness score, test stats, issues list |
| `/migration` | Migration Studio | V3 header, 5 source categories (20 connectors), ZIP upload with language badges, Start Migration button wired to API |

### Partially Implemented (1 page)

| Route | Page | Issue |
|---|---|---|
| `/search` | Explorer | Basic keyword matching on doc names only — semantic search not wired |

### Placeholders (8 pages — all show icon + title + description)

| Route | Feature |
|---|---|
| `/analytics` | Usage metrics & performance |
| `/team` | Team management & roles |
| `/connectors` | External data source integration |
| `/graph` | Knowledge Graph visual |
| `/audit` | Security & compliance tracking |
| `/webhooks` | Real-time notifications |
| `/prompts` | Custom AI system prompts |

---

## API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Answer a question using RAG pipeline |
| `/api/upload` | POST | Upload file, extract text, chunk, store |
| `/api/documents` | GET | List all documents |
| `/api/documents` | DELETE | Delete a document by ID |
| `/api/migration` | POST | Process ZIP uploads + source connections, store as documents |

---

## Data Model

```typescript
interface Document {
  id: string
  name: string
  type: string
  size: number
  content: string        // Full raw text
  chunks: string[]       // Chunked segments (paragraph-aware, ~400 words, 80 word overlap)
  uploadedAt: Date
}
```

**Storage**: In-memory global `Map<string, Document>` via `globalThis.__documentStore`. Lost on server restart.

---

## OpenRouter Free Models (7 available)

| ID | Name | Notes |
|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA Nemotron 3 Super | Default, best for RAG (1M context) |
| `meta-llama/llama-3.3-70b-instruct:free` | Meta Llama 3.3 70B | Strong general purpose |
| `tencent/hy3:free` | Tencent Hy3 | 295B MoE |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | NVIDIA Nemotron 3 Ultra | 550B MoE |
| `qwen/qwen3-next-80b-a3b-instruct:free` | Qwen 3 Next 80B | Fast MoE |
| `google/gemma-4-31b-it:free` | Google Gemma 4 31B | Dense 31B |
| `openrouter/free` | Auto Free Router | Auto-picks best free model |

---

## Feature Implementation Status

- **Core RAG Flow** — Upload → Chunk → Embed → Retrieve → Answer ✅
- **UI Framework** — Sidebar, layout, routing, styling ✅
- **Dashboard** — Live stats, quick actions ✅
- **Document Upload** — Drag-drop, chunking, storage (supports .txt, .md, .csv, .docx via mammoth) ✅
- **Document Management** — List, delete, metadata ✅
- **AI Chat** — Full conversational UI, model switching, doc filtering, source citations ✅
- **Migration Studio** — Source categories, ZIP upload, API endpoint ✅
- **Project Scanner** — Framework detection, quality/readiness scores, issues ✅
- **Settings** — Model listing, API key input ✅
- **Search/Explorer** — UI exists, semantic search not wired ⚠️
- **Data Persistence** — In-memory only, no database or file storage ❌
- **Vector Store Abstraction** — In-memory (default, cosine similarity) or Pinecone runtime switch via `PINECONE_API_KEY` ✅
- **Embedding Abstraction** — Configurable via `EMBEDDING_MODEL`: `prompt` (free) or any OpenRouter embedding model ID ✅
- **Streaming** — Not implemented ❌
- **File type server-side validation** — Client-side only ❌
- **Error Boundaries** — None implemented ❌
- **react-markdown / openai packages** — Listed in package.json but unused ❌

---

## Build / Run

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

---

## Migration Studio — Reference Match

The `/migration` page was built to match [qa-rag-platform.vercel.app/migration](https://qa-rag-platform.vercel.app/migration):

- V3 badge with "20 enterprise sources · AST parsing · TypeScript validation · PR auto-generation"
- New badges: Migration History, Company Coding Standards, Project Scanner
- "Scan First" button → links to `/scanner`
- 5 expandable source categories:
  - **Git Repositories**: GitHub, GitLab, Bitbucket Cloud/Server, Azure DevOps, AWS CodeCommit, Gitea/Forgejo
  - **Local & Archive**: ZIP Upload, Local Folder
  - **Cloud Storage**: AWS S3, Azure Blob, Google Cloud Storage
  - **File Sharing**: Google Drive, OneDrive, SharePoint
  - **CI/CD Artifacts**: Jenkins, GitHub Actions, GitLab CI, TeamCity, Bamboo
- Test suite ZIP drop zone with language badges (Java, Python, C#, TypeScript, Robot, Gherkin)
- "Notify when done" checkbox, "Start Migration" button → POST to `/api/migration`
- Multi-source selection with visual check indicators

---

## Styling Conventions

Pages use **inline styles** (not Tailwind utility classes) with CSS variables from `globals.css`:
- `var(--bg)`, `var(--surface)`, `var(--border)` — backgrounds
- `var(--text)`, `var(--text-2)`, `var(--text-3)` — text colors
- `var(--accent)` / `#D97706` — amber/orange accent
- Font: Inter (Google Fonts)

Always follow this convention when adding new pages.

---

## Vercel Deployment

### Required Env Vars (set in Vercel dashboard)

```
OPENROUTER_API_KEY=sk-or-v1-...
EMBEDDING_MODEL=openai/text-embedding-3-small
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX=rag-embeddings
```

### Steps

1. Create a GitHub repo and push:
   ```bash
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com), import the repo
3. Framework preset: **Next.js** (auto-detected)
4. Add all env vars from above in Vercel's dashboard
5. Deploy — the app will be live at `https://your-app.vercel.app`

### Notes

- **No in-memory dependency** — document metadata is stored in Pinecone alongside vectors, so it persists across serverless invocations
- **File upload limit** — Vercel Hobby plan has 4.5MB body limit, sufficient for .txt/.md/.csv/.docx files
- **Serverless timeout** — Hobby: 10s, Pro: 60s. Embedding + Pinecone calls are within limits for typical usage
