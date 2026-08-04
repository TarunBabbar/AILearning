# Mom & Son Cartoon Video Generator

End-to-end pipeline that turns a topic (e.g. "Why carrots are good for your
eyes") into a vertical 9:16 animated cartoon video where **Mom** teaches her
**Son** about vegetables, fruits and healthy foods — 3D Pixar-style characters
with food-themed heads, matching the style of the sample video.

> **New here? Read `UNDERSTANDING.md` first** — it's the full project state,
> decisions, and current status.

## How it works

```
topic
  └─► script generator (LLM)      → JSON: scenes, dialogue, video prompts
  ├─► character generator (image) → mom.png, son.png (cached, reused everywhere)
  ├─► scene video generator       → per-scene mp4 (reference-to-video, keeps native lip-synced audio)
  ├─► TTS (Edge-TTS, free)        → per-scene voice-over (Hindi/English voices)
  └─► ffmpeg assembler            → final vertical mp4 + burned .ass subtitles
```

All model calls go through **OpenRouter** for script/images/video, and
**Edge-TTS** (free, no key) for voice-over. Every setting lives in
**`config.json`** — there are **no hardcoded values in code**.

## Requirements

- Python 3.10+
- ffmpeg + ffprobe on PATH (tested with `C:\ffmpeg\bin`)
- `edge-tts` (install once: `pip install edge-tts`) for voice-over
- Copy config templates before first run:
  ```bash
  cp video_gen/config.json.example video_gen/config.json
  cp audio_first/config.json.example audio_first/config.json   # audio-first pipeline
  cp ui/api_config.json.example ui/api_config.json             # web UI API server
  ```
- Set `OPENROUTER_API_KEY` or edit `api_key` in `video_gen/config.json` (local only, gitignored)
- API key: set `OPENROUTER_API_KEY` in the environment **or** `api_key` in `video_gen/config.json`
  (copy from `config.json.example` — never commit real keys)
- Set `"allow_paid_calls": true` in `config.json` only when ready to spend

## Usage

```bash
# list the 90+ built-in topics
python main.py --list-topics

# generate a 10s video (default)
python main.py --topic "Why carrots are good for your eyes"

# 10s HINDI video (Devanagari dialogue, Hindi Edge-TTS voice, Hindi subtitles)
python main.py --topic "गाजर आँखों के लिए अच्छे होते हैं" --lang hi

# 5s video
python main.py --topic "गजर आख क लए अचछ हत ह" --lang hi --duration 5

# 30s video
python main.py --topic "Bananas give you energy" --duration 30

# preview WITHOUT spending (no API calls)
python main.py --topic "Apples keep the doctor away" --dry-run

# offline E2E test with FAKE API responses (free, no network)
python -m cartoon_gen.fake_client

# cheap real single-scene test (paid, ~$0.26)
python test_single_scene.py
```

## Output layout

```
config.json                     ← THE config file (models, api_key, durations, TTS, flags)
output/<slug>.mp4               ← final video (keeps video-model lip-synced audio)
characters/mom.png, son.png     ← character reference images (reused across videos)
clips/<slug>_sceneNN.mp4        ← per-scene animated clips (with native audio)
audio/<slug>_sceneNN.mp3        ← per-scene Edge-TTS voice-over
scripts/<slug>.json             ← generated scene script (dialogue, subtitles, prompts)
subtitles/                      ← (reserved)
```

## Config highlights (`config.json`)

| Key | Meaning |
|---|---|
| `api_key` | OpenRouter key (from config file only, no env fallback) |
| `chat_model` | Script LLM — free: `nvidia/nemotron-3-super-120b-a12b:free` |
| `image_model` | `bytedance-seed/seedream-4.5` |
| `video_model` | `bytedance/seedance-1-5-pro` (cheap, lip-sync + dialogue) |
| `tts_engine` / `tts_voice_hi` / `tts_voice_en` | Edge-TTS voice selection |
| `keep_clip_audio` | `true` → keep video-model's own synced audio (best lip-sync) |
| `allow_paid_calls` | `false` blocks image/video/TTS calls; `true` enables paid |
| `language` | `hi` or `en` |
| `video_duration` / `scene_duration` / `video_fps` / `output_size` | Video params |

## Cost notes

- Video billed **per second**. 5s @ 720p Seedance ≈ **~$0.26**; a 2-scene 10s
  video ≈ **~$0.52**.
- Script LLM (free), character images cached, Edge-TTS free.
- `--dry-run`, `--mock`, and `python -m cartoon_gen.fake_client` are all free.

## Notes for developers

- **No hardcoding**: all values come from `config.json` via `Config.load()`.
- `UNDERSTANDING.md` and `PROJECT_CONTEXT.md` are the living project docs —
  update them as the project evolves.
- See `UNDERSTANDING.md` §4 for the lip-sync/audio lesson (critical).
- This is the **OpenRouter-only** pipeline (puppet/fal pipelines were removed).

