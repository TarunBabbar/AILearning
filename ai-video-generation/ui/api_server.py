"""FastAPI server that wraps the OpenRouter cartoon pipeline for the UI.

Step-by-step flow with per-stage approval + retry:
  POST /api/start          → create a job (topic, language, duration)
  POST /api/{job}/script   → generate script (returns scenes for review)
  POST /api/{job}/video    → generate scene videos (from approved script)
  POST /api/{job}/voice    → generate voice-over (Edge-TTS)
  POST /api/{job}/assemble → build final mp4
  GET  /api/{job}          → job state (current step, retries, files)
  GET  /api/video/{file}   → serve a generated video
  GET  /api/topics         → built-in topics
  GET  /api/config         → UI config

All settings from api_config.json (no hardcoded values).
This only WRAPS the pipeline — does not modify video_gen/.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as PathParam
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

API_CONFIG_PATH = Path(__file__).resolve().parent / "api_config.json"
if not API_CONFIG_PATH.exists():
    API_CONFIG_PATH = Path(__file__).resolve().parent / "api_config.json.example"
API_CFG = json.loads(API_CONFIG_PATH.read_text(encoding="utf-8"))


def _resolve_config_path(value: str) -> Path:
    p = Path(value)
    if not p.is_absolute():
        p = (API_CONFIG_PATH.parent / p).resolve()
    return p


PIPELINE_CWD = _resolve_config_path(API_CFG["pipeline_cwd"])
PIPELINE_MAIN = API_CFG["pipeline_main"]
OUTPUT_DIR = _resolve_config_path(API_CFG["output_dir"])
PYTHON = API_CFG["python_interpreter"]
ALLOWED_LANGS = API_CFG["allowed_languages"]
ALLOWED_DURATIONS = API_CFG["allowed_durations"]
DEFAULT_LANG = API_CFG["default_language"]
DEFAULT_DUR = API_CFG["default_duration"]
MAX_WAIT = API_CFG["max_wait_seconds"]
ALLOW_MOCK = API_CFG["allow_mock"]
MAX_RETRIES = API_CFG.get("max_retries_per_step", 3)

app = FastAPI(title="Mom & Son Cartoon Generator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRequest(BaseModel):
    topic: str
    language: str = DEFAULT_LANG
    duration: int = DEFAULT_DUR
    mock: bool = False


class StepRequest(BaseModel):
    force_retry: bool = False


# ------------------------------------------------------------------ state
# in-memory job store: id -> {topic, language, duration, mock, step, retries, script}
JOBS: dict[str, dict] = {}


def _slugify(text: str) -> str:
    import re
    import hashlib
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if s:
        return s
    return "hi-" + hashlib.md5(text.encode("utf-8")).hexdigest()[:10] if DEFAULT_LANG == "hi" else "topic-" + hashlib.md5(text.encode("utf-8")).hexdigest()[:10]


def _run_pipeline(args: list[str], timeout: int) -> tuple[int, str, str]:
    """Run the pipeline CLI and return (returncode, stdout, stderr).

    Decodes output as UTF-8 explicitly — the pipeline prints Hindi/Devanagari,
    and Windows' default cp1252 cannot decode it (caused UnicodeDecodeError).
    """
    cmd = [PYTHON, PIPELINE_MAIN] + args
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=str(PIPELINE_CWD),
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "pipeline step timed out")
    return proc.returncode, proc.stdout or "", proc.stderr or ""


def _parse_script(stdout: str) -> dict | None:
    """Parse the script from a dedicated script-print block."""
    try:
        marker = "=== SCRIPT ==="
        if marker in stdout:
            return json.loads(stdout.split(marker, 1)[1].strip())
    except json.JSONDecodeError:
        pass
    return None


def _job_or_404(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


def _step_cmd(job: dict, step: str, force: bool) -> list[str]:
    """Build the CLI args for a given step. Uses a --step flag on main.py."""
    cmd = [
        "--topic", job["topic"],
        "--lang", job["language"],
        "--duration", str(job["duration"]),
        "--step", step,
    ]
    if job.get("mock"):
        cmd.append("--mock")
    if force:
        cmd.append("--no-cache")
    return cmd


# ------------------------------------------------------------------ routes
@app.get("/api/topics")
def list_topics() -> dict:
    import sys
    sys.path.insert(0, str(PIPELINE_CWD))
    from cartoon_gen.topics import TOPICS  # read-only
    return {"topics": TOPICS}


@app.get("/api/config")
def get_config() -> dict:
    return {
        "languages": ALLOWED_LANGS,
        "durations": ALLOWED_DURATIONS,
        "default_language": DEFAULT_LANG,
        "default_duration": DEFAULT_DUR,
        "allow_mock": ALLOW_MOCK,
        "max_retries_per_step": MAX_RETRIES,
    }


@app.post("/api/start")
def start(req: StartRequest) -> dict:
    if not req.topic.strip():
        raise HTTPException(400, "topic is required")
    if req.language not in ALLOWED_LANGS:
        raise HTTPException(400, f"language must be one of {ALLOWED_LANGS}")
    if req.duration not in ALLOWED_DURATIONS:
        raise HTTPException(400, f"duration must be one of {ALLOWED_DURATIONS}")
    if req.mock and not ALLOW_MOCK:
        raise HTTPException(400, "mock mode is disabled")

    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "id": job_id,
        "topic": req.topic,
        "language": req.language,
        "duration": req.duration,
        "mock": req.mock,
        "slug": _slugify(req.topic),
        "step": "script",        # current pending step
        "retries": {"script": 0, "video": 0, "voice": 0, "assemble": 0},
        "script": None,
        "clips": [],
        "audios": [],
        "final": None,
        "created_at": time.time(),
    }
    return JOBS[job_id]


@app.get("/api/{job_id}")
def get_job(job_id: str) -> dict:
    return _job_or_404(job_id)


@app.post("/api/{job_id}/script")
async def run_script_step(job_id: str, req: StepRequest) -> dict:
    job = _job_or_404(job_id)
    force = req.force_retry or job["step"] != "script"
    code, out, err = await run_in_threadpool(_run_pipeline, _step_cmd(job, "script", force), MAX_WAIT)
    if code != 0:
        job["retries"]["script"] += 1
        raise HTTPException(500, f"script step failed:\n{err[-1000:]}")
    script = _parse_script(out)
    if not script:
        # script must be present + parseable before advancing
        job["retries"]["script"] += 1
        raise HTTPException(500, "script step produced no parseable script:\n" + (err or out)[-1000:])
    job["script"] = script
    job["step"] = "video"   # script approved → next is video
    job["retries"]["script"] = 0
    return job


@app.post("/api/{job_id}/video")
async def run_video_step(job_id: str, req: StepRequest) -> dict:
    job = _job_or_404(job_id)
    force = req.force_retry
    if not job.get("script"):
        raise HTTPException(400, "script must be approved first")
    code, out, err = await run_in_threadpool(_run_pipeline, _step_cmd(job, "video", force), MAX_WAIT)
    if code != 0:
        job["retries"]["video"] += 1
        raise HTTPException(500, f"video step failed:\n{err[-1000:]}")
    job["clips"] = _parse_paths(out, "CLIPS")
    job["step"] = "voice"
    job["retries"]["video"] = 0
    return job


@app.post("/api/{job_id}/voice")
async def run_voice_step(job_id: str, req: StepRequest) -> dict:
    job = _job_or_404(job_id)
    force = req.force_retry
    code, out, err = await run_in_threadpool(_run_pipeline, _step_cmd(job, "voice", force), MAX_WAIT)
    if code != 0:
        job["retries"]["voice"] += 1
        raise HTTPException(500, f"voice step failed:\n{err[-1000:]}")
    job["audios"] = _parse_paths(out, "AUDIOS")
    job["step"] = "assemble"
    job["retries"]["voice"] = 0
    return job


@app.post("/api/{job_id}/assemble")
async def run_assemble_step(job_id: str, req: StepRequest) -> dict:
    job = _job_or_404(job_id)
    force = req.force_retry
    code, out, err = await run_in_threadpool(_run_pipeline, _step_cmd(job, "assemble", force), MAX_WAIT)
    if code != 0:
        job["retries"]["assemble"] += 1
        raise HTTPException(500, f"assemble step failed:\n{err[-1000:]}")
    final = _parse_paths(out, "FINAL")
    job["final"] = final[0] if final else None
    job["step"] = "done"
    job["retries"]["assemble"] = 0
    return job


def _parse_paths(stdout: str, marker: str) -> list[str]:
    try:
        if marker in stdout:
            data = json.loads(stdout.split(marker, 1)[1].strip())
            if isinstance(data, list):
                return data
    except json.JSONDecodeError:
        pass
    return []


@app.get("/api/video/{filename}")
def serve_video(filename: str = PathParam(...)):
    out_dir = OUTPUT_DIR.resolve()
    path = (out_dir / filename).resolve()
    if not str(path).startswith(str(out_dir)):
        raise HTTPException(400, "invalid filename")
    if not path.exists():
        raise HTTPException(404, "video not found")
    return FileResponse(path, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_CFG["host"], port=API_CFG["port"], reload=API_CFG["reload"])
