"""Script generation: topic -> structured scene script (JSON).

Uses the chat model to produce a deterministic JSON structure:
{
  "title": "...",
  "hook": "one-line opening line for Mom",
  "scenes": [
    {
      "id": 1,
      "speaker": "mom" | "son",
      "dialogue": "spoken line (short, kid-friendly)",
      "visual": "what's happening on screen",
      "video_prompt": "full scene prompt for the video model",
      "duration": 5
    }, ...
  ]
}
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .config import cfg
from .openrouter_client import OpenRouterClient

STYLE_GUIDE = """You are writing a short, viral-style educational cartoon for a kids' YouTube/Shorts channel.

CHARACTERS:
- MOM: a warm, cheerful 3D cartoon Mom character (round face, food-themed head, bright pink saree/outfit). Speaks like a loving teacher.
- SON: a cute 3D cartoon little boy (food-themed head, yellow t-shirt). Curious, playful, asks questions.

STRUCTURE (CRITICAL): The scenes must form a COMPLETE mini-story with a clear arc:
  1. HOOK — Mom introduces the topic in a fun, catchy way (grabs attention).
  2. TEACH — Mom gives the key fact/benefit (the "why it's good").
  3. REACT — Son reacts with curiosity/excitement (a question or "wow").
  4. PAYOFF — Mom answers simply and the scene ends on a positive, satisfying note.
  Every one of these beats must appear across the N scenes. Do not end on a dangling question.

STYLE RULES:
- Kid-friendly, simple, short sentences. 1 line per scene max (~8-14 words).
- Mom teaches; Son reacts with a question or excitement at least once.
- Dialogue must feel like a real short conversation, not separate disconnected lines.
- Every scene must be a distinct visual shot.
- Keep the TOTAL runtime about the target_duration_seconds.
- video_prompt: describe the 3D Pixar-style scene, camera, and action in 1-2 sentences. Include "3D cartoon, Pixar style, warm lighting, vertical composition".
- Dialogue must be plain spoken text (no emoji, no stage directions).
"""

SYSTEM_PROMPT = (
    "You are a children's educational cartoon script writer. "
    "You ALWAYS respond with valid JSON only, no markdown, no commentary."
)


def _extract_json(text: str) -> dict:
    """Parse a JSON object from LLM output, tolerating noise around it."""
    text = text.strip()
    # strip code fences if the model wrapped them
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()

    attempts = [text]
    # try raw, then first { ... last }
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        attempts.append(text[start : end + 1])
    # also try after removing non-json prefixes (e.g. leading prose)
    if start != -1:
        attempts.append(text[start:])

    for candidate in attempts:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    raise ValueError(f"could not extract JSON from model output: {text[:400]!r}")


def generate_script(
    topic: str,
    *,
    target_duration_s: int | None = None,
    scene_duration_s: int | None = None,
    model: str | None = None,
    client: OpenRouterClient | None = None,
    language: str | None = None,
) -> dict:
    client = client or OpenRouterClient()
    lang = (language or cfg.language).lower()
    target = target_duration_s or cfg.video_duration
    per_scene = scene_duration_s or cfg.scene_duration
    n_scenes = max(1, round(target / per_scene))

    if lang == "hi":
        lang_rule = (
            "- Write ALL dialogue and title in HINDI (Devanagari script).\n"
            "- dialogue must be simple Hindi a kid can understand.\n"
            "- Never include stray words like 'वाक्य' or numbering labels inside dialogue.\n"
            "- video_prompt: describe the scene in English BUT include the spoken line in Hindi in quotes, e.g. \n"
            '  "...the Mom says, \\"गाजर आँखों के लिए अच्छा होता है\\", with matching lip movement."'
        )
    else:
        lang_rule = (
            "- Write all dialogue and title in English.\n"
            "- dialogue must be clean spoken English, no stray labels.\n"
            "- video_prompt: include the exact spoken line in quotes so the video model speaks it, e.g. \n"
            '  "...the Mom says, \\"Carrots are good for your eyes\\", with matching lip movement."'
        )

    user = f"""Topic: {topic}
Target total duration: {target} seconds.
Number of scenes: {n_scenes} (each ~{per_scene} seconds).

Return JSON exactly like:
{{
  "title": "short catchy title",
  "hook": "Mom's opening line (1 sentence)",
  "scenes": [
    {{
      "id": 1,
      "speaker": "mom",
      "dialogue": "one short spoken line",
      "visual": "what's happening on screen, one sentence",
      "video_prompt": "3D Pixar-style cartoon, warm lighting, vertical composition. [describe scene + action]",
      "duration": {per_scene}
    }}
  ]
}}

Rules:
- You MUST return EXACTLY {n_scenes} scenes in the "scenes" array — no fewer, no more.
- With more scenes, EXPAND the content: each scene covers a distinct beat (hook, benefit 1, benefit 2, son's question, mom's answer, fun ending). Do NOT repeat or split the same idea — add genuinely new content per scene.
- Mix speakers; include at least one son line.
- dialogue must be kid-friendly, simple, no emoji, no stray words.
- {lang_rule}
"""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": STYLE_GUIDE + "\n\n" + user},
    ]
    raw = client.chat(messages, model=model, temperature=0.7)
    script = _extract_json(raw)
    # normalize + enforce exactly n_scenes
    scenes = script.get("scenes", [])
    if len(scenes) != n_scenes:
        # pad or truncate so we always have exactly n_scenes
        scenes = scenes[:n_scenes]
        while len(scenes) < n_scenes:
            scenes.append({
                "speaker": "mom" if len(scenes) % 2 == 0 else "son",
                "dialogue": f"Scene {len(scenes)+1}: let's keep learning about {topic}.",
                "visual": f"Mom and son talking about {topic}.",
                "video_prompt": (
                    f"3D cartoon, Pixar style, warm lighting, vertical composition. "
                    f"Mom and son talking about {topic}, gentle motion."
                ),
            })
    for i, sc in enumerate(scenes):
        sc["id"] = i + 1
        sc.setdefault("duration", per_scene)
        sc.setdefault("speaker", "mom")
        sc.setdefault("dialogue", "")
        sc.setdefault("visual", "")
        sc.setdefault("video_prompt", sc.get("video_prompt") or sc.get("visual") or "")
    script["scenes"] = scenes
    script["topic"] = topic
    return script


def save_script(script: dict, topic_slug: str) -> Path:
    cfg.scripts_dir.mkdir(parents=True, exist_ok=True)
    path = cfg.scripts_dir / f"{topic_slug}.json"
    path.write_text(json.dumps(script, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


if __name__ == "__main__":
    s = generate_script("Why carrots are good for your eyes")
    print(json.dumps(s, indent=2, ensure_ascii=False))
