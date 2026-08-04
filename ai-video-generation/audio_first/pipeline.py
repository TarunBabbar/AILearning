"""Audio-first pipeline (the correct order for lip-sync).

Order matters:
  1. SCRIPT  → free LLM generates dialogue
  2. TTS     → Edge-TTS generates the Hindi audio FIRST (source of truth)
  3. VIDEO   → video model generates the scene FROM the audio:
                - Wan 2.6/2.7: pass audio as input → lips sync to the real words
                - Seedance: no audio input → generates own audio (lips won't match)
  4. ASSEMBLE → concat scenes (each already has its TTS audio synced)

All model calls go through OpenRouter (script = free; video = paid per model).
"""
from __future__ import annotations

import asyncio
import base64
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path

from config import cfg


class PipelineError(Exception):
    pass


# ------------------------------------------------------------------ script
def generate_script(topic: str, n_scenes: int, language: str) -> dict:
    """Call the free chat model (with fallbacks) for the scene script."""
    lang_rule = (
        "- Write ALL dialogue and title in HINDI (Devanagari).\n"
        "- dialogue must be simple Hindi a kid can understand.\n"
        "- Never include stray words or numbering labels inside dialogue."
        if language == "hi"
        else "- Write all dialogue and title in English."
    )
    system = "You are a children's educational cartoon script writer. Respond with valid JSON only."
    user = f"""Topic: {topic}
Number of scenes: {n_scenes} (each ~{cfg.scene_duration}s).

Return JSON exactly:
{{
  "title": "short title",
  "scenes": [
    {{"id":1, "speaker":"mom", "dialogue":"one short line", "visual":"what happens",
      "video_prompt":"3D cartoon, Pixar style, warm lighting, vertical composition. [action]"}}
  ]
}}

Rules:
- EXACTLY {n_scenes} scenes. Mix speakers, at least one son line.
- The character in each scene SPEAKS the dialogue out loud — the video will be made from this audio.
- {lang_rule}
"""
    models = [cfg.chat_model] + [m for m in cfg.chat_model_fallbacks if m != cfg.chat_model]
    last_err = None
    for m in models:
        try:
            raw = _chat(m, system, user)
            script = _extract_json(raw)
            scenes = script.get("scenes", [])
            scenes = scenes[:n_scenes]
            for i, sc in enumerate(scenes):
                sc["id"] = i + 1
                sc.setdefault("speaker", "mom")
                sc.setdefault("dialogue", "")
                sc.setdefault("visual", "")
                sc.setdefault("video_prompt", sc.get("visual", ""))
            script["scenes"] = scenes
            script["topic"] = topic
            return script
        except Exception as e:
            last_err = e
            print(f"[script] model {m} failed: {e}")
            continue
    raise PipelineError(f"script generation failed: {last_err}")


def convert_script_to_scenes(user_script: str, n_scenes: int, language: str) -> dict:
    """Convert a user's raw script (Mom says... Son says...) into scene JSON.

    The free LLM splits the dialogue into n_scenes of the standard structure,
    same shape as generate_script output.
    """
    lang_rule = (
        "- If the user's script is not in Hindi, translate dialogue to simple Hindi (Devanagari).\n"
        "- Keep the meaning/emotion of the original lines."
        if language == "hi"
        else "- Keep the dialogue in the language it's written (default English)."
    )
    system = "You are a children's educational cartoon script writer. Respond with valid JSON only."
    user = f"""Here is a raw script from the user (Mom and Son talking):

--- BEGIN SCRIPT ---
{user_script[:6000]}
--- END SCRIPT ---

Split this into EXACTLY {n_scenes} scenes (each ~{cfg.scene_duration}s), keeping the
conversation's flow and meaning.

Return JSON exactly:
{{
  "title": "short title",
  "scenes": [
    {{"id":1, "speaker":"mom", "dialogue":"one short spoken line", "visual":"what happens",
      "video_prompt":"3D cartoon, Pixar style, warm lighting, vertical composition. [action]"}}
  ]
}}

Rules:
- EXACTLY {n_scenes} scenes. Mix speakers; keep the conversation order.
- Each scene's character SPEAKS the dialogue out loud — video is made from this audio.
- {lang_rule}
"""
    models = [cfg.chat_model] + [m for m in cfg.chat_model_fallbacks if m != cfg.chat_model]
    last_err = None
    for m in models:
        try:
            raw = _chat(m, system, user)
            script = _extract_json(raw)
            scenes = script.get("scenes", [])
            scenes = scenes[:n_scenes]
            for i, sc in enumerate(scenes):
                sc["id"] = i + 1
                sc.setdefault("speaker", "mom")
                sc.setdefault("dialogue", "")
                sc.setdefault("visual", "")
                sc.setdefault("video_prompt", sc.get("visual", ""))
            script["scenes"] = scenes
            script["title"] = script.get("title") or "My Script"
            return script
        except Exception as e:
            last_err = e
            print(f"[convert] model {m} failed: {e}")
            continue
    raise PipelineError(f"script conversion failed: {last_err}")


def _chat(model: str, system: str, user: str) -> str:
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.7,
        "max_tokens": 2000,
    }).encode()
    req = urllib.request.Request(f"{cfg.base_url}/chat/completions", data=body, headers={
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
        "User-Agent": cfg.user_agent,
    })
    with urllib.request.urlopen(req, timeout=cfg.chat_timeout_s) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def _extract_json(text: str) -> dict:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    for candidate in (text, text[start:end + 1] if end > start else ""):
        if candidate:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
    raise PipelineError(f"could not parse JSON: {text[:300]!r}")


# --------------------------------------------------------------------- TTS
def generate_tts(text: str, dest: Path, language: str) -> Path:
    import edge_tts
    voice = cfg.tts_voice_hi if language == "hi" else cfg.tts_voice_en

    async def _run() -> None:
        c = edge_tts.Communicate(text, voice, rate=cfg.tts_rate)
        await c.save(str(dest))

    dest.parent.mkdir(parents=True, exist_ok=True)
    asyncio.run(_run())
    return dest


def audio_data_url(path: Path) -> str:
    """Data URL for the TTS audio, used as Wan's audio input."""
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:audio/mpeg;base64,{b64}"


def _upload_audio_to_url(audio_path: Path) -> str:
    """Upload audio to a temporary public URL (for providers needing a URL).

    Uses a simple data-URL fallback first; Wan accepts data URLs.
    """
    return audio_data_url(audio_path)


# -------------------------------------------------------------------- video
def create_video_job(prompt: str, model_id: str, *, duration: int,
                     resolution: str, aspect_ratio: str,
                     input_references: list[str] | None,
                     audio_path: Path | None) -> str:
    """Submit a video job. For audio-capable models (Wan), pass the TTS audio
    so the video lip-syncs to it."""
    body: dict = {
        "model": model_id,
        "prompt": prompt,
        "duration": duration,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "generate_audio": True,
    }
    if input_references:
        body["input_references"] = [
            {"type": "image_url", "image_url": {"url": u}} for u in input_references
        ]

    model_cfg = cfg.video_models.get(model_id) or {}
    supports_audio = model_cfg.get("supports_audio_input", False)
    if supports_audio and audio_path and audio_path.exists():
        # Wan audio passthrough: reference voice/audio for lip-sync
        body["provider"] = {
            "options": {
                # OpenRouter passes through provider-specific params; Wan accepts `audio`
                "wan": {"parameters": {"audio": _upload_audio_to_url(audio_path)}}
            }
        }

    req = urllib.request.Request(f"{cfg.base_url}/videos", data=json.dumps(body).encode(), headers={
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
        "User-Agent": cfg.user_agent,
    })
    with urllib.request.urlopen(req, timeout=cfg.chat_timeout_s) as r:
        data = json.loads(r.read().decode("utf-8"))
    job_id = data.get("id")
    if not job_id:
        raise PipelineError(f"video job: no id in {str(data)[:300]}")
    return job_id


def poll_video_job(job_id: str) -> dict:
    req = urllib.request.Request(f"{cfg.base_url}/videos/{job_id}", headers={
        "Authorization": f"Bearer {cfg.api_key}",
        "User-Agent": cfg.user_agent,
    })
    with urllib.request.urlopen(req, timeout=cfg.chat_timeout_s) as r:
        return json.loads(r.read().decode("utf-8"))


def wait_video_job(job_id: str) -> dict:
    deadline = time.time() + cfg.video_job_timeout_min * 60
    while time.time() < deadline:
        st = poll_video_job(job_id)
        if st.get("status") in ("completed", "failed", "cancelled", "expired"):
            return st
        time.sleep(cfg.poll_interval_s)
    raise PipelineError(f"video job {job_id} timed out")


def download_video(job_id: str, dest: Path) -> Path:
    st = wait_video_job(job_id)
    if st.get("status") != "completed" or not st.get("unsigned_urls"):
        raise PipelineError(f"video job failed: {st.get('status')} {st.get('error') or ''}")
    url = st["unsigned_urls"][0]
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {cfg.api_key}",
        "User-Agent": cfg.user_agent,
    })
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req, timeout=cfg.download_timeout_s) as r:
        dest.write_bytes(r.read())
    return dest


# --------------------------------------------------------------- assemble
def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=cfg.ffmpeg_timeout_s)
    if r.returncode != 0:
        raise PipelineError(f"ffmpeg failed: {r.stderr[-800:]}")


def assemble(scene_videos: list[Path], out: Path) -> Path:
    out_dir = Path(cfg.output_dir)
    work = out_dir / "work"
    work.mkdir(parents=True, exist_ok=True)
    ready: list[Path] = []
    size = cfg.output_size
    for i, v in enumerate(scene_videos):
        norm = work / f"norm_{i:02d}.mp4"
        _run(["ffmpeg", "-y", "-i", str(v),
              "-vf", f"scale={size.split('x')[0]}:{size.split('x')[1]}:force_original_aspect_ratio=decrease,"
                     f"pad={size.split('x')[0]}:{size.split('x')[1]}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={cfg.video_fps}",
              "-t", str(cfg.scene_duration),
              "-c:v", cfg.video_codec, "-preset", cfg.video_preset, "-crf", str(cfg.video_crf),
              "-c:a", cfg.audio_codec, "-b:a", cfg.audio_bitrate,
              str(norm)])
        ready.append(norm)
    list_file = work / "list.txt"
    list_file.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in ready), encoding="utf-8")
    out.parent.mkdir(parents=True, exist_ok=True)
    _run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
          "-c:v", cfg.video_codec, "-preset", cfg.video_preset, "-crf", str(cfg.video_crf),
          "-c:a", cfg.audio_codec, "-b:a", cfg.audio_bitrate,
          "-movflags", "+faststart", str(out)])
    return out
