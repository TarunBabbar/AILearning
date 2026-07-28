# QA Interview Preparation Kit

A RAG (Retrieval-Augmented Generation) application for preparing QA interview questions. PDF/DOCX documents are indexed into a vector database (Pinecone), and you can ask questions or browse topics — answers are grounded in your uploaded knowledge base.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 14 (App Router)                  │
│                                                             │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────┐          │
│  │Dashboard │  │QA Assistant │  │ Questions     │          │
│  │  /       │  │/qa-assistant│  │ /questions    │          │
│  └────┬─────┘  └──────┬──────┘  └───────┬───────┘          │
│       │               │                 │                   │
│  ┌────┴───────────────┴─────────────────┴────────┐          │
│  │              API Routes                        │          │
│  │  POST /api/chat    GET /api/documents          │          │
│  │  GET  /api/questions?mode=file|ai              │          │
│  └──────────────────────┬─────────────────────────┘          │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────┐           │
│  │              RAG Pipeline                      │           │
│  │                                                 │           │
│  │  ┌────────────┐    ┌───────────────────┐       │           │
│  │  │ Embeddings │    │   Pinecone        │       │           │
│  │  │ (OpenRouter│    │   (production)    │       │           │
│  │  │  API)      │    │   ┌─────────────┐│       │           │
│  │  └─────┬──────┘    │   │ Metadata    ││       │           │
│  │        │           │   │ sidecar     ││       │           │
│  │        ▼           │   │(pinecone-   ││       │           │
│  │  ┌──────────┐      │   │ index.json) ││       │           │
│  │  │ LLM Chat │      │   └─────────────┘│       │           │
│  │  │(OpenRouter│     └───────────────────┘       │           │
│  │  └──────────┘                                  │           │
│  └────────────────────────────────────────────────────────────┘
└────────────────────────────────────────────────────────────────┘
```

### RAG Flow

```
User question
    │
    ▼
POST /api/chat { question }
    │
    ├─ (1) Embed question via OpenRouter → vector
    ├─ (2) Pinecone similarity search → top 5 chunks
    ├─ (3) Build context from retrieved chunks
    └─ (4) Streaming LLM answer + source citations
```

### Data Indexing (Seed)

```
PDF/DOCX in docs/ folder
    │
    ├─ parsePDF() / parseDOCX() → raw text
    ├─ extractQAPairs() via LLM (with retries) → [{question, answer}, ...]
    ├─ getEmbeddingsBatch() via OpenRouter → vectors
    └─ Pinecone upsert() → stored in cloud index
        └─ Sidecar file (pinecone_data/pinecone-index.json) tracks
           document names & topics for dashboard listing
```

### Topic Organization

The Questions page supports two topic views:

| Mode | Description | Backend |
|------|-------------|---------|
| **By File** (default) | Topics guessed from filename (e.g. "Selenium & TestNG") | Pinecone sidecar index |
| **Refined** | LLM-classified topics across all Q&A pairs (e.g. "Selenium WebDriver", "API Testing Basics") | `pinecone_data/ai-topics.json` (git-tracked) |

Refined topics are computed once via LLM and persisted to `pinecone_data/ai-topics.json` — switching between modes never re-calls the LLM. The file is checked into git so it works on Vercel out of the box.

## Prerequisites

- Node.js >= 18
- OpenRouter API key ([free tier available](https://openrouter.ai/keys))
- Pinecone API key ([free tier available](https://www.pinecone.io/))
- PDF or DOCX interview documents placed in `docs/` folder

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
# === OpenRouter (required) ===
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# === LLM Model (configurable — free model shown) ===
LLM_MODEL=deepseek/deepseek-v4-flash

# === Embeddings ===
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=2048

# === Vector DB ===
VECTOR_DB=pinecone
DATA_PATH=./pinecone_data

# === Pinecone ===
PINECONE_API_KEY=pcsk-your-key-here
PINECONE_INDEX_NAME=qa-interview
```

### 3. Seed the knowledge base

Place your PDF or DOCX files in the `docs/` folder, then:

```bash
npm run seed
```

This processes each file:
1. Extracts raw text (PDF via pdf-parse, DOCX via mammoth)
2. Calls LLM to extract clean Q&A pairs as JSON (retries up to 3 times on failure)
3. Generates vector embeddings via OpenRouter
4. Stores in Pinecone + writes local metadata sidecar

**Filter to specific files** (skips full reset, appends data):

```bash
npm run seed -- --files=api
npm run seed -- --files="api,database"
npm run seed -- --files="STS Learning_API Testing.docx"
```

> Run `npm run seed` without `--files` to do a full re-seed (wipes existing data first).

### 4. Rebuild local metadata index (if sidecar is lost)

If you switch to Pinecone with existing data and the `pinecone-index.json` sidecar is missing:

```bash
npx tsx scripts/rebuild-index.ts
```

This scans all vectors in Pinecone via `listPaginated()` and `fetch()`, then writes the sidecar.

### 5. Generate refined topics (optional, one-time)

Classify all Q&A pairs into smart topic groups via LLM:

```bash
npx tsx scripts/classify-topics.ts
```

This saves the result to `pinecone_data/ai-topics.json` (git-tracked). The app works fine without it — you just won't have the Refined topics view until you run it.

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Overview stats (documents, Q&A pairs, topics) |
| **QA Assistant** | `/qa-assistant` | Streaming chat — ask questions, get RAG-grounded answers |
| **Questions** | `/questions` | Browse Q&A by topic — toggle between **By File** and **Refined** views |

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts             # POST — streaming RAG chat
│   │   ├── documents/route.ts        # GET — document/topic stats
│   │   └── questions/route.ts        # GET — topics or per-topic Q&A (supports mode=file|ai)
│   ├── qa-assistant/page.tsx         # Chat UI
│   ├── questions/page.tsx            # Browse Q&A by topic with By File / Refined toggle
│   ├── layout.tsx                    # Root layout with sidebar
│   └── page.tsx                      # Dashboard with stats
├── components/ui/
│   └── Sidebar.tsx                   # Navigation sidebar
├── lib/
│   ├── config.ts                     # Env config getter
│   ├── openrouter.ts                 # OpenAI-compatible client
│   └── rag/
│       ├── vector-store.ts                # IVectorStore interface
│       ├── vector-store-factory.ts        # Factory: selects store by config
│       ├── chroma-store.ts                # ChromaDB HTTP client
│       ├── pinecone-store.ts              # Pinecone + local metadata sidecar
│       ├── local-store.ts                 # NDJSON file store (fallback)
│       ├── embeddings.ts                  # Text → vector via OpenRouter
│       ├── document-loader.ts             # PDF/DOCX parsing
│       ├── qa-extractor.ts                # LLM extraction with retries + JSON repair
│       ├── rag-chain.ts                   # Full RAG pipeline
│       ├── topic-organizer.ts             # LLM-based topic classification
│       └── topic-store.ts                 # Persistent storage (KV / file) for AI topics
├── scripts/
│   ├── seed.ts                        # Batch indexer with --files filter
│   ├── rebuild-index.ts               # Rebuild Pinecone metadata sidecar
│   ├── inspect.ts                     # Inspect stored data
│   └── peek.ts / peek-docx.ts         # Quick document inspection
├── docs/                              # Place PDF/DOCX interview docs here
├── pinecone_data/                     # Local data files (gitignored)
│   ├── pinecone-index.json            # Local metadata index for Pinecone
│   └── ai-topics.json                 # Cached AI topic classification (local fallback)
├── styles/globals.css                 # Tailwind + custom styles
└── .env.local                         # Environment config (gitignored)
```

## Q&A Extraction

During `npm run seed`, each file is processed through `lib/rag/qa-extractor.ts`:

1. LLM call (using `LLM_MODEL` from env) extracts clean `[{question, answer}]` pairs as JSON
2. **Retries**: up to 3 attempts with exponential backoff (2s → 4s → 8s) on network failures
3. **JSON repair**: multi-stage handling — direct parse → unescaped quote fix → truncated JSON repair (braces/array balancing)
4. **Graceful empty**: returns empty array `[]` instead of throwing when a document has no Q&A format
5. No fallback — if all retries fail, the file is skipped

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter endpoint |
| `LLM_MODEL` | No | `google/gemma-4-26b-a4b-it:free` | Model for chat + Q&A extraction |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model |
| `EMBEDDING_DIMENSIONS` | No | `2048` | Must match embedding model's output dims |
| `VECTOR_DB` | No | `chromadb` | Vector store: `chromadb`, `pinecone`, or `local` |
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB server URL (only for `chromadb`) |
| `DATA_PATH` | No | `./pinecone_data` | Local data path (sidecars, fallbacks) |
| `PINECONE_API_KEY` | Depends | — | Required if `VECTOR_DB=pinecone` |
| `PINECONE_INDEX_NAME` | No | `qa-interview` | Pinecone index name |

## Key Commands

```bash
npm run dev                              # Start dev server on :3000
npm run build                            # Production build
npm run seed                             # Index all PDFs from docs/ (wipes + rebuilds)
npm run seed -- --files=api              # Index only files matching "api"
npx tsx scripts/rebuild-index.ts         # Rebuild Pinecone metadata sidecar from existing data
npm run lint                             # Run ESLint
```

## Tech Stack

- **Framework:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Vector DB:** Pinecone (production) / ChromaDB / Local NDJSON
- **LLM:** OpenRouter (configurable model — default: DeepSeek V4 Flash)
- **Embeddings:** OpenRouter API (default: OpenAI text-embedding-3-small)
- **PDF/DOCX Parsing:** pdf-parse (pdf.js) / mammoth (DOCX)
- **Persistence:** Vercel KV (AI topics on Vercel), local file sidecars (development)

## Data Persistence

| Data | Location | Persists? |
|------|----------|-----------|
| Vector embeddings | Pinecone cloud index | Yes |
| Metadata sidecar (docs + topics) | `pinecone_data/pinecone-index.json` | Yes — file on disk |
| Refined topics | `pinecone_data/ai-topics.json` | Yes — git-tracked (works on Vercel) |
| Raw PDF/DOCX documents | `docs/` folder | Yes — git-tracked |
| Environment secrets | `.env.local` | Yes — gitignored |

## Deploying to Vercel

1. Push to GitHub and import into Vercel
2. Add environment variables from `.env.local` in Vercel project settings
3. `pinecone_data/ai-topics.json` is git-tracked so refined topics work out of the box
4. Deploy

## Troubleshooting

### Pinecone query fails with 500 (Questions page)

Check that `EMBEDDING_DIMENSIONS` in `.env.local` matches the dimension your Pinecone index was created with. The `getQuestionsByTopic` method uses this config value for the query vector.

### Pinecone metadata sidecar missing

If the dashboard shows 0 topics but data exists in Pinecone, run:

```bash
npx tsx scripts/rebuild-index.ts
```

### Seed fails with network errors

The extractor now retries up to 3 times with backoff. If a file consistently fails, skip it with `--files` filter and process it separately.

### Seed is slow

The `LLM_MODEL` determines Q&A extraction speed. Free models may be rate-limited. `deepseek/deepseek-v4-flash` offers a good balance of speed and quality.
