"""API server for audio_first — background jobs + polling (no blocking socket-hang).

Flow:
  POST /api/jobs          → start a job (topic, lang, duration, model, mock) → returns job_id immediately
  GET  /api/jobs/{id}     → job state: step, status, progress, result, cost estimate
  GET  /api/video/{file}  → serve final video
  GET  /api/models        → model list with cost details (for the UI)
  GET  /api/topics        → built-in topics

The pipeline runs in a background thread; the HTTP request returns immediately,
so no connection can drop during a 1-5 min video generation.
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import cfg
from pipeline import (
    PipelineError,
    assemble,
    download_video,
    generate_script,
    generate_tts,
    create_video_job,
    convert_script_to_scenes,
)

app = FastAPI(title="Audio-First Cartoon Generator")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

OUT_DIR = Path(cfg.output_dir)
CHAR_DIR = Path(cfg.characters_dir)


class StartRequest(BaseModel):
    topic: str = ""
    script_text: str = ""          # user's own script (Mode B)
    input_mode: str = "topic"      # "topic" | "own_script"
    language: str = cfg.language
    duration: int = 10
    model: str = cfg.default_video_model
    mock: bool = False


class Job:
    def __init__(self, req: StartRequest):
        self.id = uuid.uuid4().hex[:12]
        self.topic = req.topic
        self.script_text = req.script_text
        self.input_mode = req.input_mode
        self.language = req.language
        self.duration = req.duration
        self.model = req.model
        self.mock = req.mock
        self.status = "pending"        # pending|running|done|error
        self.step = "script"           # script|tts|video|assemble|done
        self.message = "queued"
        self.result = None
        self.error = None
        self.created_at = time.time()
        self.elapsed_s = 0
        self.cost_estimate = 0.0
        self.script = None

    def to_dict(self) -> dict:
        return {
            "id": self.id, "topic": self.topic, "language": self.language,
            "duration": self.duration, "model": self.model, "mock": self.mock,
            "status": self.status, "step": self.step, "message": self.message,
            "error": self.error, "elapsed_s": round(self.elapsed_s, 1),
            "cost_estimate": round(self.cost_estimate, 3),
            "script": self.script,
            "result": self.result,
        }


JOBS: dict[str, Job] = {}


def _slugify(text: str) -> str:
    import hashlib, re
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s if s else "job-" + hashlib.md5(text.encode()).hexdigest()[:8]


def _char_refs() -> list[str]:
    refs = []
    for name in ("mom", "son"):
        p = CHAR_DIR / f"{name}.png"
        if p.exists():
            import base64
            b64 = base64.b64encode(p.read_bytes()).decode("ascii")
            refs.append(f"data:image/png;base64,{b64}")
    return refs


def _estimate_cost(model_id: str, n_scenes: int, duration: int) -> float:
    m = cfg.video_models.get(model_id)
    if not m:
        return 0.0
    secs = n_scenes * cfg.scene_duration
    return round(secs * float(m.get("cost_per_second", 0)), 3)


def _slug_from_job(job: Job) -> str:
    import hashlib
    if job.topic.strip():
        return _slugify(job.topic)
    # own-script mode: short hash of the script so filenames stay sane
    h = hashlib.md5(job.script_text.encode("utf-8")).hexdigest()[:8]
    return f"script-{h}"


def _run_script_step(job: Job) -> None:
    """Generate (or convert) the script, then STOP for user review."""
    n_scenes = max(1, round(job.duration / cfg.scene_duration))
    job.cost_estimate = _estimate_cost(job.model, n_scenes, job.duration)
    job.step, job.status, job.message = "script", "running", "generating script..."
    if job.input_mode == "own_script" and job.script_text.strip():
        job.script = convert_script_to_scenes(job.script_text, n_scenes, job.language)
        job.message = "script converted from your text — review it"
    else:
        job.script = generate_script(job.topic, n_scenes, job.language)
        job.message = "script generated — review it"
    # STOP here — wait for the user to approve, then run tts/video/assemble
    job.status = "review"   # waiting for user approval


def _run_tts_step(job: Job) -> None:
    slug = _slug_from_job(job)
    job.step, job.status, job.message = "tts", "running", "generating voice-over (Edge-TTS)..."
    audio_dir = OUT_DIR / "audio" / slug
    audio_dir.mkdir(parents=True, exist_ok=True)
    audios: list[Path] = []
    for sc in job.script.get("scenes", []):
        text = sc.get("dialogue", "")
        if not text:
            continue
        ap = audio_dir / f"scene{sc['id']:02d}.mp3"
        if not (ap.exists() and cfg.skip_existing):
            generate_tts(text, ap, job.language)
        audios.append(ap)
    job._audio_paths = audios
    job.status = "ready"   # voice done — user approves to run video


def _run_video_step(job: Job) -> None:
    slug = _slug_from_job(job)
    job.step, job.message = "video", "generating scene videos (this can take a few minutes)..."
    model_cfg = cfg.video_models.get(job.model) or {}
    n_scenes = len(job.script.get("scenes", []))
    refs = _char_refs() if not job.mock else []
    audios = getattr(job, "_audio_paths", [])
    clips: list[Path] = []
    for sc in job.script.get("scenes", []):
        sid = sc["id"]
        clip = OUT_DIR / "clips" / f"{slug}_scene{sid:02d}.mp4"
        if clip.exists() and cfg.skip_existing and not job.mock:
            clips.append(clip)
            continue
        if job.mock:
            _mock_clip(clip, sc)
        else:
            audio = audios[sid - 1] if 0 <= sid - 1 < len(audios) else None
            if model_cfg.get("supports_audio_input") and audio is not None:
                job_id = create_video_job(
                    sc.get("video_prompt", ""), job.model,
                    duration=cfg.scene_duration,
                    resolution=model_cfg.get("resolution", "720p"),
                    aspect_ratio=model_cfg.get("aspect_ratio", "9:16"),
                    input_references=refs, audio_path=audio,
                )
            else:
                job_id = create_video_job(
                    sc.get("video_prompt", ""), job.model,
                    duration=cfg.scene_duration,
                    resolution=model_cfg.get("resolution", "720p"),
                    aspect_ratio=model_cfg.get("aspect_ratio", "9:16"),
                    input_references=refs, audio_path=None,
                )
            download_video(job_id, clip)
        clips.append(clip)
        job.message = f"scene {sid}/{n_scenes} done"
    job._clips = clips
    job.status = "ready"   # video done — user approves to assemble


def _run_assemble_step(job: Job) -> None:
    slug = _slug_from_job(job)
    job.step, job.message = "assemble", "assembling final video..."
    clips = getattr(job, "_clips", [])
    final = OUT_DIR / f"{slug}.mp4"
    if not (final.exists() and cfg.skip_existing and not job.mock):
        assemble(clips, final)
    job.result = {"final": str(final), "clips": [str(c) for c in clips],
                  "scenes": len(job.script.get("scenes", [])), "slug": slug}
    job.step, job.status, job.message = "done", "done", "video ready"


def _run_job(job: Job) -> None:
    """Background thread: only runs the script step, then waits for approval."""
    t0 = time.time()
    try:
        _run_script_step(job)
    except Exception as e:
        job.status = "error"
        job.error = str(e)[:500]
        job.message = "failed"
    finally:
        job.elapsed_s = round(time.time() - t0, 1)


def _mock_clip(dest: Path, sc: dict) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    w, h = cfg.output_size.split("x")
    subprocess_ffmpeg(["ffmpeg", "-y",
                       "-f", "lavfi", "-i", f"testsrc2=size={w}x{h}:rate={cfg.video_fps}",
                       "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
                       "-t", str(cfg.scene_duration),
                       "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                       "-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p", str(dest)])


def subprocess_ffmpeg(cmd):
    import subprocess
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise PipelineError(f"ffmpeg: {r.stderr[-500:]}")


@app.post("/api/jobs")
def start_job(req: StartRequest) -> dict:
    # require topic (mode A) OR own script (mode B)
    has_topic = bool(req.topic.strip())
    has_script = bool(req.script_text.strip())
    if req.input_mode == "own_script":
        if not has_script:
            raise HTTPException(400, "own_script mode requires script_text")
    elif not has_topic:
        raise HTTPException(400, "topic required (or switch to own_script mode)")
    if req.model not in cfg.video_models:
        raise HTTPException(400, f"unknown model {req.model}")
    if req.mock and not cfg.allow_mock:
        raise HTTPException(400, "mock disabled")
    job = Job(req)
    JOBS[job.id] = job
    t = threading.Thread(target=_run_job, args=(job,), daemon=True)
    t.start()
    return job.to_dict()


class StepRequest(BaseModel):
    force_retry: bool = False


def _run_step_in_thread(job: Job, fn) -> dict:
    """Run a step in a background thread, return updated job immediately."""
    t0 = time.time()
    try:
        fn(job)
    except Exception as e:
        job.status = "error"
        job.error = str(e)[:500]
        job.message = "failed"
    finally:
        job.elapsed_s = round(time.time() - t0, 1)
    return job.to_dict()


@app.post("/api/jobs/{job_id}/tts")
def run_tts_step(job_id: str, req: StepRequest) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if not job.script or not job.script.get("scenes"):
        raise HTTPException(400, "approve the script first")
    job.status = "running"
    t = threading.Thread(target=lambda: _run_step_in_thread(job, _run_tts_step), daemon=True)
    t.start()
    return job.to_dict()


@app.post("/api/jobs/{job_id}/video")
def run_video_step(job_id: str, req: StepRequest) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if not getattr(job, "_audio_paths", None):
        raise HTTPException(400, "run voice step first")
    job.status = "running"
    t = threading.Thread(target=lambda: _run_step_in_thread(job, _run_video_step), daemon=True)
    t.start()
    return job.to_dict()


@app.post("/api/jobs/{job_id}/assemble")
def run_assemble_step(job_id: str, req: StepRequest) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if not getattr(job, "_clips", None):
        raise HTTPException(400, "run video step first")
    job.status = "running"
    t = threading.Thread(target=lambda: _run_step_in_thread(job, _run_assemble_step), daemon=True)
    t.start()
    return job.to_dict()


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job.to_dict()


@app.get("/api/models")
def list_models() -> dict:
    return {"models": cfg.video_models, "default": cfg.default_video_model}


@app.get("/api/topics")
def list_topics() -> dict:
    try:
        sys_path_insert()
        from cartoon_gen.topics import TOPICS
        return {"topics": TOPICS}
    except Exception:
        return {"topics": []}


def sys_path_insert() -> None:
    import sys
    from pathlib import Path
    vg = Path(cfg.pipeline_cwd).parent / "video_gen"
    sys.path.insert(0, str(vg))


@app.get("/api/video/{filename}")
def serve_video(filename: str = PathParam(...)):
    out_dir = OUT_DIR.resolve()
    p = (out_dir / filename).resolve()
    if not str(p).startswith(str(out_dir)):
        raise HTTPException(400, "invalid filename")
    if not p.exists():
        raise HTTPException(404, "video not found")
    return FileResponse(p, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
