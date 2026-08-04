"""Single-scene REAL API test — generate ONE 5-second video scene.

Use this to validate the paid video flow with minimal spend (~$0.26 for
Seedance 5s @ 720p) before running the full multi-scene pipeline.

Usage:
    python test_single_scene.py
    python test_single_scene.py --prompt "Mom holds a carrot and smiles"
    python test_single_scene.py --duration 5 --resolution 720p

Requires: config.json has api_key set AND allow_paid_calls=true.
"""
from __future__ import annotations

import argparse
import sys

from cartoon_gen.character_gen import character_data_url
from cartoon_gen.config import cfg
from cartoon_gen.openrouter_client import OpenRouterClient, OpenRouterError


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Generate one real 5s video scene (paid)")
    p.add_argument("--prompt", type=str,
                   default=("3D cartoon, Pixar style, warm lighting, vertical composition. "
                            "Close-up of the Mom character holding a bright orange carrot, "
                            "smiling and speaking warmly to her son, gentle camera zoom in."),
                   help="video prompt for the scene")
    p.add_argument("--duration", type=int, default=5, help="scene duration in seconds (default 5)")
    p.add_argument("--resolution", type=str, default=None, help="720p/1080p (default config)")
    p.add_argument("--out", type=str, default=None, help="output mp4 path (default clips/test_scene01.mp4)")
    p.add_argument("--model", type=str, default=None, help="video model override")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if not cfg.api_key:
        print("ERROR: api_key is empty in config.json")
        return 2
    if not cfg.allow_paid_calls:
        print("ERROR: allow_paid_calls is false in config.json — set it to true to run paid generation")
        return 2

    # build character reference data URLs (cached mom.png / son.png)
    refs = []
    for name in ("mom", "son"):
        p = cfg.characters_dir / f"{name}.png"
        if p.exists():
            refs.append(character_data_url(p))
            print(f"  using character ref: {p}")
        else:
            print(f"  WARNING: {p} not found — scene will have no character reference")

    out = args.out or str(cfg.clips_dir / "test_scene01.mp4")
    client = OpenRouterClient()
    try:
        print(f"\n=== Submitting ONE {args.duration}s video job ===")
        print(f"  model:      {args.model or cfg.video_model}")
        print(f"  resolution: {args.resolution or cfg.video_resolution}")
        print(f"  ratio:      {cfg.video_aspect_ratio}")
        print(f"  refs:       {len(refs)} character images")

        job_id = client.create_video_job(
            args.prompt,
            model=args.model,
            duration=args.duration,
            resolution=args.resolution or cfg.video_resolution,
            aspect_ratio=cfg.video_aspect_ratio,
            input_references=refs,
            generate_audio=True,
        )
        print(f"  job id: {job_id}")
        print("  waiting for completion (this can take 1-5 min)...")

        client.download_video(job_id, out)
        print(f"\n  SUCCESS: video saved to {out}")
        return 0
    except OpenRouterError as e:
        print(f"\n  FAILED: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
