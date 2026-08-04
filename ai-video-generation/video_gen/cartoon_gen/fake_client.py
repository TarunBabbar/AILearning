"""Fake OpenRouter client for end-to-end testing WITHOUT any network/paid calls.

Subclasses OpenRouterClient and overrides every network-touching method with
deterministic fake responses. The pipeline then runs fully offline:
  - chat returns a realistic scene script (no LLM)
  - generate_image returns a tiny valid PNG (no image model)
  - video job completes instantly (no video model)
  - text_to_speech writes a placeholder tone mp3 (no TTS)

Usage:
    from cartoon_gen.fake_client import FakeOpenRouterClient
    pipe = CartoonPipeline(client=FakeOpenRouterClient(), dry_run=False)
    result = pipe.run("Why carrots are good for your eyes")
"""
from __future__ import annotations

import base64
import json
import struct
import time
import zlib
from pathlib import Path

from .config import cfg
from .openrouter_client import OpenRouterClient, JobStatus


def _tiny_png_bytes() -> bytes:
    """Build a minimal valid 1x1 PNG (used to fake image generation)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1 RGB
    raw = b"\x00\xff\x00\x00"  # filter 0, red pixel
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


class FakeOpenRouterClient(OpenRouterClient):
    """Offline stand-in for OpenRouterClient — never touches the network."""

    def __init__(self, api_key: str = "fake-key", base_url: str = "http://fake"):
        # bypass the real __init__ (which requires an api_key + may validate)
        self.api_key = api_key
        self.base_url = base_url

    # ------------------------------------------------------------ chat
    def chat(self, messages, model=None, temperature=0.7, max_tokens=4000, **extra):
        """Return a fixed, realistic scene script without calling any LLM."""
        # pull the topic out of the messages (it's in the last user message)
        topic = "healthy food"
        for m in reversed(messages):
            if m.get("role") == "user" and "Topic:" in m.get("content", ""):
                for line in m["content"].splitlines():
                    if line.startswith("Topic:"):
                        topic = line.split("Topic:", 1)[1].strip()
                        break
                break
        per_scene = cfg.scene_duration or 5
        n = max(1, round((cfg.video_duration or 10) / per_scene))
        scenes = []
        for i in range(n):
            speaker = "mom" if i % 2 == 0 else "son"
            dialogue = f"Line {i+1}: about {topic}."
            scenes.append({
                "id": i + 1,
                "speaker": speaker,
                "dialogue": dialogue,
                "visual": f"Scene {i+1}: {speaker} talking about {topic}.",
                "video_prompt": (
                    f"3D cartoon, Pixar style, warm lighting, vertical composition. "
                    f"Scene {i+1}: {speaker} talking about {topic}."
                ),
                "duration": per_scene,
            })
        return json.dumps({
            "title": f"About {topic}",
            "hook": f"Mom: Let's learn about {topic}!",
            "topic": topic,
            "scenes": scenes,
        })

    # ---------------------------------------------------------- image
    def generate_image(self, prompt, model=None, size=None, **extra):
        """Return a tiny valid PNG — no image model called."""
        return _tiny_png_bytes()

    # ---------------------------------------------------------- video
    def create_video_job(self, prompt, model=None, *, duration=None, resolution=None,
                         aspect_ratio=None, size=None, input_references=None,
                         frame_images=None, generate_audio=True, callback_url=None, **extra):
        return f"fake-job-{int(time.time())}"

    def get_video_job(self, job_id):
        return JobStatus(
            id=job_id, status="completed",
            unsigned_urls=[f"http://fake/{job_id}.mp4"],
            error=None, usage_cost=0.0, model=cfg.video_model,
        )

    def wait_video_job(self, job_id, poll_interval_s=None, max_minutes=None, progress=False):
        return self.get_video_job(job_id)

    def download_video(self, job_id, dest, index=0, retries=1):
        """Write a real placeholder mp4 (silent, tiny) so assembly can run."""
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        # generate a 1-second silent clip via ffmpeg (offline)
        from .assembler import _run
        size = cfg.output_size or "1080x1920"
        w, h = size.split("x")
        dur = 1.0
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=blue:size={w}x{h}:rate=30:d={dur}",
            "-f", "lavfi", "-i", f"sine=frequency={cfg.mock_tone_hz or 440}:sample_rate=44100:d={dur}",
            "-t", f"{dur}",
            "-c:v", cfg.video_codec or "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac", "-b:a", "64k",
            "-pix_fmt", "yuv420p",
            str(dest),
        ]
        _run(cmd)
        return str(dest)

    # ---------------------------------------------------------- tts
    def text_to_speech(self, text, dest, model=None, **extra):
        """Write a placeholder tone mp3 — no TTS model called."""
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        from .assembler import _run
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"sine=frequency={cfg.mock_tone_hz or 440}:sample_rate=44100",
            "-t", "1",
            "-c:a", "libmp3lame", "-b:a", "64k",
            str(dest),
        ]
        _run(cmd)
        return str(dest)


if __name__ == "__main__":
    from .pipeline import CartoonPipeline
    pipe = CartoonPipeline(client=FakeOpenRouterClient(), dry_run=False, mock=False)
    result = pipe.run("Why carrots are good for your eyes")
    print("\n=== FAKE E2E RESULT ===")
    print("scenes:", len(result.script.get("scenes", [])))
    print("clips:", result.clips)
    print("audio:", result.audios)
    print("final:", result.final_video)
