# Cartoon Generator UI

A Claude-style **beige-themed** web UI for the Mom & Son cartoon video generator,
built with **Next.js 16** + React 19 + Tailwind.

The UI shows the pipeline as a **flat horizontal flow with arrows** (details on
top, pipeline below) and drives the generation **step by step with approve +
retry on every node**:

```
Script → Video → Voice → Assemble → Done
  │        │       │         │
  review  approve  approve   download
  + retry  + retry  + retry   + re-assemble
```

## Two parts

```
ui/          ← Next.js frontend (this folder) + FastAPI server
video_gen/   ← Python generation pipeline (main.py, cartoon_gen/, config.json)
```

The UI calls a FastAPI server (`ui/api_server.py`) which invokes the pipeline's
`main.py --step <script|video|voice|assemble>` mode.

## Run it

### 1. Start the API server (FastAPI)

```bash
cd ui
python api_server.py
```

Reads `ui/api_config.json` (port, host, pipeline path). Default: `http://127.0.0.1:8000`.

### 2. Start the Next.js dev server

```bash
cd ui
npm install        # first time
npm run dev        # → http://localhost:3000
```

Next.js reads the API port from `api_config.json` and rewrites `/api/*` → FastAPI.

## Flow

1. Enter topic, pick language (`en`/`hi`), duration (5/10/15/20/30s), optional **Mock mode**
2. **Start Pipeline** → creates a job
3. Each node runs independently:
   - **Script** → shows scenes for review → **Approve** or **↻ Retry Script**
   - **Video** → generates motion clips → **Approve** or **↻ Retry Video**
   - **Voice** → generates voice-over → **Approve** or **↻ Retry Voice**
   - **Assemble** → builds final mp4 → **Download** or **↻ Re-assemble**

Every node has a **Retry** button (regenerates that node only, via `--no-cache`),
and the node shows its retry count.

## Config

- `ui/api_config.json` — API port/host, pipeline path, allowed languages/durations,
  mock flag, `max_retries_per_step`. **Single source of truth for the UI.**
- `video_gen/config.json` — model choices, API key, video params (existing).

## Notes

- Real generation costs money (Seedance video). Use **Mock mode** in the UI to
  test the whole flow free.
- The API runs each step via `video_gen/main.py --step <name>`; this flag is
  additive — the full-run CLI (no `--step`) still works unchanged.
