# Project Understanding & State — Mom & Son Cartoon Video Generator

> **PURPOSE**: This is the living reference for any future session. Read this
> FIRST (along with `PROJECT_CONTEXT.md`) to understand what exists, what was
> decided, and where things stand. Update it whenever the project changes.
>
> **⚠️ IMPORTANT — THE CURRENT/CORRECT PROJECT IS `audio_first/`** (audio-first
> lip-sync with Wan). The older `video_gen/` pipeline is the ORIGINAL attempt
> that had the "lips don't match audio" problem. See `audio_first/UNDERSTANDING.md`
> for the full "what worked / what was scrapped / why".

## 1. What this project is

An **end-to-end cartoon video generator** that turns a short topic (e.g.
"Why carrots are good for your eyes") into a **vertical 9:16 animated cartoon
video** in which a **Mom** character teaches her **Son** about vegetables,
fruits, and healthy foods.

The style mimics the sample video `1000+ Viral Desi Food Stories By
videobundlehub.com (2).mp4`:
- 3D Pixar-style cartoon characters with **food-themed heads** (Mom = roti head,
  Son = carrot-top head)
- Warm cinematic lighting, full body motion, talking
- Originally 2160x3840@60fps; we output **1080x1920@30fps** for cost/speed

## 2. Architecture / pipeline (OpenRouter ONLY)

```
topic
  └─► [1] script_generator (LLM)    → JSON script: scenes, dialogue, video_prompts
  ├─► [2] character_generator (img) → mom.png, son.png (cached, reused across ALL videos)
  ├─► [3] scene_video_generator     → per-scene mp4 clips (reference-to-video)
  ├─► [4] tts_generator             → per-scene voice-over (Edge-TTS, free)
  └─► [5] assembler (ffmpeg)        → concat clips + audio → final mp4
```

Each stage is **cached on disk** (scripts/, characters/, clips/, audio/) so
re-runs skip completed work and only spend money on what's missing.

## 3. Module map

### `video_gen/` — the generation pipeline (OpenRouter)
| Module | Responsibility |
|---|---|
| `cartoon_gen/config.py` | Dataclass `Config`; loads ALL values from `config.json`. No hardcoded operational values. |
| `cartoon_gen/config.json` | **THE single source of truth** — models, api_key, durations, codecs, TTS voices, flags. |
| `cartoon_gen/openrouter_client.py` | Thin stdlib HTTP client for chat/image/video/TTS. Has a **paid-call guard**. |
| `cartoon_gen/script_gen.py` | LLM topic → JSON script (EN or HI). Embeds exact dialogue into video_prompt for lip-sync. |
| `cartoon_gen/character_gen.py` | Generates/caches mom.png, son.png. Reused as reference images everywhere. |
| `cartoon_gen/scene_video.py` | One scene → one mp4 via reference-to-video (Mom+Son images as input_references). |
| `cartoon_gen/tts_gen.py` | Voice-over: **Edge-TTS** (free, Hindi voices) primary; Windows SAPI fallback. |
| `cartoon_gen/assembler.py` | ffmpeg: normalize, mux audio, concat → final mp4. |
| `cartoon_gen/pipeline.py` | Orchestrates all stages with caching, dry-run, mock mode. |
| `cartoon_gen/fake_client.py` | `FakeOpenRouterClient` — offline E2E test (no network/paid calls). |
| `cartoon_gen/topics.py` | 90 built-in teaching topics (expandable list). |
| `main.py` | CLI entry point for the pipeline. |
| `test_single_scene.py` | Generate ONE real paid 5s scene (cheap test of the video flow). |

### `ui/` — the web UI
| File | Role |
|---|---|
| `api_server.py` | FastAPI server wrapping the pipeline **step by step** (start / script / video / voice / assemble / video serve). Config in `ui/api_config.json`. |
| `api_config.json` | UI/API config: port, host, pipeline path, allowed languages/durations, mock flag, max_retries. |
| `app/page.tsx` | Main UI: flat horizontal pipeline (arrows) + details panel. Per-node Generate/Approve/Retry. |
| `app/layout.tsx`, `globals.css` | Claude-style beige theme. |
| `app/not-found.tsx` | 404 page (Next 16 requires it). |
| `next.config.mjs` | Reads API port from api_config.json; rewrites `/api/*` → FastAPI. |
| `tailwind.config.ts` | Beige cream/accent palette. |
| `package.json` | **Next.js 16** + React 19 + Tailwind. |

### Step-by-step flow (UI + API)
- `POST /api/start` → creates job (topic/language/duration/mock)
- `POST /api/{job}/script` → runs `main.py --step script`, returns scenes for review
- `POST /api/{job}/video` → `--step video`, returns clip paths
- `POST /api/{job}/voice` → `--step voice`, returns audio paths
- `POST /api/{job}/assemble` → `--step assemble`, returns final mp4
- Each call accepts `force_retry` (→ `--no-cache`) so the user can **retry any node**
- Job state (step, retries, files) lives in the API server's in-memory store, backed
  by the pipeline's on-disk cache
- `video_gen/main.py` gained an **additive** `--step <script|video|voice|assemble>`
  flag; full-run (no `--step`) still works unchanged

## 4. Data flow & key decisions

### Config: `config.json` is the ONLY source of truth
- All settings (models, api_key, video params, TTS voices, flags) live in
  `config.json`. `config.py` has empty-string defaults only; `Config.load()`
  mutates the shared `cfg` singleton at startup so all modules see file values.
- **NO hardcoding in code** (user requirement). ffmpeg codecs/presets/crfs,
  timeouts, mock tone — all in config.json.
- `api_key` comes ONLY from config.json (no env fallback).
- **Never use `openrouter/auto` or router modes** — always explicit model slugs.

### Models (current, in config.json)
| Role | Model | Cost |
|---|---|---|
| Script LLM | `nvidia/nemotron-3-super-120b-a12b:free` | Free |
| Character images | `bytedance-seed/seedream-4.5` | ~$0.04/image |
| Scene video | `bytedance/seedance-1-5-pro` | ~$0.023/s (≈$0.26 per 5s scene) |
| Voice-over | Edge-TTS `hi-IN-SwaraNeural` / `en-US-AriaNeural` | Free, no API key |

### Paid-call safety guard
`allow_paid_calls` (config.json, default false) — when false, the client
**blocks** `/images/generations`, `/videos`, `/audio/speech`. Only the free
chat model runs. Set true only when ready to spend.

### Lip-sync & audio (IMPORTANT lesson learned)
- Seedance (video model) generates **its own audio** and lip-syncs to it.
- Previously the assembler **dropped** clip audio (`-an`) and tried to overlay
  separate TTS → **lips never matched audio**.
- **Fix**: `keep_clip_audio: true` (config.json) — assembler now **keeps each
  clip's native audio**, so lips ↔ audio are consistent.
- **Second fix**: to make the speech match, `script_gen.py` embeds the **exact
  dialogue line (in quotes) into the video_prompt**, so the video model speaks
  the actual line. Requires regenerating scenes to take effect.

### Subtitles
- **REMOVED** (user request). No subtitle functionality in code or config.

### Language
- `--lang hi` produces Hindi dialogue, Hindi TTS (Edge voice), Devanagari output.
- `language` in config.json defaults to `hi`.
- Windows console forced UTF-8 in main.py so Devanagari prints.

## 5. Test modes (no money)

| Mode | Command | What it does |
|---|---|---|
| Dry-run | `python main.py --topic "..." --dry-run` | Prints plan; NO API calls |
| Mock | `python main.py --topic "..." --mock` | Uses ffmpeg placeholder clips/tones; real assembly, no paid API |
| **Fake E2E** | `python -m cartoon_gen.fake_client` | Full pipeline with FakeOpenRouterClient; REAL files, ZERO network. **Verified working.** |
| Single scene | `python test_single_scene.py` | ONE real paid 5s scene (~$0.26) to test video flow |

## 6. Current status / what's been done

- [x] Full pipeline built & compiles
- [x] Hindi support (dialogue, Edge-TTS voice, Devanagari output)
- [x] Paid-call safety guard
- [x] Config-file single source of truth, no hardcoding
- [x] Fake offline E2E test verified (produces valid 1080x1920 mp4)
- [x] Real video generated: `output/hi-a3aff97ada.mp4` (topic: गजर आख क लए अचछ हत ह)
- [x] Lip-sync fix: `keep_clip_audio=true`; script embeds dialogue in prompt
- [x] **Subtitles removed** (user requested)
- [x] **Puppet + fal.ai pipelines DELETED** (user: "only the OpenRouter pipeline")
- [ ] Regenerate scenes with new "dialogue in prompt" logic to confirm lips match
      (NOT YET VERIFIED by user)

## 7. How to run

```bash
# --- pipeline (video_gen/) ---
# real full video (paid): free LLM script + paid Seedance scenes + free Edge-TTS
python main.py --topic "गजर आख क लए अचछ हत ह" --lang hi --duration 5

# cheap single-scene video test (paid ~$0.26)
python test_single_scene.py

# offline E2E (free)
python -m cartoon_gen.fake_client

# --- UI (ui/) ---
# 1. start API server
python api_server.py          # reads ui/api_config.json, http://127.0.0.1:8000

# 2. start Next.js dev server (Next 16)
npm install                    # first time
npm run dev                    # http://localhost:3000
```

Pipeline is run from `video_gen/`; UI from `ui/`. The UI drives the pipeline
per-node via `main.py --step <script|video|voice|assemble>` with approve/retry.

## 8. Cost reality check (approx, per 5s scene @720p)
- Seedance scene video: ~$0.26
- Script LLM (free): $0
- Character images: already cached
- Edge-TTS: $0
- So a 2-scene 10s video ≈ **~$0.52** in video costs.
