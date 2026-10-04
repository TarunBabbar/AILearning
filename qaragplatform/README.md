# QA RAG Platform

A single-page Retrieval-Augmented Generation (RAG) demo: upload a document, it is chunked and embedded, the vectors are stored in Pinecone, and an LLM answers questions strictly from the retrieved chunks — with the sources cited. Built with Next.js 14, OpenRouter (embeddings + LLM) and Pinecone.

## How it works

Everything is on one page — no navigation:

1. **Upload** — drag in a PDF, DOCX, XLSX/XLS, CSV or text file
2. **Extract & chunk** — the text is pulled out and split into overlapping pieces
3. **Embed** — each chunk is turned into a vector via OpenRouter
4. **Store** — the vectors are upserted into Pinecone
5. **Retrieve** — your question is embedded and the closest chunks are fetched
6. **Answer** — an OpenRouter LLM answers from those chunks only, citing them

## Features

- **Any common document** — PDF, DOCX, XLSX/XLS, CSV, TXT, MD, JSON, HTML, XML, YAML, LOG, RTF
- **Grounded answers** — the model answers only from retrieved chunks, and expands to show the sources it used
- **Free LLM choice** — pick from the free OpenRouter models in the dropdown; the first entry is the default
- **Real vector store** — Pinecone (1536-dim, cosine), with an in-memory fallback when no key is set
- **Two numbers that matter** — documents and total chunks

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 7 (strict) |
| UI | React 19 + Tailwind CSS 4, inline styles with CSS variables |
| Icons | Lucide React |
| Embeddings + LLM | OpenRouter API |
| Vector Store | Pinecone (in-memory fallback) |
| Document parsing | pdf-parse 2 (PDF), mammoth (DOCX), xlsx (XLSX/XLS) |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 22.3+ (required by pdf-parse 2)
- An [OpenRouter](https://openrouter.ai) API key (free tier works)

### Installation

```bash
git clone https://github.com/your-username/qaragplatform.git
cd qaragplatform
npm install
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
EMBEDDING_MODEL=prompt
```

For persistent storage across restarts (recommended for production):

```env
EMBEDDING_MODEL=openai/text-embedding-3-small
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX=rag-embeddings
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required for all AI features |
| `EMBEDDING_MODEL` | `prompt` | `prompt` (free) or any OpenRouter embedding model ID |
| `PINECONE_API_KEY` | — | Set to use Pinecone instead of in-memory vector store |
| `PINECONE_INDEX` | `rag-embeddings` | Pinecone index name (dimension 1536, cosine metric) |
| Chat model | Qwen 3.8 27B | The list lives in `lib/openrouter.ts`; the **first entry is the default**, so no env var is needed |

## Project Structure

```
app/
  page.tsx          # The whole app: header + flow + stats + upload + ask
  layout.tsx        # Shell
  api/
    upload/         # POST a file -> extract, chunk, embed, upsert
    chat/           # POST a question -> retrieve, answer with sources
    documents/      # GET the indexed documents (used for the stats)
components/
  UploadPanel.tsx   # Drop zone, file list, indexing results
  AskPanel.tsx      # Chat with the model dropdown and per-answer sources
lib/
  openrouter.ts     # Chat completions + the free-model list (first = default)
  embeddings.ts     # Embedding abstraction (API-based or prompt-based)
  extract.ts        # One extractor per file format
  formats.ts        # Supported extensions + <input accept>
  vector-store.ts   # Pinecone or in-memory vector store
  rag.ts            # Chunking, retrieval, answer assembly
  document-store.ts # Document metadata
```

## License

Tarun Kumar Babbar License
