# Audio-First Cartoon Generator

A **separate project** that generates lip-synced cartoon videos the correct way:
**generate the voice-over FIRST, then the video FROM that audio** — so the
character's lips match the actual words.

## Why this project exists (the problem it fixes)

The older `video_gen/` pipeline (Seedance) generated the video first, then we
tried to add audio afterward. Result: **Seedance generates its own random audio**
(no input audio support), so:
- Lips moved to off-topic gibberish
- The audio had nothing to do with tomatoes/whatever the topic was
- It cost real money for unusable videos

This project fixes the **order** and the **model**:
1. **Script** → free LLM (Hindi dialogue)
2. **TTS FIRST** → Edge-TTS generates the Hindi voice-over (free)
3. **Video** → Wan 2.6/2.7 (supports **audio input**) generates the scene FROM the TTS → lips sync to the real words
4. **Assemble** → concat

## The two input modes

**Mode A — Topic → Scenes**
Type a topic (or pick from the dropdown) → free LLM generates the scene-wise script.

**Mode B — My own script → Scenes**
Select "Paste my script", paste your dialogue (e.g. `Mom: Hi son, how are you?` / `Son: I'm fine!`), click **Convert my script to scenes** → the free LLM splits it into scenes (same JSON structure as Mode A).

## The step-by-step wizard (not one button)

```
Step 1: Input        → topic OR paste script → [Generate / Convert]
Step 2: Review       → see scenes → [Approve & Generate Voice] or [↻ Regenerate]
Step 3: Voice (TTS)  → Edge-TTS Hindi voice-over (free)
Step 4: Video        → pick model (Wan/Seedance), generate scene videos
Step 5: Assemble     → final mp4 → [Download]
```

Each step has its own button and waits for your approval — nothing runs silently.

## Tested end-to-end (mock mode, zero cost)
Both flows verified via the API in mock mode:
- **Topic** ("Apples keep the doctor away") → 2 Hindi scenes → voice → mock video → 10s final mp4 ✅
- **Own script** (Mom/Son carrot dialog) → converted to 2 Hindi scenes → voice → mock video → 10s final mp4 ✅

## Run it

### 1. API server (port 8001)
```bash
cd audio_first
python api_server.py
```

### 2. Next.js UI
```bash
cd audio_first/ui
npm install        # first time
npm run dev        # → http://localhost:3000
```

**IMPORTANT:** there are TWO Next.js apps in this repo — the old `ui/` (video_gen) and the new `audio_first/ui/`. They both use port 3000. Only run the new one (`audio_first/ui`).

| Model | Cost/sec | Audio input | Lip-sync |
|---|---|---|---|
| **Wan 2.6** (`alibaba/wan-2.6`) | $0.04/s | ✅ Yes | ✅ Real (lips match TTS) |
| **Wan 2.7** (`alibaba/wan-2.7`) | $0.10/s | ✅ Yes | ✅ Real (better quality) |
| **Seedance 1.5 Pro** (`bytedance/seedance-1-5-pro`) | $0.012/s | ❌ No | ❌ Its own random audio — cheap drafts only |

The UI prints the **cost estimate per scene/video** for each model before you
commit, plus a warning on models that can't lip-sync.

## Design that matters (timeouts / reliability)

- **Background job + polling**, NOT a blocking HTTP call. `POST /api/jobs`
  returns a job id immediately; the UI polls `GET /api/jobs/{id}` every 2.5s.
  This is the fix for the earlier "socket hang up" — no connection stays open
  during a 1-5 min video generation, so nothing can drop mid-payment.
- Per-step timeout: video jobs time out after `video_job_timeout_min` (20 min).
- UTF-8 output everywhere (Hindi).
- Free-model fallback chain for the script (in `config.json`).

## Files
```
audio_first/
├── config.json       ← all settings (models, costs, timeouts) — single source of truth
├── config.py         ← config loader (reads key from video_gen/config.json as fallback)
├── pipeline.py       ← script → TTS → video(audio) → assemble
├── api_server.py     ← background-job API (no blocking)
└── ui/               ← Next.js 16 + Tailwind (beige theme)
```

## Config (`config.json`)
- `video_models` — each model's id, label, `cost_per_second`, `supports_audio_input`
- `default_video_model` — `wan-2.6` (audio lip-sync, best value)
- `chat_model` + `chat_model_fallbacks` — free script LLMs, tried in order
- `tts_voice_hi` / `tts_voice_en` — Edge-TTS voices
- `video_job_timeout_min`, `poll_interval_s`, `chat_timeout_s` — reliability knobs

## Notes
- The API key is read from `video_gen/config.json` if not set in this project's
  config (single source of truth).
- **Mock mode** tests the full flow with placeholder clips — zero cost.
- See `UNDERSTANDING.md` for the full "what worked / what was scrapped / why".
