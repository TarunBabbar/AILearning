"""Voice-over (TTS) generation for dialogue lines.

Primary: Edge-TTS (Microsoft's free neural TTS, no API key, has Hindi voices).
Fallback: Windows SAPI (built-in) if edge-tts is unavailable.

Voice selection (config.json):
  tts_engine      = "edge" | "sapi"
  tts_voice_hi    = edge voice for Hindi  (default "hi-IN-SwaraNeural")
  tts_voice_en    = edge voice for English (default "en-US-AriaNeural")
  tts_rate        = speaking rate, e.g. "+10%" or "-5%"

The audio is saved per scene; the assembler maps them onto the video clips.
"""
from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

from .config import cfg
from .openrouter_client import OpenRouterError


def tts_path(topic_slug: str, scene_id: int) -> Path:
    return cfg.audio_dir / f"{topic_slug}_scene{scene_id:02d}.mp3"


def _edge_voice(language: str) -> str:
    lang = (language or cfg.language or "en").lower()
    if lang == "hi":
        return cfg.tts_voice_hi or "hi-IN-SwaraNeural"
    return cfg.tts_voice_en or "en-US-AriaNeural"


def _edge_tts(text: str, dest: Path, language: str) -> Path:
    """Use Microsoft Edge neural TTS (edge-tts) — free, no API key, Hindi support."""
    try:
        import edge_tts
    except ImportError as e:
        raise OpenRouterError("edge-tts not installed; run: pip install edge-tts") from e

    voice = _edge_voice(language)
    rate = cfg.tts_rate or "+0%"

    async def _run() -> None:
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        await communicate.save(str(dest))

    dest.parent.mkdir(parents=True, exist_ok=True)
    asyncio.run(_run())
    if not dest.exists():
        raise OpenRouterError("edge-tts produced no audio")
    return dest


def _sapi_tts(text: str, dest: Path, language: str) -> Path:
    """Fallback: use Windows SAPI via PowerShell to synthesize speech to WAV.

    NOTE: SAPI only has English voices on most systems; Hindi/Devanagari will
    not render correctly. Use edge-tts for Hindi.
    """
    import base64
    voice_sel = ""
    if (language or "").lower() == "hi":
        # prefer a Hindi voice if installed; otherwise SAPI can't read Devanagari
        voice_sel = (
            "$v = $s.GetVoices() | Where-Object { $_.GetDescription() -match 'Hindi' } | Select-Object -First 1;"
            "if ($v) { $s.Voice = $v }"
        )
    ps = (
        "$s = New-Object -ComObject SAPI.SpVoice;"
        + voice_sel
        + f"$f = New-Object -ComObject SAPI.SpFileStream;"
        f"$f.Open('{dest.with_suffix('.wav')}', 3);"
        "$s.AudioOutputStream = $f;"
        "$s.Speak($args[0]);"
        "$f.Close();"
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps, text],
        check=True, capture_output=True, timeout=120,
    )
    wav = dest.with_suffix(".wav")
    if not wav.exists():
        raise OpenRouterError("SAPI fallback produced no audio")
    return wav


def generate_line_tts(
    topic_slug: str,
    scene_id: int,
    text: str,
    *,
    model: str | None = None,
    client=None,
    use_openrouter: bool = True,
    language: str | None = None,
) -> Path:
    """Generate TTS for one line. Returns path to audio (mp3).

    Engine order (config.json `tts_engine`):
      edge  -> Edge neural TTS (default, free, Hindi voices)
      sapi  -> Windows SAPI (English only, poor Hindi)
    """
    dest = tts_path(topic_slug, scene_id)
    lang = (language or cfg.language or "en").lower()

    if dest.exists() and cfg.skip_existing:
        print(f"    [tts] scene {scene_id} exists, using cached {dest.name}")
        return dest

    engine = (cfg.tts_engine or "edge").lower()
    print(f"    [tts] scene {scene_id}: generating speech ({engine}, {lang}) ...")

    try:
        if engine == "edge":
            return _edge_tts(text, dest, lang)
        return _sapi_tts(text, dest, lang)
    except Exception as e:
        print(f"    [tts] {engine} failed ({e}); trying SAPI fallback")
        try:
            return _sapi_tts(text, dest, lang)
        except Exception as e2:
            raise OpenRouterError(f"all TTS engines failed: {e2}") from e2


def generate_all_tts(
    topic_slug: str,
    scenes: list[dict],
    *,
    model: str | None = None,
    client=None,
) -> list[Path]:
    paths = []
    for sc in scenes:
        text = sc.get("dialogue") or ""
        if not text:
            continue
        p = generate_line_tts(topic_slug, sc.get("id", 1), text, model=model, client=client)
        paths.append((sc.get("id", 1), p))
    return paths


if __name__ == "__main__":
    out = generate_line_tts("smoke", 1, "Hello son! Carrots help you see better!")
    print(f"OK: {out}")
