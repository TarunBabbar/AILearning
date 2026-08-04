"""Pipeline orchestration: topic -> final cartoon video.

Stages:
  script -> characters -> scene videos -> TTS -> assemble

Each stage is cached on disk (scripts/, characters/, clips/, audio/) so a
re-run skips already-completed work and only spends money on what's missing.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .assembler import assemble_video, probe_duration
from .character_gen import character_data_url, generate_character
from .config import cfg
from .openrouter_client import OpenRouterClient
from .scene_video import generate_scene_video, scene_clip_path
from .script_gen import generate_script
from .tts_gen import generate_line_tts


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if s:
        return s
    # Non-Latin input (e.g. Devanagari): use a stable hash so caching works
    # without colliding across different Hindi topics.
    import hashlib
    digest = hashlib.md5(text.encode("utf-8")).hexdigest()[:10]
    return f"hi-{digest}" if cfg.language == "hi" else f"topic-{digest}"


@dataclass
class PipelineResult:
    topic: str
    topic_slug: str
    script: dict = field(default_factory=dict)
    characters: dict[str, Path] = field(default_factory=dict)
    clips: list[Path] = field(default_factory=list)
    audios: list[Path] = field(default_factory=list)
    final_video: Path | None = None
    steps_ran: list[str] = field(default_factory=list)


class CartoonPipeline:
    def __init__(self, client: OpenRouterClient | None = None, dry_run: bool | None = None,
                 mock: bool | None = None):
        self.client = client
        self.dry_run = cfg.dry_run if dry_run is None else dry_run
        # mock: produce REAL placeholder files (test video + tone) so the
        # whole pipeline incl. ffmpeg assembly runs for free — no paid calls.
        self.mock = cfg.mock if mock is None else mock

    # ------------------------------------------------------------- script
    def _script_path(self, slug: str) -> Path:
        return cfg.scripts_dir / f"{slug}.json"

    def run_script(self, topic: str, slug: str) -> dict:
        path = self._script_path(slug)
        if path.exists() and cfg.skip_existing:
            cached = json.loads(path.read_text(encoding="utf-8"))
            # If this cached script was produced by the fake/mock client
            # (markers like "Line 1: about ..." / "Scene 1: mom talking about ..."),
            # don't serve it as a real script — regenerate it.
            if not self._looks_fake(cached):
                print(f"[script] using cached {path.name}")
                return cached
            print(f"[script] cached script looks fake; regenerating")
        if self.dry_run or self.mock:
            print("[script] DRY-RUN: would call LLM to generate script")
            # build a plausible in-memory script so downstream stages can be exercised
            per_scene = cfg.scene_duration
            n = max(1, round(cfg.video_duration / per_scene))
            return {
                "title": topic,
                "hook": f"Mom: Let's learn about {topic}!",
                "topic": topic,
                "scenes": [
                    {
                        "id": i + 1,
                        "speaker": "mom" if i % 2 == 0 else "son",
                        "dialogue": f"Sample dialogue line for scene {i + 1} about {topic}.",
                        "visual": f"Mom and Son talking about {topic}.",
                        "video_prompt": (
                            f"3D cartoon, Pixar style, warm lighting, vertical composition. "
                            f"Scene about {topic}."
                        ),
                        "duration": per_scene,
                    }
                    for i in range(n)
                ],
            }
        print(f"[script] generating script for: {topic}")
        script = generate_script(topic, client=self.client, language=cfg.language)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(script, indent=2, ensure_ascii=False), encoding="utf-8")
        return script

    @staticmethod
    def _looks_fake(script: dict) -> bool:
        """Detect scripts produced by the fake/mock client (offline test data)."""
        scenes = script.get("scenes") or []
        if not scenes:
            return False
        sample = scenes[0]
        d = (sample.get("dialogue") or "").lower()
        v = (sample.get("visual") or "").lower()
        t = (sample.get("title") or "").lower()
        if d.startswith("line 1: about") or "talking about" in v or t.startswith("about "):
            return True
        return False

    # -------------------------------------------------------- characters
    def run_characters(self, slug: str) -> dict[str, Path]:
        chars = {}
        for name in ("mom", "son"):
            p = cfg.characters_dir / f"{name}.png"
            if p.exists() and cfg.skip_existing:
                print(f"[char] using cached {p.name}")
                chars[name] = p
                continue
            if self.dry_run:
                raise RuntimeError("dry_run: cannot generate character image")
            chars[name] = generate_character(name, client=self.client)
        return chars

    # ------------------------------------------------------------ scenes
    def _mock_clip(self, dest: Path, duration: float) -> Path:
        """Create a REAL placeholder mp4 (test pattern + tone) using ffmpeg.
        No paid API involved — lets us test the full assembly for free."""
        from .assembler import _run
        if dest.exists():
            return dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        size_w, size_h = cfg.output_size.split("x")
        fps = cfg.video_fps or 30
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc2=size={size_w}x{size_h}:rate={fps}",
            "-f", "lavfi", "-i", f"sine=frequency={cfg.mock_tone_hz}:sample_rate=44100",
            "-t", f"{duration}",
            "-c:v", cfg.video_codec, "-preset", "ultrafast", "-crf", "28",
            "-c:a", cfg.audio_codec, "-b:a", cfg.mock_audio_bitrate,
            "-pix_fmt", "yuv420p",
            str(dest),
        ]
        _run(cmd)
        return dest

    def run_scenes(self, slug: str, script: dict, characters: dict[str, Path]) -> list[Path]:
        refs = []
        if not self.dry_run and not self.mock:
            # convert local PNGs to data URLs for the reference-to-video input
            refs = [character_data_url(characters["mom"]), character_data_url(characters["son"])]

        clips = []
        for sc in script.get("scenes", []):
            sid = sc.get("id", 1)
            dest = scene_clip_path(slug, sid)
            if dest.exists() and cfg.skip_existing:
                print(f"[video] using cached scene {sid}: {dest.name}")
                clips.append(dest)
                continue
            if self.dry_run:
                # don't spend money; just record what would run
                print(f"[video] DRY-RUN: would generate scene {sid}")
                clips.append(dest)  # placeholder path
                continue
            if self.mock:
                print(f"[video] MOCK: creating placeholder clip for scene {sid}")
                dur = sc.get("duration") or cfg.scene_duration
                clips.append(self._mock_clip(dest, dur))
                continue
            clips.append(generate_scene_video(slug, sc, refs=refs, client=self.client))
        return clips

    # -------------------------------------------------------------- tts
    def _mock_audio(self, dest: Path, duration: float) -> Path:
        """Create a REAL placeholder audio file (440Hz tone) via ffmpeg — free."""
        from .assembler import _run
        if dest.exists():
            return dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        # use mp3 codec to match the .mp3 extension (aac cannot go in .mp3)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"sine=frequency={cfg.mock_tone_hz}:sample_rate=44100",
            "-t", f"{duration}",
            "-c:a", "libmp3lame", "-b:a", cfg.mock_audio_bitrate,
            str(dest),
        ]
        _run(cmd)
        return dest

    def run_tts(self, slug: str, script: dict) -> list[Path]:
        audios = []
        for sc in script.get("scenes", []):
            sid = sc.get("id", 1)
            text = sc.get("dialogue", "")
            dest = cfg.audio_dir / f"{slug}_scene{sid:02d}.mp3"
            if not text:
                audios.append(None)
                continue
            if dest.exists() and cfg.skip_existing:
                print(f"[tts] using cached {dest.name}")
                audios.append(dest)
                continue
            if self.dry_run:
                print(f"[tts] DRY-RUN: would generate speech for scene {sid}")
                audios.append(None)
                continue
            if self.mock:
                print(f"[tts] MOCK: creating placeholder audio for scene {sid}")
                dur = sc.get("duration") or cfg.scene_duration
                audios.append(self._mock_audio(dest, dur))
                continue
            audios.append(generate_line_tts(slug, sid, text, client=self.client, language=cfg.language))
        return audios

    # ---------------------------------------------------------- assemble
    def run_assemble(
        self,
        slug: str,
        clips: list[Path],
        audios: list[Path],
        script: dict,
    ) -> Path:
        out = cfg.output_dir / f"{slug}.mp4"
        if out.exists() and cfg.skip_existing:
            print(f"[assemble] output exists: {out}")
            return out
        if self.dry_run:
            print(f"[assemble] DRY-RUN: would assemble {len(clips)} clips -> {out}")
            return out

        print(f"[assemble] assembling {len(clips)} clips ...")
        return assemble_video(
            clips,
            audios=audios,
            out_path=out,
        )

    # ------------------------------------------------------------ driver
    def run(self, topic: str, *, slug: str | None = None) -> PipelineResult:
        slug = slug or slugify(topic)
        result = PipelineResult(topic=topic, topic_slug=slug)
        cfg.ensure_dirs()

        if self.mock:
            print(f"=== MOCK RUN (no paid API) === topic='{topic}' slug='{slug}'")
        elif self.dry_run:
            print(f"=== DRY RUN === topic='{topic}' slug='{slug}'")
        else:
            print(f"=== Generating: {topic} ({slug}) ===")

        # 1. script
        script = self.run_script(topic, slug)
        result.script = script
        result.steps_ran.append("script")

        # 2. characters
        if self.dry_run or self.mock:
            result.characters = {"mom": cfg.characters_dir / "mom.png", "son": cfg.characters_dir / "son.png"}
        else:
            result.characters = self.run_characters(slug)
        result.steps_ran.append("characters")

        # 3. scene videos
        clips = self.run_scenes(slug, script, result.characters)
        result.clips = [c for c in clips if c is not None]
        result.steps_ran.append("scenes")

        # 4. tts
        audios = self.run_tts(slug, script)
        result.audios = [a for a in audios if a is not None]
        result.steps_ran.append("tts")

        # 5. assemble
        result.final_video = self.run_assemble(slug, result.clips, result.audios, script)
        result.steps_ran.append("assemble")

        return result


def render_topic(topic: str, *, dry_run: bool | None = None, mock: bool | None = None) -> PipelineResult:
    """One-shot: render a topic to a final video."""
    client = None if dry_run or mock else OpenRouterClient()
    pipe = CartoonPipeline(client=client, dry_run=dry_run, mock=mock)
    return pipe.run(topic)
