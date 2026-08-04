"""Scene video generation: one scene -> one mp4 clip.

Uses reference-to-video: we pass the Mom/Son character images as
`input_references` so the model keeps the characters consistent, and a
per-scene `video_prompt` for the action.
"""
from __future__ import annotations

import time
from pathlib import Path

from .config import cfg
from .openrouter_client import OpenRouterClient, OpenRouterError


def scene_clip_path(topic_slug: str, scene_id: int) -> Path:
    return cfg.clips_dir / f"{topic_slug}_scene{scene_id:02d}.mp4"


def generate_scene_video(
    topic_slug: str,
    scene: dict,
    *,
    refs: list[str] | None = None,
    duration: int | None = None,
    model: str | None = None,
    client: OpenRouterClient | None = None,
    overwrite: bool = False,
) -> Path:
    """Generate the video clip for one scene. Returns path to mp4.

    `refs` = list of image URLs/data-URLs (Mom + Son character images).
    `scene` = dict from the script with at least `id` and `video_prompt`.
    """
    scene_id = scene.get("id", 1)
    dest = scene_clip_path(topic_slug, scene_id)
    if dest.exists() and cfg.skip_existing and not overwrite:
        print(f"    [video] scene {scene_id} exists, using cached {dest.name}")
        return dest

    prompt = scene.get("video_prompt") or scene.get("visual") or "Mom and son talking"
    dur = duration or scene.get("duration") or cfg.scene_duration

    client = client or OpenRouterClient()
    print(f"    [video] scene {scene_id}: submitting job ({dur}s) ...")
    job_id = client.create_video_job(
        prompt,
        model=model,
        duration=dur,
        resolution=cfg.video_resolution,
        aspect_ratio=cfg.video_aspect_ratio,
        input_references=refs,
        generate_audio=True,
    )
    print(f"    [video] scene {scene_id}: job={job_id}")
    client.download_video(job_id, str(dest))
    print(f"    [video] scene {scene_id}: saved {dest}")
    return dest


def generate_all_scenes(
    topic_slug: str,
    scenes: list[dict],
    *,
    refs: list[str] | None = None,
    model: str | None = None,
    client: OpenRouterClient | None = None,
) -> list[Path]:
    client = client or OpenRouterClient()
    paths = []
    for sc in scenes:
        p = generate_scene_video(
            topic_slug, sc, refs=refs, model=model, client=client,
        )
        paths.append(p)
    return paths


if __name__ == "__main__":
    # quick smoke test with a hardcoded scene
    from .character_gen import character_data_url, CHARACTERS
    cfg.characters_dir.mkdir(parents=True, exist_ok=True)
    refs = []
    for name in ("mom", "son"):
        p = cfg.characters_dir / f"{name}.png"
        if p.exists():
            refs.append(character_data_url(p))
    scene = {
        "id": 1,
        "video_prompt": (
            "3D cartoon, Pixar style, warm lighting, vertical composition. "
            "Close-up of the Mom character holding a bright orange carrot, smiling "
            "and speaking warmly to her son, gentle camera zoom in."
        ),
        "duration": 5,
    }
    out = generate_scene_video("smoke", scene, refs=refs, overwrite=True)
    print(f"OK: {out}")
