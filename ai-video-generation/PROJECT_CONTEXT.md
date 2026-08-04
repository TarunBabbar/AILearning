# Mom & Son Cartoon Video Generator — Project Context

> **PURPOSE OF THIS FILE**: Persistent memory for future coding sessions. Read this first
> whenever resuming work on this project.
>
> **ALSO READ**: `UNDERSTANDING.md` — the detailed, living project-state reference
> (architecture, decisions, models, lip-sync lesson, current status, next steps).
> Keep both files updated as the project evolves.
>
> **OPENROUTER-ONLY**: `video_gen/` (Python pipeline) + `ui/` (Next.js UI).
> Puppet + fal.ai pipelines were deleted (user decision).

## What we are building

An **end-to-end animated cartoon video generator** that produces short (start 10s, later
30s+) **vertical (9:16)** videos of a **Mom character teaching her Son character** about
vegetables, fruits, and healthy foods — in the style of the sample video
`1000+ Viral Desi Food Stories By videobundlehub.com (2).mp4` (3D Pixar-like cartoon,
warm lighting, characters with food-themed heads, talking, gentle camera motion).

## The "stack" / architecture

Everything runs through **OpenRouter's unified video/chat/image/TTS APIs** so we have ONE
API key and can swap models by changing a string in config.

Pipeline (each stage = one module):

```
topic
  └─► [1] script_generator    LLM (e.g. openai/gpt-4.1-mini / cheap model)
        │                       → structured JSON: scene list, dialogue lines,
        │                         narration, per-scene video prompts
  ├─► [2] character_generator  image model (flux / nano-banana)
  │       │                     → Mom.png, Son.png (consistent 3D cartoon characters)
  ├─► [3] scene_video_generator video model (seedance-1.5-pro or similar)
  │       │                     → per-scene mp4 clips via reference-to-video
  ├─► [4] tts_generator        TTS model (dialogue voice-over for Mom/Son)
  │       │                     → per-scene audio
  └─► [5] assembler            ffmpeg
          │                     → concat clips, mux audio, add subtitles, normalize
          └─► final .mp4 (vertical, ~10s)
```

## Key facts learned about the target style (from sample video analysis)

- 2160x3840 (9:16 vertical), 60fps, HEVC. ~35s sample.
- 3D Pixar-style cartoon characters with **food-shaped heads**.
- Full motion: talking, gesturing, holding objects. Warm cinematic lighting.
- We will output **1080x1920 (9:16)** for cost/speed; upscale later if needed.

## Current pricing intelligence (OpenRouter video models, ~Aug 2026)

Cheapest → most expensive per second:
- `bytedance/seedance-1-5-pro` — **$0.023/s** — multi-lang lip-sync, multi-char dialogue,
  character consistency across shots. **PRIMARY RECOMMENDATION.**
- `google/veo-3.1-lite` — $0.05/s
- `x-ai/grok-imagine-video` — $0.05/s (7-image reference = great for character consistency)
- `bytedance/seedance-2.0-fast` — $0.054/s
- `bytedance/seedance-2.0` — $0.067/s
- `x-ai/grok-imagine-video-1.5` — $0.08/s
- `google/veo-3.1-fast` — $0.10/s
- `minimax/hailuo-3` — $0.13/s
- `kwaivgi/kling-v3.0-pro` — $0.168/s
- `google/veo-3.1` — $0.40/s
- `openai/sora-2-pro` — available

## API mechanics (OpenRouter)

- **Video**: `POST /api/v1/videos` with `{model, prompt, duration, resolution,
  aspect_ratio, frame_images[], input_references[], generate_audio}` → job id, then poll
  `GET /api/v1/videos/{jobId}` until `completed`, download from `unsigned_urls[0]`.
  - `input_references` = style/content reference images (reference-to-video) — use for
    keeping Mom/Son consistent.
  - `frame_images` (first_frame/last_frame) = exact frame control (image-to-video).
  - Webhook/callback_url supported. NOT eligible for ZDR.
  - Resolutions: 480p/720p/768p/1080p/1K/2K/4K. Ratios include 9:16.
- **Chat** (script gen): standard `POST /api/v1/chat/completions`.
- **Images**: `POST /api/v1/images/generations` (flux, nano-banana, etc.).
- **TTS**: `POST /api/v1/audio/speech` (OpenRouter TTS models; also "text-to-speech"
  collection).

## Decisions / defaults (current)

- Language: **Python 3.13** (available at `python`). No external deps if possible; use
  stdlib `urllib`/`json` for HTTP, `subprocess` for ffmpeg.
- ffmpeg: `C:\ffmpeg\bin\ffmpeg.exe` (on PATH as `ffmpeg`).
- Project root: `C:\tarun\cartoons` (this .md lives here).
- **CONFIG FILE IS THE SINGLE SOURCE OF TRUTH**: all settings live in `config.json`
  (models, durations, language, api_key, etc.). `config.py` has matching fallback
  defaults only. The user edits `config.json`; there is NO env-var fallback for
  api_key anymore (it must be put in `config.json`).
- **NO `openrouter/auto` or router modes — always use an explicit model slug.**
- Script (chat) model = `nvidia/nemotron-3-super-120b-a12b:free` (free tier).
- Character reference images: generated once, cached in `characters/`, reused across
  videos for consistency.
- Output: 1080x1920 @ 30fps (cheaper/faster than 4K60; fine for social shorts).
- Initial target duration: **10 seconds** per video (~2 scenes). Then scale to 30s+.

## Environment (Windows)

- Windows (cmd / PowerShell). Use `python` for scripts. `%VAR%` expansion is fragile in
  this shell — prefer PowerShell `$env:` or explicit args.
- OpenRouter API key is in the environment (`OPENROUTER_API_KEY`).

## Current todos / next steps

### DONE (build complete, not live-tested)
- [x] Scaffold project: `cartoon_gen/` package + `main.py` CLI
- [x] `config.py` — all tunables (models, sizes, durations, caching)
- [x] `topics.py` — 90 built-in Mom/Son teaching topics (expandable)
- [x] `openrouter_client.py` — chat/image/video/TTS client (stdlib only)
- [x] `script_gen.py` — topic → JSON scenes via LLM (EN or HI)
- [x] `character_gen.py` — mom.png/son.png cached reference images
- [x] `scene_video.py` — reference-to-video per-scene clips
- [x] `tts_gen.py` — OpenRouter TTS w/ Windows SAPI fallback (Hindi voice lookup)
- [x] `assembler.py` — ffmpeg normalize/mux/.ass subtitle/concat (libass handles Devanagari)
- [x] `pipeline.py` + `main.py` — orchestration, caching, dry-run, CLI
- [x] **HINDI SUPPORT**: `--lang hi` produces Devanagari dialogue + subtitles
      (libass .ass, not drawtext) + Hindi voice. Windows stdout forced UTF-8.
- [x] Build verified: all modules compile + import; dry-run flows all 5 stages
      (10s→2 scenes, 30s→6 scenes). NO live API calls were made after the
      character images were generated.

### User will test
- Run `python main.py --topic "..."` for real (costs money) — user explicitly
  said THEY will test the full flow.

### FAKE/OFFLINE E2E TEST (no API calls, free)
- `python -m cartoon_gen.fake_client` runs the ENTIRE pipeline with a
  `FakeOpenRouterClient` that stubs chat/image/video/TTS responses. It produces
  REAL files (real ffmpeg clips + audio + final mp4 with burned subtitles) with
  ZERO network calls. Verified working (blue test-pattern frames + yellow
  subtitles render correctly at 1080x1920@30fps).
- Fake client: `cartoon_gen/fake_client.py` (subclasses OpenRouterClient, overrides
  network methods with deterministic fakes).

### Paid-call safety guard
- `config.json` `allow_paid_calls` (default `false`) — when false, the client
  BLOCKS `/images/generations`, `/videos`, `/audio/speech` (paid endpoints).
  Only the chat model (free) is allowed. Set to `true` only when ready to spend.
- `api_key` lives ONLY in `config.json` (no env fallback).

### Next (future, when user returns)
- Verify a real 10s output video; fix any ffmpeg/assembler issues from real clips.
- Scale to 30s+ (already works via `--duration`).
- Optionally add: music bed, outro card, batch mode over many topics,
  voice cloning for Mom/Son, Hindi narration option.
