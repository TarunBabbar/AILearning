"""Config for the audio_first project (single source of truth: config.json)."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"


@dataclass
class Config:
    pipeline_cwd: str = ""
    output_dir: str = ""
    characters_dir: str = ""
    api_key: str = ""
    base_url: str = ""
    chat_model: str = ""
    chat_model_fallbacks: list[str] = field(default_factory=list)
    video_models: dict = field(default_factory=dict)
    default_video_model: str = ""
    language: str = ""
    tts_voice_hi: str = ""
    tts_voice_en: str = ""
    tts_rate: str = ""
    scene_duration: int = 0
    video_fps: int = 0
    output_size: str = ""
    video_codec: str = ""
    video_preset: str = ""
    video_crf: int = 0
    audio_codec: str = ""
    audio_bitrate: str = ""
    chat_timeout_s: int = 0
    video_job_timeout_min: int = 0
    poll_interval_s: int = 0
    ffmpeg_timeout_s: int = 0
    download_timeout_s: int = 0
    user_agent: str = ""
    skip_existing: bool = True
    allow_mock: bool = True


def _resolve_path(base: Path, value: str, default: Path) -> str:
    if not value:
        return str(default.resolve())
    p = Path(value)
    if not p.is_absolute():
        p = (base / p).resolve()
    return str(p)


def load_config() -> Config:
    c = Config()
    if CONFIG_PATH.exists():
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        for k, v in data.items():
            if hasattr(c, k):
                setattr(c, k, v)

    c.pipeline_cwd = _resolve_path(ROOT, c.pipeline_cwd, ROOT)
    c.output_dir = _resolve_path(ROOT, c.output_dir, ROOT / "output")
    c.characters_dir = _resolve_path(ROOT, c.characters_dir, ROOT.parent / "video_gen" / "characters")

    if not c.api_key:
        c.api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    return c


cfg = load_config()
