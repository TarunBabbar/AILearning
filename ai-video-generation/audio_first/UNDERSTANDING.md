# Audio-First Project — Understanding & History

> Living reference for this project. Read before resuming work.

## Goal
Lip-synced Mom & Son cartoon videos where the character's mouth matches the
actual spoken (Hindi) words, with **transparent cost shown in the UI**.

## The core insight (what we learned the hard way)

**Order matters: audio FIRST, then video.**

- The older `video_gen/` pipeline generated video with Seedance, which
  **cannot accept input audio** — it invents its own speech. Result: lips
  moving to off-topic gibberish, and we paid for it.
- **Wan 2.6/2.7 accept audio input** (verified via OpenRouter model metadata:
  `allowed_passthrough_parameters` includes `audio`). So Wan can lip-sync to
  our Edge-TTS audio.

## What worked / what was scrapped / why

### ✅ WORKED — kept
| Thing | Why |
|---|---|
| **Edge-TTS (free Hindi voice)** | Reliable, free, no API key. Used for all voice-over. |
| **Free chat models with fallback chain** | `nvidia/nemotron-3-super-120b-a12b:free` + fallbacks. Script gen costs $0. |
| **Wan 2.6 / 2.7** | Support audio input → real lip-sync. The correct model for this goal. |
| **Background job + polling API** | `POST /api/jobs` returns instantly, UI polls. No blocking connection = no socket hang mid-payment. |
| **UTF-8 everywhere** | Hindi/Devanagari survives subprocess output (was cp1252 crash). |
| **Mock mode** | Full-flow test with placeholder clips, zero cost. |
| **Config-driven everything** | All models/costs/timeouts in `config.json`. No hardcoding. |

### ❌ SCRAPPED — do not use
| Thing | Why scrapped |
|---|---|
| **Seedance 1.5 Pro for final videos** | No audio input → random/off-topic speech, lips never match. Only OK as a cheap *draft* model. |
| **Video-then-audio order** (old pipeline) | Produced the "lips don't match" disaster. TTS added after baked-in mouth movement can never sync. |
| **Blocking HTTP for video steps** | The "socket hang up / 500" bug — connection dropped during 1-5 min video gen; user paid, UI showed failure. |
| **`google/lyria-3-pro-preview` TTS** | Doesn't exist on OpenRouter `/audio/speech` → 400. |
| **Windows SAPI for Hindi** | No Hindi voice installed; cp1252 can't encode Devanagari. |
| **Puppet pipeline (`puppet_gen/`)** | Static image + fake mouth overlay looked broken; not real motion. Deleted. |
| **fal.ai** | User account had **0 credits** (`User is locked. Exhausted balance`) → unusable. Deleted. |
| **`openrouter/auto` / router mode** | User requirement: never use auto; always explicit model slugs. |

## The reliability requirements (user's repeated demands)
1. **Never cost money by accident** — mock mode first, show cost estimates in UI before generating.
2. **No connection can drop mid-payment** — background job + polling, per-step timeout.
3. **No hardcoding** — everything in config.json.
4. **Docs kept current** — what worked, what failed, why.

## Current status
- ✅ Full audio-first pipeline built + compiles
- ✅ **Stepwise wizard**: input mode (topic OR own script) → review → voice → video → assemble → download
- ✅ **convert_script_to_scenes**: user's raw dialogue → scene JSON via free LLM
- ✅ Background-job API + polling verified with **mock** jobs end-to-end
- ✅ **Both scenarios TESTED end-to-end in mock mode (zero cost):**
  - Topic "Apples keep the doctor away" → 2 Hindi scenes → voice → mock video → 10s final ✅
  - Own script (Mom/Son carrot dialog) → converted to 2 Hindi scenes → voice → mock video → 10s final ✅
- ⏳ **NOT yet tested with a real (paid) Wan 2.6 call** — needs one paid run to confirm Wan's audio passthrough format is accepted
- ⏳ The Wan audio passthrough (`provider.options.wan.parameters.audio`) is built per OpenRouter docs but unverified against the live API

## API endpoints (stepwise)
- `POST /api/jobs` → create job (topic OR script_text + input_mode). Generates script, stops at `review`.
- `GET /api/jobs/{id}` → status (pending/running/review/ready/done/error) + step + script + result
- `POST /api/jobs/{id}/tts` → run voice step (free Edge-TTS) → status `ready`
- `POST /api/jobs/{id}/video` → run video step (mock or paid) → status `ready`
- `POST /api/jobs/{id}/assemble` → build final mp4 → status `done`
- `GET /api/video/{file}` → serve/download final video
- `GET /api/models` → model list with costs (for UI selector)
- `GET /api/topics` → built-in topics

## Job statuses (UI drives off these)
- `review` — script generated/converted, waiting for user approval
- `ready` — a step finished (tts/video), waiting for user to approve the next
- `running` — a step is executing in the background thread
- `done` / `error` — terminal

## Known fix applied during testing
- Slug for own-script mode used the full script text → absurd filenames. Fixed to a short `script-<hash8>` slug.
- Steps left status at `running` after finishing → added `ready` status so the UI can show the next approve gate.

## Next steps (when user is ready to spend ~$0.40)
1. Run one real job with Wan 2.6 (mock off) — verify the audio input is accepted and lips sync
2. If the `provider.options` audio format is rejected, adjust to Wan's exact expected field
3. Listen to the output; confirm audio = script dialogue and lips match
4. Then scale to more topics / longer durations
