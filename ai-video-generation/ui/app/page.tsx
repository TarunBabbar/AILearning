"use client";

import { useCallback, useEffect, useState } from "react";

interface ConfigInfo {
  languages: string[];
  durations: number[];
  default_language: string;
  default_duration: number;
  allow_mock: boolean;
  max_retries_per_step: number;
}

interface Scene {
  id: number;
  speaker: string;
  dialogue: string;
  visual: string;
  video_prompt?: string;
  duration?: number;
}

interface JobState {
  id: string;
  topic: string;
  language: string;
  duration: number;
  mock: boolean;
  slug: string;
  step: string;
  retries: Record<string, number>;
  script: { title?: string; scenes?: Scene[] } | null;
  clips: string[];
  audios: string[];
  final: string | null;
}

type StepKey = "script" | "video" | "voice" | "assemble" | "done";

const STEPS: { key: StepKey; label: string; desc: string }[] = [
  { key: "script", label: "Script", desc: "Review & approve scene script" },
  { key: "video", label: "Video", desc: "Generate motion clips" },
  { key: "voice", label: "Voice", desc: "Generate voice-over" },
  { key: "assemble", label: "Assemble", desc: "Stitch into final video" },
  { key: "done", label: "Done", desc: "Download your video" },
];

export default function Home() {
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("hi");
  const [duration, setDuration] = useState(10);
  const [mock, setMock] = useState(false);

  const [job, setJob] = useState<JobState | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState<StepKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cfgRes, topicsRes] = await Promise.all([
          fetch("/api/config").then((r) => r.json()),
          fetch("/api/topics").then((r) => r.json()),
        ]);
        setConfig(cfgRes);
        setTopics(topicsRes.topics || []);
        if (cfgRes.default_language) setLanguage(cfgRes.default_language);
        if (cfgRes.default_duration) setDuration(cfgRes.default_duration);
      } catch {
        setError("Could not reach the generation server. Is the FastAPI server running?");
      }
    })();
  }, []);

  const api = useCallback(async (path: string, body?: unknown) => {
    // generous timeout — free models can take 60-90s; don't hang forever
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
      return data;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error("Request timed out — the model is taking too long. Try retrying.");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const startJob = useCallback(async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }
    setError(null);
    setJob(null);
    setBusy(true);
    try {
      const j = await api("/api/start", { topic, language, duration, mock });
      setJob(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  }, [topic, language, duration, mock, api]);

  const runStep = useCallback(
    async (step: StepKey, forceRetry = false) => {
      if (!job) return;
      setBusy(true);
      setBusyStep(step);
      setError(null);
      try {
        const updated = await api(`/api/${job.id}/${step}`, { force_retry: forceRetry });
        setJob(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Step '${step}' failed`);
      } finally {
        setBusy(false);
        setBusyStep(null);
      }
    },
    [job, api]
  );

  const videoUrl = job?.final
    ? `/api/video/${encodeURIComponent(job.final.split(/[\\/]/).pop() || "")}`
    : null;
  const stepIndex = (k: string) => STEPS.findIndex((s) => s.key === k);
  const jobIdx = stepIndex(job?.step || "script");

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* header */}
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-2xl text-white shadow-sm">
            🎬
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-cream-900">
            Mom &amp; Son Cartoon Generator
          </h1>
          <p className="mt-1 text-sm text-cream-600">
            Vegetables · Fruits · Healthy foods — animated step by step
          </p>
        </header>

        {!job ? (
          /* ---- setup form ---- */
          <section className="mx-auto max-w-2xl rounded-2xl border border-cream-200 bg-cream-50 p-8 shadow-sm">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-cream-600">
              Create a video
            </h2>

            <label className="mb-1.5 block text-sm font-medium text-cream-800">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Why carrots are good for your eyes"
              className="mb-4 w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mb-4 w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">— choose a built-in topic —</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-cream-800">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {config?.languages.map((l) => (
                    <option key={l} value={l}>
                      {l === "hi" ? "हिन्दी (Hindi)" : "English"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-cream-800">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {config?.durations.map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {config?.allow_mock ? (
              <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-cream-700">
                <input
                  type="checkbox"
                  checked={mock}
                  onChange={(e) => setMock(e.target.checked)}
                  className="h-4 w-4 rounded border-cream-300 accent-accent"
                />
                Mock mode (placeholder clips, no cost)
              </label>
            ) : null}

            <button
              onClick={startJob}
              disabled={busy}
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start Pipeline"}
            </button>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </section>
        ) : (
          /* ---- pipeline view: details on top, flat pipeline below ---- */
          <div className="space-y-6">
            {/* details bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-cream-50 px-5 py-4 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-cream-900">{job.topic}</h2>
                <p className="text-xs text-cream-600">
                  {job.language.toUpperCase()} · {job.duration}s ·{" "}
                  {job.mock ? "mock mode" : "real generation"} · job {job.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setJob(null);
                  setError(null);
                }}
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-medium text-cream-700 hover:bg-cream-100"
              >
                + New video
              </button>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {/* flat horizontal pipeline with arrows */}
            <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-sm">
              <div className="flex min-w-max items-center gap-1">
                {STEPS.map((s, i) => {
                  const isDone = jobIdx > i;
                  const isActive = jobIdx === i;
                  const retries = job.retries?.[s.key] ?? 0;
                  return (
                    <div key={s.key} className="flex items-center gap-1">
                      {/* node */}
                      <div
                        className={`w-44 rounded-xl border p-3 text-center transition ${
                          isActive
                            ? "border-accent bg-accent-soft shadow-sm"
                            : isDone
                            ? "border-cream-300 bg-white"
                            : "border-cream-200 bg-white/60 opacity-70"
                        }`}
                      >
                        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: isDone || isActive ? "#b8692c" : "#e9e3d3", color: isDone || isActive ? "#fff" : "#8a7b55" }}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        <p className="text-sm font-semibold text-cream-900">{s.label}</p>
                        <p className="mt-0.5 text-[11px] leading-tight text-cream-600">{s.desc}</p>
                        {retries > 0 && (
                          <p className="mt-1 text-[10px] font-medium text-accent">
                            ↻ {retries} retr{retries === 1 ? "y" : "ies"}
                          </p>
                        )}
                        {isActive && job.step !== "done" && (
                          <button
                            onClick={() => runStep(s.key as StepKey)}
                            disabled={busy}
                            className="mt-2 w-full rounded-md bg-accent px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                          >
                            {busyStep === s.key ? "Running…" : `Generate ${s.label}`}
                          </button>
                        )}
                        {isDone && s.key !== "done" && (
                          <button
                            onClick={() => runStep(s.key as StepKey, true)}
                            disabled={busy}
                            className="mt-2 w-full rounded-md border border-cream-300 bg-white px-2 py-1.5 text-[11px] font-medium text-cream-700 hover:bg-cream-100 disabled:opacity-50"
                          >
                            {busyStep === s.key ? "Running…" : "↻ Retry"}
                          </button>
                        )}
                      </div>
                      {/* arrow */}
                      {i < STEPS.length - 1 && (
                        <div
                          className={`text-lg ${jobIdx > i ? "text-accent" : "text-cream-300"}`}
                        >
                          →
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* detail panel for the active step */}
            <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-sm">
              {job.step === "video" && job.script?.scenes ? (
                /* script review + approve gate */
                <>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">
                    Review script
                  </h3>
                  {job.script.title && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-cream-500">
                      {job.script.title}
                    </p>
                  )}
                  <div className="space-y-2">
                    {job.script.scenes.map((sc, i) => (
                      <div key={sc.id ?? i} className="rounded-lg border border-cream-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-cream-500">
                            Scene {sc.id} · {sc.speaker}
                          </p>
                          <button
                            onClick={() => setExpandedScene(expandedScene === sc.id ? null : sc.id)}
                            className="text-xs text-accent hover:underline"
                          >
                            {expandedScene === sc.id ? "hide" : "show prompt"}
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-cream-900">💬 {sc.dialogue}</p>
                        <p className="text-xs text-cream-600">👀 {sc.visual}</p>
                        {expandedScene === sc.id && sc.video_prompt && (
                          <p className="mt-2 rounded bg-cream-100 p-2 text-xs text-cream-700">
                            {sc.video_prompt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <span className="text-sm text-green-800">
                      Script looks good? Approve to continue, or retry to regenerate.
                    </span>
                    <button
                      onClick={() => runStep("video")}
                      disabled={busy}
                      className="ml-auto rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      Approve &amp; Generate Video
                    </button>
                    <button
                      onClick={() => runStep("script", true)}
                      disabled={busy}
                      className="rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-xs font-medium text-cream-700 hover:bg-cream-100 disabled:opacity-50"
                    >
                      ↻ Retry Script
                    </button>
                  </div>
                </>
              ) : job.step === "voice" && job.clips.length > 0 ? (
                /* clips + approve gate */
                <>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">
                    Video clips
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {job.clips.map((c, i) => (
                      <span key={i} className="rounded-md bg-white px-3 py-1.5 text-xs text-cream-700 ring-1 ring-cream-200">
                        {c.split(/[\\/]/).pop()}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <span className="text-sm text-green-800">Clips generated. Approve to add voice-over, or retry clips.</span>
                    <button
                      onClick={() => runStep("voice")}
                      disabled={busy}
                      className="ml-auto rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      Approve &amp; Generate Voice
                    </button>
                    <button
                      onClick={() => runStep("video", true)}
                      disabled={busy}
                      className="rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-xs font-medium text-cream-700 hover:bg-cream-100 disabled:opacity-50"
                    >
                      ↻ Retry Video
                    </button>
                  </div>
                </>
              ) : job.step === "assemble" && job.audios.length > 0 ? (
                /* voice + approve gate */
                <>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">
                    Voice-over
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {job.audios.map((a, i) => (
                      <span key={i} className="rounded-md bg-white px-3 py-1.5 text-xs text-cream-700 ring-1 ring-cream-200">
                        {a.split(/[\\/]/).pop()}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <span className="text-sm text-green-800">Voice ready. Approve to assemble, or retry voice.</span>
                    <button
                      onClick={() => runStep("assemble")}
                      disabled={busy}
                      className="ml-auto rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      Approve &amp; Assemble
                    </button>
                    <button
                      onClick={() => runStep("voice", true)}
                      disabled={busy}
                      className="rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-xs font-medium text-cream-700 hover:bg-cream-100 disabled:opacity-50"
                    >
                      ↻ Retry Voice
                    </button>
                  </div>
                </>
              ) : job.final ? (
                /* final video */
                <>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">
                    Your video is ready
                  </h3>
                  <video
                    key={videoUrl}
                    controls
                    className="mx-auto max-h-[60vh] w-auto max-w-full rounded-xl border border-cream-200 bg-black shadow-md"
                    src={videoUrl || undefined}
                  />
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <a
                      href={videoUrl || "#"}
                      download
                      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
                    >
                      ⬇ Download video
                    </a>
                    <button
                      onClick={() => runStep("assemble", true)}
                      disabled={busy}
                      className="rounded-lg border border-cream-300 bg-white px-4 py-2.5 text-sm font-medium text-cream-700 hover:bg-cream-100 disabled:opacity-50"
                    >
                      ↻ Re-assemble
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-cream-600">
                  {busy ? "Working… this can take a few minutes for real generation." : "Click Generate on the pipeline node above to start this step."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
