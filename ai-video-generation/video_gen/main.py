"""CLI entry point for the Mom & Son cartoon video generator.

Usage examples:
  python main.py --topic "Why carrots are good for your eyes"
  python main.py --topic "Bananas give you energy" --duration 10
  python main.py --topic "Apples keep the doctor away" --dry-run
  python main.py --list-topics
  python main.py --topic "Mango is the king of fruits" --video-model google/veo-3.1-lite

Flags:
  --topic TEXT       topic for the video (or --list-topics to browse)
  --duration SEC     target total duration in seconds (default 10)
  --dry-run          print the plan without calling any paid API
  --video-model ID   override video model (e.g. google/veo-3.1-lite)
  --chat-model ID    override script LLM
  --image-model ID   override character image model
  --no-cache         regenerate everything (ignore cached results)
"""
from __future__ import annotations

import argparse
import json
import sys

# On Windows the console may use cp1252 which cannot print Devanagari.
# Force UTF-8 for stdout/stderr so Hindi topics + dialogue print fine.
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from cartoon_gen.config import Config, cfg
from cartoon_gen.pipeline import CartoonPipeline, slugify
from cartoon_gen.topics import TOPICS


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Mom & Son cartoon video generator")
    p.add_argument("--topic", type=str, help="topic to turn into a video")
    p.add_argument("--list-topics", action="store_true", help="list available topics and exit")
    p.add_argument("--config", type=str, default=None,
                   help="path to a config.json (default: ./config.json)")
    p.add_argument("--duration", type=int, default=None, help="target duration in seconds (default config)")
    p.add_argument("--lang", "--language", type=str, default=None,
                   help="language: 'en' (English) or 'hi' (Hindi). Affects dialogue + TTS.")
    p.add_argument("--dry-run", action="store_true", help="plan without calling any paid API")
    p.add_argument("--mock", action="store_true",
                   help="run with placeholder files (ffmpeg test pattern/tone) — no paid API, tests full assembly")
    p.add_argument("--video-model", type=str, default=None, help="override video model")
    p.add_argument("--chat-model", type=str, default=None, help="override chat/script model")
    p.add_argument("--image-model", type=str, default=None, help="override image model")
    p.add_argument("--no-cache", action="store_true", help="ignore cached outputs")
    p.add_argument("--step", type=str, default=None,
                   help="run a single pipeline stage only: script | video | voice | assemble")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    # load config from file (allows --config override), then apply CLI overrides
    global cfg
    cfg = Config.load(args.config)

    if args.list_topics:
        for i, t in enumerate(TOPICS, 1):
            print(f"{i:3d}. {t}")
        return 0

    if not args.topic:
        print("error: provide --topic or --list-topics")
        return 2

    if args.duration:
        cfg.video_duration = args.duration
    if args.lang:
        cfg.language = args.lang.lower()
    if args.video_model:
        cfg.video_model = args.video_model
    if args.chat_model:
        cfg.chat_model = args.chat_model
    if args.image_model:
        cfg.image_model = args.image_model
    if args.no_cache:
        cfg.skip_existing = False
    if args.mock:
        cfg.mock = True

    pipe = CartoonPipeline(dry_run=args.dry_run, mock=args.mock)

    # --- single-step mode (used by the UI for per-node generate/retry) ---
    if args.step:
        step = args.step.lower()
        slug = slugify(args.topic)

        if step == "script":
            script = pipe.run_script(args.topic, slug)
            print("=== SCRIPT ===")
            print(json.dumps(script, ensure_ascii=False))
        elif step == "video":
            script = pipe.run_script(args.topic, slug)
            chars = pipe.run_characters(slug)
            clips = pipe.run_scenes(slug, script, chars)
            print("=== CLIPS ===")
            print(json.dumps([str(p) for p in clips if p is not None], ensure_ascii=False))
        elif step == "voice":
            script = pipe.run_script(args.topic, slug)
            audios = pipe.run_tts(slug, script)
            print("=== AUDIOS ===")
            print(json.dumps([str(p) for p in audios if p is not None], ensure_ascii=False))
        elif step == "assemble":
            script = pipe.run_script(args.topic, slug)
            chars = pipe.run_characters(slug)
            clips = pipe.run_scenes(slug, script, chars)
            audios = pipe.run_tts(slug, script)
            final = pipe.run_assemble(slug, clips, audios, script)
            print("=== FINAL ===")
            print(json.dumps([str(final)], ensure_ascii=False))
        else:
            print(f"error: unknown step '{step}' (use script|video|voice|assemble)", file=sys.stderr)
            return 2
        return 0

    result = pipe.run(args.topic)

    print("\n=== RESULT ===")
    print(json.dumps({
        "topic": result.topic,
        "slug": result.topic_slug,
        "scenes": len(result.script.get("scenes", [])),
        "clips": [str(p) for p in result.clips],
        "audio": [str(p) for p in result.audios],
        "final": str(result.final_video) if result.final_video else None,
        "steps": result.steps_ran,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
