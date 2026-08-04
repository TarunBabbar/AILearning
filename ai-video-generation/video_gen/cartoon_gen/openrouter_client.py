"""Thin OpenRouter API client (stdlib only: urllib + json).

Covers the four endpoints this project needs:
  - chat/completions          (script generation)
  - images/generations        (character reference images)
  - videos (async job)        (scene video generation)
  - audio/speech (TTS)        (voice-over)

Every call raises OpenRouterError on failure; no silent retries.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from .config import cfg


class OpenRouterError(Exception):
    """Raised for any failed OpenRouter API interaction."""


@dataclass
class JobStatus:
    id: str
    status: str
    unsigned_urls: list[str]
    error: str | None
    usage_cost: float
    model: str | None


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or cfg.api_key
        self.base_url = base_url or cfg.base_url
        if not self.api_key:
            raise OpenRouterError(
                "OpenRouter API key is not set — set api_key in video_gen/config.json "
                "or OPENROUTER_API_KEY in the environment"
            )

    # ------------------------------------------------------------------ utils
    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": cfg.user_agent,
        }
        if extra:
            h.update(extra)
        return h

    def _post(self, path: str, body: dict[str, Any], timeout: int | None = None) -> dict[str, Any]:
        # Safety guard: only the chat model is free. Image/video/TTS cost money.
        # Block paid endpoints unless explicitly enabled in config.json.
        if not cfg.allow_paid_calls:
            paid_paths = ("/images/generations", "/videos", "/audio/speech")
            if any(path.startswith(p) for p in paid_paths):
                raise OpenRouterError(
                    f"BLOCKED: {path} is a paid endpoint and 'allow_paid_calls' "
                    "is false in config.json. Set it to true to enable paid calls."
                )
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout or cfg.request_timeout_s) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            raise OpenRouterError(f"POST {path} -> HTTP {e.code}: {detail[:500]}") from e
        except urllib.error.URLError as e:
            raise OpenRouterError(f"POST {path} -> {e.reason}") from e
        except TimeoutError as e:
            raise OpenRouterError(f"POST {path} -> timed out") from e

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with urllib.request.urlopen(req, timeout=cfg.http_timeout_s) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            raise OpenRouterError(f"GET {path} -> HTTP {e.code}: {detail[:500]}") from e
        except urllib.error.URLError as e:
            raise OpenRouterError(f"GET {path} -> {e.reason}") from e

    # ------------------------------------------------------------------ chat
    def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        **extra: Any,
    ) -> str:
        """Call the chat model with automatic fallback to other free models.

        Tries cfg.chat_model first, then each cfg.chat_model_fallbacks in order
        if the primary errors or times out.
        """
        model_chain = [model or cfg.chat_model] + [
            m for m in cfg.chat_model_fallbacks if m != (model or cfg.chat_model)
        ]
        last_err: Exception | None = None
        for m in model_chain:
            try:
                body: dict[str, Any] = {
                    "model": m,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    **extra,
                }
                resp = self._post("/chat/completions", body, timeout=cfg.chat_timeout_s)
                try:
                    return resp["choices"][0]["message"]["content"]
                except (KeyError, IndexError, TypeError) as e:
                    last_err = OpenRouterError(f"chat: unexpected response shape: {str(resp)[:300]}")
                    continue
            except OpenRouterError as e:
                last_err = e
                print(f"[chat] model '{m}' failed ({e}); trying next")
                continue
        raise last_err or OpenRouterError("all chat models failed")

    # ----------------------------------------------------------------- image
    def generate_image(self, prompt: str, model: str | None = None, size: str | None = None, **extra: Any) -> bytes:
        """Generate an image. Omit `size` to let the model pick its default (some
        models like seedream-4.5 require a minimum pixel count)."""
        body: dict[str, Any] = {
            "model": model or cfg.image_model,
            "prompt": prompt,
            **extra,
        }
        if size:
            body["size"] = size
        resp = self._post("/images/generations", body)
        try:
            # OpenRouter returns b64 JSON for images
            b64 = resp["data"][0]["b64_json"]
            import base64
            return base64.b64decode(b64)
        except (KeyError, IndexError) as e:
            # some providers return a URL instead
            url = resp["data"][0].get("url")
            if url:
                return self._download(url)
            raise OpenRouterError(f"generate_image: unexpected response: {str(resp)[:300]}") from e

    def _download(self, url: str) -> bytes:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "cartoon-gen/0.1",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()

    # ----------------------------------------------------------------- video
    def create_video_job(
        self,
        prompt: str,
        model: str | None = None,
        *,
        duration: int | None = None,
        resolution: str | None = None,
        aspect_ratio: str | None = None,
        size: str | None = None,
        input_references: list[str] | None = None,   # image URLs (style guidance)
        frame_images: list[dict[str, Any]] | None = None,  # first/last frame control
        generate_audio: bool = True,
        callback_url: str | None = None,
        **extra: Any,
    ) -> str:
        body: dict[str, Any] = {
            "model": model or cfg.video_model,
            "prompt": prompt,
            "generate_audio": generate_audio,
            **extra,
        }
        if duration is not None:
            body["duration"] = duration
        if resolution is not None:
            body["resolution"] = resolution or cfg.video_resolution
        if aspect_ratio is not None:
            body["aspect_ratio"] = aspect_ratio or cfg.video_aspect_ratio
        if size:
            body["size"] = size
        if input_references:
            body["input_references"] = [{"type": "image_url", "image_url": {"url": u}} for u in input_references]
        if frame_images:
            body["frame_images"] = frame_images
        if callback_url:
            body["callback_url"] = callback_url
        resp = self._post("/videos", body)
        job_id = resp.get("id")
        if not job_id:
            raise OpenRouterError(f"create_video_job: no id in response: {str(resp)[:300]}")
        return job_id

    def get_video_job(self, job_id: str) -> JobStatus:
        resp = self._get(f"/videos/{job_id}")
        return JobStatus(
            id=resp.get("id", job_id),
            status=resp.get("status", "unknown"),
            unsigned_urls=resp.get("unsigned_urls", []),
            error=resp.get("error"),
            usage_cost=float(resp.get("usage", {}).get("cost", 0.0) or 0.0),
            model=resp.get("model"),
        )

    def wait_video_job(
        self,
        job_id: str,
        poll_interval_s: int | None = None,
        max_minutes: int | None = None,
        progress: bool = True,
    ) -> JobStatus:
        interval = poll_interval_s or cfg.poll_interval_s
        max_min = max_minutes or cfg.max_poll_minutes
        deadline = time.time() + max_min * 60
        while True:
            status = self.get_video_job(job_id)
            if status.status in ("completed", "failed", "cancelled", "expired"):
                return status
            if time.time() > deadline:
                raise OpenRouterError(f"video job {job_id} timed out after {max_min} min (status={status.status})")
            if progress:
                print(f"    [video] job {job_id} status={status.status} ... waiting {interval}s")
            time.sleep(interval)

    def download_video(self, job_id: str, dest: str, index: int = 0, retries: int = 3) -> str:
        # check current state directly (job may already be completed)
        status = self.get_video_job(job_id)
        if status.status != "completed":
            status = self.wait_video_job(job_id)
        if status.status != "completed" or not status.unsigned_urls:
            raise OpenRouterError(f"video job {job_id} not completed: {status.status} {status.error or ''}")
        url = status.unsigned_urls[index]

        # transient download failures (e.g. content still finalizing) -> retry
        last_err: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                data = self._download(url)
                with open(dest, "wb") as f:
                    f.write(data)
                return dest
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
                last_err = e
                if attempt < retries:
                    print(f"    [video] download attempt {attempt} failed ({e}); retrying in {attempt * 10}s")
                    time.sleep(attempt * 10)
        raise OpenRouterError(f"video job {job_id} download failed: {last_err}") from last_err

    # ------------------------------------------------------------------- TTS
    def text_to_speech(self, text: str, dest: str, model: str | None = None, **extra: Any) -> str:
        """Generate speech audio for `text`, save to `dest`, return path.

        OpenRouter TTS model set is currently small (google/lyria-3-pro-preview,
        openai/gpt-audio*). If your chosen model returns an error, swap cfg.tts_model.
        """
        body: dict[str, Any] = {
            "model": model or cfg.tts_model,
            "input": text,
            **extra,
        }
        resp = self._post("/audio/speech", body)
        audio_b64 = resp.get("data", {}).get("audio_base64") or resp.get("audio_base64")
        if audio_b64:
            import base64
            with open(dest, "wb") as f:
                f.write(base64.b64decode(audio_b64))
            return dest
        url = resp.get("data", {}).get("url") or resp.get("url")
        if url:
            with open(dest, "wb") as f:
                f.write(self._download(url))
            return dest
        raise OpenRouterError(f"text_to_speech: unexpected response: {str(resp)[:300]}")


def test_connection() -> dict[str, Any]:
    """Quick sanity check that the key + endpoints respond."""
    client = OpenRouterClient()
    resp = client._get("/key")
    return resp.get("data", {})


if __name__ == "__main__":
    info = test_connection()
    print(f"API key label: {info.get('label', '?')}")
    print(f"usage: {info.get('usage', '?')}")
