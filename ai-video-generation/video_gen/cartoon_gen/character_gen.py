"""Character image generation: create + cache consistent Mom and Son.

We generate each character ONCE and reuse the PNGs as reference images for
every scene video, which is what keeps the characters consistent across the
whole video and across many videos.
"""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path

from .config import cfg
from .openrouter_client import OpenRouterClient

CHARACTER_STYLE = (
    "3D animated cartoon character, Pixar-style, soft rounded shapes, "
    "warm cinematic lighting, glossy smooth render, high detail, "
    "full body, standing, neutral friendly pose, plain soft pastel background, vertical composition"
)

CHARACTERS = {
    "mom": {
        "description": (
            "A warm cheerful Indian Mom cartoon character with a normal human head, "
            "soft dark brown hair styled in a neat low bun with a few loose strands, "
            "gentle smile, rosy cheeks, big kind eyes, small red bindi on forehead, "
            "wearing a bright pink saree with gold border. Motherly, loving, friendly."
        ),
        "prompt": None,  # filled below
    },
    "son": {
        "description": (
            "A cute little Indian boy cartoon character, about 6 years old, with a normal "
            "human head and neat short black hair with a small quiff, big curious sparkling "
            "brown eyes, rosy cheeks, happy smile, wearing a yellow t-shirt and blue shorts. "
            "Playful, excited, friendly."
        ),
        "prompt": None,
    },
}


def _character_prompt(name: str) -> str:
    desc = CHARACTERS[name]["description"]
    return f"{desc} {CHARACTER_STYLE}"


def generate_character(name: str, *, model: str | None = None, client: OpenRouterClient | None = None) -> Path:
    """Generate (or load cached) character image for `name` ('mom'|'son')."""
    if name not in CHARACTERS:
        raise ValueError(f"unknown character: {name}; expected {list(CHARACTERS)}")
    cfg.characters_dir.mkdir(parents=True, exist_ok=True)
    dest = cfg.characters_dir / f"{name}.png"

    if dest.exists() and cfg.skip_existing:
        print(f"    [char] {name} exists, using cached {dest}")
        return dest

    client = client or OpenRouterClient()
    prompt = _character_prompt(name)
    print(f"    [char] generating {name} ...")
    png_bytes = client.generate_image(prompt, model=model)
    dest.write_bytes(png_bytes)
    print(f"    [char] saved {dest} ({len(png_bytes)//1024} KiB)")
    return dest


def generate_characters(*, model: str | None = None, client: OpenRouterClient | None = None) -> dict[str, Path]:
    """Generate both characters, return {name: Path}."""
    out = {}
    for name in ("mom", "son"):
        out[name] = generate_character(name, model=model, client=client)
    return out


def character_data_url(path: Path) -> str:
    """Base64 data URL for a local image (used for reference inputs)."""
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def save_character_manifest(paths: dict[str, Path], topic_slug: str) -> Path:
    cfg.cache_dir.mkdir(parents=True, exist_ok=True)
    manifest = {k: str(v) for k, v in paths.items()}
    p = cfg.cache_dir / f"{topic_slug}_characters.json"
    p.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return p


if __name__ == "__main__":
    t0 = time.time()
    chars = generate_characters()
    for n, p in chars.items():
        print(f"  {n}: {p}")
    print(f"done in {time.time()-t0:.1f}s")
