"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ModelInfo {
  id: string;
  label: string;
  cost_per_second: number;
  supports_audio_input: boolean;
  description: string;
}

interface Scene {
  id: number;
  speaker: string;
  dialogue: string;
  visual: string;
  video_prompt?: string;
}

interface JobState {
  id: string;
  topic: string;
  script_text: string;
  input_mode: string;
  language: string;
  duration: number;
  model: string;
  mock: boolean;
  status: "pending" | "running" | "review" | "ready" | "done" | "error";
  step: string;
  message: string;
  error: string | null;
  elapsed_s: number;
  cost_estimate: number;
  script: { title?: string; scenes?: Scene[] } | null;
  result: { final?: string; clips?: string[]; scenes?: number; slug?: string } | null;
}

type StepKey = "script" | "tts" | "video" | "assemble" | "done";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "script", label: "Script" },
  { key: "tts", label: "Voice" },
  { key: "video", label: "Video" },
  { key: "assemble", label: "Assemble" },
  { key: "done", label: "Done" },
];

export default function Home() {
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [topics, setTopics] = useState<string[]>([]);

  // input
  const [inputMode, setInputMode] = useState<"topic" | "own_script">("topic");
  const [topic, setTopic] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [language, setLanguage] = useState("hi");
  const [duration, setDuration] = useState(10);
  const [model, setModel] = useState("wan-2.6");
  const [mock, setMock] = useState(false);

  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, t] = await Promise.all([
          fetch("/api/models").then((r) => r.json()),
          fetch("/api/topics").then((r) => r.json()),
        ]);
        setModels(m.models || {});
        setModel(m.default || "wan-2.6");
        setTopics(t.topics || []);
      } catch {
        setError("Cannot reach API server (port 8001). Start it first.");
      }
    })();
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPolling(false);
  }, []);

  const startPolling = useCallback((jobId: string) => {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`);
        const j = await r.json();
        setJob(j);
        // stop when it reaches review (waiting for user), ready (step done), or terminal
        if (j.status === "review" || j.status === "ready" || j.status === "done" || j.status === "error") stopPolling();
      } catch { /* transient */ }
    }, 2000);
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const api = useCallback(async (path: string, body?: unknown) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      return data;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error("Request timed out — try again.");
      throw e;
    } finally { clearTimeout(timer); }
  }, []);

  // Step 1: generate / convert script
  const makeScript = useCallback(async () => {
    if (inputMode === "topic" && !topic.trim()) { setError("Enter a topic."); return; }
    if (inputMode === "own_script" && !scriptText.trim()) { setError("Paste your script."); return; }
    setError(null); setJob(null); stopPolling();
    try {
      const body = {
        topic, script_text: scriptText, input_mode: inputMode,
        language, duration, model, mock,
      };
      const j = await api("/api/jobs", body);
      setJob(j);
      startPolling(j.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to start"); }
  }, [topic, scriptText, inputMode, language, duration, model, mock, api, startPolling, stopPolling]);

  // Steps 2-4: run a step after approval
  const runStep = useCallback(async (step: "tts" | "video" | "assemble") => {
    if (!job) return;
    setError(null);
    try {
      await api(`/api/jobs/${job.id}/${step}`, { force_retry: false });
      startPolling(job.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Step failed"); }
  }, [job, api, startPolling]);

  const videoUrl = job?.result?.final
    ? `/api/video/${encodeURIComponent(job.result.final.split(/[\\/]/).pop() || "")}`
    : null;

  const scenes = job?.script?.scenes || [];
  const stepIdx = STEPS.findIndex((s) => s.key === job?.step);
  const sceneCount = Math.max(1, Math.round(duration / 5));

  // cost estimate for the chosen model
  const costPerScene = models[model]?.cost_per_second ? (5 * models[model].cost_per_second) : 0;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-2xl text-white">🎬</div>
          <h1 className="text-3xl font-semibold tracking-tight">Audio-First Cartoon Generator</h1>
          <p className="mt-1 text-sm text-cream-600">Step by step: script → voice → video → download</p>
        </header>

        {/* STEP 1: input */}
        {!job || job.status === "error" ? (
          <section className="mx-auto max-w-2xl rounded-2xl border border-cream-200 bg-cream-50 p-8 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cream-600">Step 1 — Your input</h2>

            {/* input mode selector */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["topic", "own_script"] as const).map((m) => (
                <button key={m} onClick={() => setInputMode(m)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    inputMode === m ? "border-accent bg-accent-soft text-accent" : "border-cream-300 bg-white text-cream-600 hover:border-cream-400"}`}>
                  {m === "topic" ? "🎯 Use a topic" : "📝 Paste my script"}
                </button>
              ))}
            </div>

            {inputMode === "topic" ? (
              <>
                <input value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="Why carrots are good for your eyes"
                  className="mb-3 w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
                <select value={topic} onChange={(e) => setTopic(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none">
                  <option value="">— choose a built-in topic —</option>
                  {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            ) : (
              <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)}
                rows={8} placeholder={"Mom: Hi son, how are you?\nSon: I'm fine, mommy!\nMom: Let's eat a healthy carrot today..."}
                className="mb-4 w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
            )}

            <div className="mb-4 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-cream-700">Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-white px-2 py-2 text-sm outline-none">
                  <option value="hi">हिन्दी</option><option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-cream-700">Duration</label>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-cream-300 bg-white px-2 py-2 text-sm outline-none">
                  {[5, 10, 15, 20, 30].map((d) => <option key={d} value={d}>{d}s</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-cream-700">Scenes</label>
                <div className="rounded-lg border border-cream-300 bg-cream-100 px-2 py-2 text-sm text-center text-cream-700">{sceneCount}</div>
              </div>
            </div>

            <button onClick={makeScript} disabled={polling}
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {polling ? "Generating script…" : (inputMode === "own_script" ? "Convert my script to scenes" : "Generate script from topic")}
            </button>

            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </section>
        ) : (
          /* STEP 2+: review + pipeline */
          <div className="space-y-6">
            {/* progress bar */}
            <section className="rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-1 overflow-x-auto">
                {STEPS.map((s, i) => {
                  const done = stepIdx > i;
                  const active = stepIdx === i && job.status === "running";
                  return (
                    <div key={s.key} className="flex items-center gap-1">
                      <div className={`w-24 rounded-lg border px-2 py-1.5 text-center text-xs font-medium ${
                        active ? "border-accent bg-accent-soft text-accent"
                        : done ? "border-green-200 bg-green-50 text-green-700"
                        : "border-cream-200 bg-white text-cream-500"}`}>
                        {done ? "✓ " : ""}{s.label}
                      </div>
                      {i < STEPS.length - 1 && <span className="text-cream-300">→</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-cream-700">
                  {job.status === "review" ? "Script ready — review it below" : job.message}
                </p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  job.status === "done" ? "bg-green-100 text-green-700"
                  : job.status === "running" ? "bg-cream-200 text-cream-700"
                  : "bg-cream-200 text-cream-700"}`}>
                  {job.status}
                </span>
              </div>
              {job.error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{job.error}</div>}
            </section>

            {/* script review (step 1 done → approve to tts) */}
            {job.status === "review" && scenes.length > 0 && (
              <section className="rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">Review script</h2>
                {job.script?.title && <p className="mb-2 text-xs font-medium text-cream-500">{job.script.title}</p>}
                <div className="space-y-2">
                  {scenes.map((sc) => (
                    <div key={sc.id} className="rounded-lg border border-cream-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase text-cream-500">Scene {sc.id} · {sc.speaker}</p>
                      <p className="mt-1 text-sm text-cream-900">💬 {sc.dialogue}</p>
                      <p className="text-xs text-cream-600">👀 {sc.visual}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button onClick={makeScript} disabled={polling}
                    className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-medium text-cream-700 hover:bg-cream-100 disabled:opacity-50">
                    ↻ Regenerate
                  </button>
                  <button onClick={() => runStep("tts")} disabled={polling}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                    ✓ Approve &amp; Generate Voice
                  </button>
                </div>
              </section>
            )}

            {/* voice → video approve */}
            {job.step === "tts" && job.status !== "running" && (
              <section className="rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">Voice-over ready</h2>
                <p className="mb-4 text-sm text-cream-700">Hindi voice-over generated for {scenes.length} scene(s). Next: generate the video.</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => runStep("video")} disabled={polling}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                    ✓ Approve &amp; Generate Video
                  </button>
                </div>
              </section>
            )}

            {/* video → assemble approve */}
            {job.step === "video" && job.status !== "running" && (
              <section className="rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">Scene videos ready</h2>
                <p className="mb-4 text-sm text-cream-700">Videos generated for {scenes.length} scene(s). Next: assemble the final file.</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => runStep("assemble")} disabled={polling}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                    ✓ Assemble Final Video
                  </button>
                </div>
              </section>
            )}

            {/* final video */}
            {job.status === "done" && videoUrl && (
              <section className="rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cream-600">Your video is ready</h2>
                <video controls src={videoUrl} className="mx-auto max-h-[60vh] w-auto max-w-full rounded-xl border border-cream-200 bg-black shadow-md" />
                <div className="mt-4 text-center">
                  <a href={videoUrl} download
                    className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
                    ⬇ Download video
                  </a>
                  <button onClick={() => { setJob(null); setError(null); }}
                    className="ml-3 rounded-lg border border-cream-300 bg-white px-4 py-2.5 text-sm font-medium text-cream-700 hover:bg-cream-100">
                    + New video
                  </button>
                </div>
              </section>
            )}

            {/* cost info */}
            <section className="rounded-2xl border border-cream-200 bg-cream-50 p-4 text-xs text-cream-600 shadow-sm">
              <p>Model: <span className="font-medium text-cream-800">{models[model]?.label || model}</span> · ${models[model]?.cost_per_second ?? 0}/sec · est ${job.cost_estimate} for {scenes.length || sceneCount} scene(s)
                {job.mock ? " · MOCK (no cost)" : ""}</p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
