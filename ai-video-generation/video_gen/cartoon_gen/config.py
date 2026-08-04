"""Central configuration for the cartoon video generator.

All tunables live here so we can swap models / costs without touching code.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

# video_gen/ (parent of cartoon_gen/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Config:
    # --- paths ---
    root: Path = PROJECT_ROOT
    output_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "output")
    characters_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "characters")
    audio_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "audio")
    clips_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "clips")
    scripts_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "scripts")
    cache_dir: Path = field(default_factory=lambda: PROJECT_ROOT / ".cache")

    # --- api (values come ONLY from config.json) ---
    api_key: str = ""
    base_url: str = ""

    # --- model choices (values come ONLY from config.json) ---
    chat_model: str = ""
    chat_model_fallbacks: list[str] = field(default_factory=list)  # free-model fallback chain
    image_model: str = ""
    video_model: str = ""
    tts_model: str = ""

    # --- video defaults (values come ONLY from config.json) ---
    video_resolution: str = ""
    video_aspect_ratio: str = ""
    video_duration: int = 0
    scene_duration: int = 0
    video_fps: int = 0
    output_size: str = ""          # e.g. "1080x1920" for final vertical video
    video_codec: str = ""
    video_preset: str = ""
    video_crf: int = 0
    audio_codec: str = ""
    audio_bitrate: str = ""
    keep_clip_audio: bool = True   # keep video-model's own synced audio vs replace w/ TTS

    # --- language (comes ONLY from config.json) ---
    language: str = ""

    # --- TTS (come ONLY from config.json) ---
    tts_engine: str = ""           # "edge" (default) or "sapi"
    tts_voice_hi: str = ""         # edge voice for Hindi, e.g. "hi-IN-SwaraNeural"
    tts_voice_en: str = ""         # edge voice for English, e.g. "en-US-AriaNeural"
    tts_rate: str = ""             # speaking rate, e.g. "+10%" or "-5%"

    # --- image defaults (come ONLY from config.json) ---
    image_size: str = ""
    image_format: str = ""

    # --- network / encode (come ONLY from config.json) ---
    user_agent: str = ""
    request_timeout_s: int = 0
    chat_timeout_s: int = 0
    download_timeout_s: int = 0
    http_timeout_s: int = 0
    ffmpeg_timeout_s: int = 0
    mock_tone_hz: int = 0
    mock_audio_bitrate: str = ""

    # --- behaviour (comes ONLY from config.json) ---
    skip_existing: bool = True
    dry_run: bool = False
    mock: bool = False
    allow_paid_calls: bool = False   # if False, image/video/TTS calls are blocked
    poll_interval_s: int = 0
    max_poll_minutes: int = 0

    def ensure_dirs(self) -> None:
        for d in (
            self.output_dir, self.characters_dir, self.audio_dir,
            self.clips_dir, self.scripts_dir, self.cache_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)

    def save(self, path: Path | None = None) -> None:
        path = path or (self.root / "config.json")
        data = {k: (str(v) if isinstance(v, Path) else v) for k, v in self.__dict__.items()}
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    @classmethod
    def from_file(cls, path: Path | None = None) -> "Config":
        path = path or (PROJECT_ROOT / "config.json")
        if not path.exists():
            return cls()
        data = json.loads(path.read_text(encoding="utf-8"))
        # only override known fields (respect dataclass field defaults)
        import dataclasses
        known = {f.name for f in dataclasses.fields(cls)}
        kwargs = {k: v for k, v in data.items() if k in known}
        return cls(**kwargs)

    @classmethod
    def load(cls, path: Path | None = None, target: "Config | None" = None) -> "Config":
        """Load config from JSON file into the shared singleton `cfg` (or `target`).
        All settings — including api_key — come from config.json only."""
        path = path or (PROJECT_ROOT / "config.json")
        fresh = cls.from_file(path)
        if target is None:
            target = globals().get("cfg")
        if target is not None:
            # mutate the shared singleton in place
            for k, v in fresh.__dict__.items():
                setattr(target, k, v)
            return target
        return fresh


# default instance (loaded from config.json if present)
cfg = Config.load()
if not cfg.api_key:
    cfg.api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
