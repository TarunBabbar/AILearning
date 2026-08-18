"""Command Code provider — headless one-shot via `cmdc -p`.

Config from .env:
    CMDCODE_BIN=              (optional; default "cmdc" from PATH)
    LLM_MODEL=                (optional cmdc model id; blank = cmdc's configured model)

Uses --output-format json and extracts text from the NDJSON event stream.
"""
import json
import os
import subprocess

from ...config import settings
from .base import LLMProvider


class CommandCodeProvider(LLMProvider):
    name = "command-code"

    def complete(
        self,
        prompt: str,
        system: str | None = None,
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        json_mode: bool = False,
        tools: list[dict] | None = None,
        model: str | None = None,
    ) -> str:
        del temperature, max_tokens, json_mode, tools  # cmdc handles these internally
        binary = os.environ.get("CMDCODE_BIN") or settings.cmdcode_bin or "cmdc"
        full_prompt = f"{system}\n\n{prompt}" if system else prompt

        cmd = [binary, "-p", full_prompt, "--output-format", "json"]
        if model or settings.llm_model:
            cmd += ["-m", model or settings.llm_model]

        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
        except FileNotFoundError as exc:
            raise RuntimeError(
                "command-code binary not found — set CMDCODE_BIN in .env or add cmdc to PATH"
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("command-code timed out") from exc

        if proc.returncode != 0:
            raise RuntimeError(f"command-code failed ({proc.returncode}): {proc.stderr[-500:]}")

        return self._extract_text(proc.stdout)

    @staticmethod
    def _extract_text(stdout: str) -> str:
        """NDJSON events + final result line; fall back to raw stdout."""
        try:
            for line in stdout.strip().splitlines():
                line = line.strip()
                if not line.startswith("{"):
                    continue
                event = json.loads(line)
                if isinstance(event, dict):
                    content = (
                        event.get("text")
                        or event.get("content")
                        or event.get("output")
                        or event.get("message")
                    )
                    if isinstance(content, str) and content:
                        return content
        except json.JSONDecodeError:
            pass
        return stdout.strip()
