"""Final assembly with ffmpeg.

Takes per-scene video clips + per-scene TTS audio and produces the final 9:16
mp4:
  1. Normalize each clip to a common fps/resolution and the target duration.
  2. Mux the scene's TTS audio (or keep the clip's own audio).
  3. Concatenate all scenes into the final video.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .config import cfg


class AssemblyError(Exception):
    pass


def _run(cmd: list[str]) -> None:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=cfg.ffmpeg_timeout_s)
    except subprocess.TimeoutExpired as e:
        raise AssemblyError(f"ffmpeg timed out: {' '.join(cmd[:8])}...") from e
    if proc.returncode != 0:
        raise AssemblyError(f"ffmpeg failed ({proc.returncode}):\n{proc.stderr[-2000:]}")



def _probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, timeout=cfg.http_timeout_s,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def _normalize_clip(clip: Path, out: Path, duration: float, fps: int, size: str,
                    keep_audio: bool = False) -> Path:
    """Trim/pad/scale a clip to a fixed duration + fps + resolution.

    If keep_audio is True, the clip's own audio track is preserved (so the
    video model's lip-synced speech is kept); otherwise the clip is silent.
    """
    size_w, size_h = size.split("x")
    cmd = [
        "ffmpeg", "-y", "-i", str(clip),
        "-vf", (
            f"scale={size_w}:{size_h}:force_original_aspect_ratio=decrease,"
            f"pad={size_w}:{size_h}:(ow-iw)/2:(oh-ih)/2,setsar=1,"
            f"fps={fps}"
        ),
        "-t", f"{duration}",
        "-c:v", cfg.video_codec, "-preset", cfg.video_preset, "-crf", str(cfg.video_crf),
    ]
    if keep_audio:
        cmd += ["-c:a", cfg.audio_codec, "-b:a", cfg.audio_bitrate]
    else:
        cmd += ["-an"]
    cmd += [str(out)]
    _run(cmd)
    return out


def _mux_audio(video: Path, audio: Path | None, out: Path, duration: float) -> Path:
    """Add TTS audio track to a silent video. If no audio, copy video through."""
    if audio is None or not audio.exists():
        return video
    cmd = [
        "ffmpeg", "-y", "-i", str(video), "-i", str(audio),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", cfg.audio_codec, "-b:a", cfg.audio_bitrate,
        "-shortest",
        str(out),
    ]
    _run(cmd)
    return out


def _concat_list(parts: list[Path], out: Path, fps: int, size: str) -> Path:
    """Concatenate already-normalized clips via concat demuxer."""
    list_file = out.with_suffix(".txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in parts:
            f.write(f"file '{p.as_posix()}'\n")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-c:v", cfg.video_codec, "-preset", cfg.video_preset, "-crf", str(cfg.video_crf),
        "-c:a", cfg.audio_codec, "-b:a", cfg.audio_bitrate,
        "-movflags", "+faststart",
        str(out),
    ]
    _run(cmd)
    return out


def _concat_list(parts: list[Path], out: Path, fps: int, size: str) -> Path:
    """Concatenate already-normalized clips via concat demuxer."""
    list_file = out.with_suffix(".txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in parts:
            f.write(f"file '{p.as_posix()}'\n")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-c:v", cfg.video_codec, "-preset", cfg.video_preset, "-crf", str(cfg.video_crf),
        "-c:a", cfg.audio_codec, "-b:a", cfg.audio_bitrate,
        "-movflags", "+faststart",
        str(out),
    ]
    _run(cmd)
    return out


def assemble_video(
    clips: list[Path],
    *,
    audios: list[Path | None] | None = None,
    durations: list[float] | None = None,
    out_path: Path | None = None,
    fps: int | None = None,
    size: str | None = None,
    workdir: Path | None = None,
    keep_clip_audio: bool | None = None,
) -> Path:
    """Assemble the final video from scene clips + optional per-scene audio.

    clips:      list of scene mp4 paths (already generated)
    audios:     parallel list of TTS audio paths (or None to keep clip audio)
    durations:  per-scene target durations (defaults to cfg.scene_duration)
    keep_clip_audio: if True, keep each clip's own audio (video-model lip-synced
        speech) instead of replacing it with the TTS audio. Defaults to
        cfg.keep_clip_audio.
    """
    fps = fps or cfg.video_fps
    size = size or cfg.output_size
    if not size or "x" not in size:
        raise AssemblyError(f"config.output_size missing or invalid: {cfg.output_size!r}")
    workdir = workdir or (cfg.output_dir / "work")
    workdir.mkdir(parents=True, exist_ok=True)
    if keep_clip_audio is None:
        keep_clip_audio = cfg.keep_clip_audio

    n = len(clips)
    audios = audios or [None] * n
    if len(audios) < n:
        audios = audios + [None] * (n - len(audios))
    durations = durations or [float(cfg.scene_duration)] * n

    normalized: list[Path] = []
    for i, clip in enumerate(clips):
        if not clip.exists():
            raise AssemblyError(f"clip missing: {clip}")
        dur = durations[i] if i < len(durations) else float(cfg.scene_duration)

        # 1) normalize (fixed size/fps/duration). Keep clip audio if configured
        #    so the video model's own lip-synced speech survives.
        norm = workdir / f"scene{i:02d}_norm.mp4"
        _normalize_clip(clip, norm, dur, fps, size, keep_audio=keep_clip_audio)

        # 2) mux external TTS audio (only when NOT keeping clip audio)
        audio = audios[i] if i < len(audios) else None
        if not keep_clip_audio and audio is not None and Path(audio).exists():
            final_scene = workdir / f"scene{i:02d}_ready.mp4"
            _mux_audio(norm, Path(audio), final_scene, dur)
            normalized.append(final_scene)
        else:
            normalized.append(norm)

    # 3) concat
    out_path = out_path or (cfg.output_dir / "final.mp4")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    return _concat_list(normalized, out_path, fps, size)


def probe_duration(path: Path) -> float:
    return _probe_duration(path)
