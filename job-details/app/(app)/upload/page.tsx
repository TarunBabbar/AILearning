"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Sparkles,
  Trash2,
  RefreshCw,
  Lock,
  LogOut,
  ShieldCheck,
  Eye,
  EyeOff,
  Terminal,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractFileText } from "@/lib/client/pdf";
import { invalidateListCaches } from "@/lib/use-list-swr";

type FileStatus = "queued" | "extracting" | "parsing" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
  failStatus?: number;
  startedAt?: number;
  elapsedSec?: number;
  progressLabel?: string;
  chunksDone?: number;
  chunksTotal?: number;
  liveNew?: number;
  liveDup?: number;
  result?: { added: number; extracted: number; duplicates?: number; total: number };
};

type UploadResult = {
  added: number;
  extracted: number;
  duplicates?: number;
  total: number;
  message: string;
};

type ActivityLine = {
  id: number;
  ts: string;
  text: string;
  kind: "info" | "ok" | "warn" | "error";
};

const MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 50);

function timeLabel(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [model, setModel] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activity, setActivity] = useState<ActivityLine[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  const copyActivityLog = useCallback(async () => {
    const text = activity
      .map((l) => `${timeLabel(l.ts)} ${l.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [activity]);

  // Admin auth state
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const pushActivity = useCallback(
    (text: string, kind: ActivityLine["kind"] = "info") => {
      seqRef.current += 1;
      const line: ActivityLine = {
        id: seqRef.current,
        ts: new Date().toISOString(),
        text,
        kind,
      };
      setActivity((prev) => [...prev.slice(-199), line]);
    },
    []
  );

  // Auto-scroll activity panel
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight;
    }
  }, [activity]);

  // Elapsed timer for running items
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => {
      setItems((prev) =>
        prev.map((i) =>
          i.startedAt && (i.status === "extracting" || i.status === "parsing")
            ? { ...i, elapsedSec: Math.floor((Date.now() - i.startedAt) / 1000) }
            : i
        )
      );
    }, 1000);
    return () => clearInterval(t);
  }, [busy]);

  // Check admin status on mount
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setAdmin(!!d.admin))
      .catch(() => setAdmin(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(
          data.error ||
            "Login failed. You don't have admin access — browse the existing jobs instead."
        );
        return;
      }
      setAdmin(true);
      setPassword("");
      pushActivity("Admin login successful.", "ok");
    } catch {
      setLoginError("Login failed. Please try again.");
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAdmin(false);
    setUsername("");
    setPassword("");
    setItems([]);
    pushActivity("Logged out.");
  };

  // Check key + default model on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setApiKeyConfigured(d.apiKeyConfigured);
        if (d.llmModel) setModel(d.llmModel);
      })
      .catch(() => setApiKeyConfigured(false));
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const valid = list.filter((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith(".pdf") ||
          name.endsWith(".docx") ||
          name.endsWith(".txt") ||
          name.endsWith(".md")
        );
      });
      const tooBig = list.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
      const newItems: UploadItem[] = valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "queued",
      }));
      setItems((prev) => [...prev, ...newItems]);
      if (newItems.length) {
        pushActivity(`Added ${newItems.length} file(s) to the queue.`);
      }
      if (tooBig.length) {
        pushActivity(
          `Skipped ${tooBig.length} file(s) over ${MAX_FILE_SIZE_MB}MB.`,
          "warn"
        );
      }
    },
    [pushActivity]
  );

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    setItems([]);
    setActivity([]);
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const selectedModel = model;

  // Max automatic retries when the server returns an error mid-processing.
  // Completed chunks are already saved (dedupe by company+description), so a
  // retry only processes the remaining chunks — no duplicates.
  const MAX_AUTO_RETRIES = 5;

  const processItem = useCallback(
    async (item: UploadItem, modelOverride?: string) => {
      const useModel = modelOverride || selectedModel;
      updateItem(item.id, {
        status: "extracting",
        startedAt: Date.now(),
        elapsedSec: 0,
        progressLabel: undefined,
      });
      pushActivity(`[${item.file.name}] Extracting text in browser…`);

      try {
        const text = await extractFileText(item.file, (page, total) => {
          updateItem(item.id, {
            progressLabel: `Extracting page ${page}/${total}…`,
          });
        });
        if (!text || text.trim().length < 50) {
          updateItem(item.id, {
            status: "error",
            error: "Could not extract readable text from this file.",
          });
          pushActivity(`[${item.file.name}] Could not extract text.`, "error");
          return;
        }
        pushActivity(
          `[${item.file.name}] Text extracted (${text.trim().split(/\s+/).length.toLocaleString()} words).`
        );

        updateItem(item.id, { status: "parsing" });
        pushActivity(
          `[${item.file.name}] Sending to LLM (${useModel || "default"}) — this can take a minute…`
        );

        // ── One full upload attempt. Returns { result } on success, or
        //    throws / returns { error } for retryable failures. ──
        const attempt = async (): Promise<{
          result: UploadResult;
        } | { error: string }> => {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: item.file.name,
              text,
              model: useModel || undefined,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const errMsg =
              data.error ||
              (res.status === 401
                ? "API key rejected. Check OPENROUTER_API_KEY in the environment."
                : res.status === 402
                  ? "This model requires credits. Pick a different (free) model."
                  : `Failed to parse jobs (HTTP ${res.status}).`);
            return { error: errMsg };
          }

          // NDJSON stream: live progress events from the server
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let result: UploadResult | null = null;
          let streamError: string | null = null;
          let itemChunksTotal = 0;
          let completedRef = { current: 0 };

          if (reader) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.trim()) continue;
                  let obj: Record<string, unknown>;
                  try {
                    obj = JSON.parse(line);
                  } catch {
                    continue;
                  }
                  if (obj.type === "chunks") {
                    itemChunksTotal = Number(obj.total);
                    updateItem(item.id, { chunksTotal: itemChunksTotal });
                  } else if (obj.type === "progress") {
                    updateItem(item.id, { progressLabel: String(obj.message) });
                    pushActivity(String(obj.message));
                    // Live cumulative totals: "Extracted 12 job(s) so far · 3
                    // duplicate(s) skipped (added 2 in this chunk)."
                    const msg = String(obj.message);
                    const extractedMatch = msg.match(/Extracted\s+(\d+)\s+job/);
                    const dupMatch = msg.match(/(\d+)\s+duplicate/);
                    if (extractedMatch || dupMatch) {
                      updateItem(item.id, {
                        liveNew: extractedMatch ? Number(extractedMatch[1]) : undefined,
                        liveDup: dupMatch ? Number(dupMatch[1]) : undefined,
                      });
                    }
                    // Count COMPLETED chunks only ("parsed" / "failed with all").
                    // Chunks finish in parallel and out of order, so we use a
                    // running counter, not the chunk number — 4 done of 8 = 50%.
                    if (/chunk\s+\d+\/\d+\s+(?:parsed|failed)/i.test(msg)) {
                      completedRef.current += 1;
                      const total = itemChunksTotal;
                      updateItem(item.id, {
                        chunksDone: completedRef.current,
                        chunksTotal: total,
                      });
                    } else {
                      const totalMatch = msg.match(/chunk\s+\d+\/(\d+)/i);
                      if (totalMatch && !msg.includes("Sending")) {
                        updateItem(item.id, { chunksTotal: Number(totalMatch[1]) });
                      }
                    }
                  } else if (obj.type === "log") {
                    const ev = obj.event as {
                      message?: string;
                      level?: string;
                      phase?: string;
                    };
                    if (ev?.message) {
                      pushActivity(
                        `[${ev.phase ?? "llm"}] ${ev.message}`,
                        ev.level === "error"
                          ? "error"
                          : ev.level === "warn"
                            ? "warn"
                            : "info"
                      );
                    }
                  } else if (obj.type === "result") {
                    result = obj.data as UploadResult;
                  } else if (obj.type === "error") {
                    streamError = String(obj.message);
                  }
                }
              }
            } catch {
              streamError = "Connection to the server was interrupted.";
            }
          }

          if (streamError) return { error: streamError };
          if (!result) return { error: "Server returned no result." };
          return { result };
        };

        // ── Auto-retry loop: up to 5 attempts on server errors. Already-
        //    saved chunks are skipped server-side (dedupe), so retries never
        //    create duplicates. ──
        let lastError = "Unknown error";
        for (let attemptNo = 1; attemptNo <= MAX_AUTO_RETRIES; attemptNo++) {
          const out = await attempt().catch((e: unknown) => ({
            error: e instanceof Error ? e.message : "Failed to process file.",
          }));

          if ("result" in out) {
            const result = out.result;
            updateItem(item.id, {
              status: "done",
              result: {
                added: result.added,
                extracted: result.extracted,
                duplicates: result.duplicates ?? 0,
                total: result.total,
              },
            });
            pushActivity(
              `[${item.file.name}] Done — +${result.added} new, ${result.duplicates ?? 0} duplicate(s).`,
              "ok"
            );
            void invalidateListCaches();
            return;
          }

          lastError = out.error;
          if (attemptNo < MAX_AUTO_RETRIES) {
            // Only auto-retry on retryable server errors (not auth/credits).
            const retryable = !/API key|credits|401|402/i.test(lastError);
            if (!retryable) break;
            const delay = 2000 * attemptNo; // 2s, 4s, 6s, 8s
            pushActivity(
              `[${item.file.name}] Server error — retrying (${attemptNo}/${MAX_AUTO_RETRIES - 1}) in ${delay / 1000}s…`,
              "warn"
            );
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        updateItem(item.id, {
          status: "error",
          error: lastError,
          failStatus: 500,
        });
        pushActivity(`[${item.file.name}] ${lastError}`, "error");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to process file.";
        updateItem(item.id, { status: "error", error: msg });
        pushActivity(`[${item.file.name}] ${msg}`, "error");
      }
    },
    [selectedModel, pushActivity]
  );

  const processAll = async () => {
    if (!selectedModel) return;
    setBusy(true);
    pushActivity("Starting batch processing — all files in parallel…");
    // Fire all files at once; each has its own progress bar.
    await Promise.all(
      items
        .filter((i) => i.status === "queued" || i.status === "error")
        .map((item) => processItem(item))
    );
    setBusy(false);
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "error").length;
    pushActivity(
      `Batch finished — ${done} succeeded, ${failed} failed.`,
      failed > 0 ? "warn" : "ok"
    );
  };

  const pendingCount = items.filter(
    (i) => i.status === "queued" || i.status === "error"
  ).length;

  // Batch totals across ALL files: live counts while in progress,
  // final counts once done.
  const batchExtracted = items.reduce(
    (sum, i) => sum + (i.status === "done" && i.result ? i.result.added : i.liveNew ?? 0),
    0
  );
  const batchDuplicates = items.reduce(
    (sum, i) =>
      sum +
      (i.status === "done" && i.result
        ? i.result.duplicates ?? 0
        : i.liveDup ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-claude-text">
            Upload Job Files
          </h1>
          <p className="mt-1 text-sm text-claude-muted">
            {admin
              ? "Drop job listing PDFs, DOCX, or text files. Text is extracted in your browser and parsed with an OpenRouter free model."
              : "Sign in with admin credentials to upload job PDFs."}
          </p>
        </div>
        {admin && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-claude-border bg-white px-3 py-1.5 text-xs font-medium text-claude-muted transition-colors hover:border-claude-accent hover:text-claude-accent"
          >
            <LogOut size={13} />
            Logout
          </button>
        )}
      </div>

      {admin === null ? (
        <div className="flex items-center justify-center py-24 text-claude-muted">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Checking access…
        </div>
      ) : !admin ? (
        <LoginGate
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loginError={loginError}
          loginBusy={loginBusy}
          onLogin={handleLogin}
        />
      ) : (
        <>
          {apiKeyConfigured === false && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-claude-border bg-white p-4 text-sm">
              <Sparkles size={18} className="text-claude-accent" />
              <span className="flex-1 text-claude-muted">
                No OpenRouter API key configured. Set{" "}
                <code className="rounded bg-claude-beige-deep px-1.5 py-0.5 text-[12px]">
                  OPENROUTER_API_KEY
                </code>{" "}
                in the environment to enable extraction.
              </span>
            </div>
          )}

          {/* Upload + live activity — side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging
                  ? "border-claude-accent bg-claude-accent-soft"
                  : "border-claude-border bg-white hover:border-claude-accent/60"
              )}
            >
              <UploadCloud size={32} className="mb-2 text-claude-accent" />
              <p className="text-sm font-medium text-claude-text">
                Drag & drop job files here
              </p>
              <p className="mt-1 text-xs text-claude-muted">
                or click to browse — PDF, DOCX, TXT, MD (up to{" "}
                {MAX_FILE_SIZE_MB}MB each, multiple allowed)
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Live activity — replaces the model section */}
            <div className="flex flex-col rounded-xl border border-claude-border bg-white">
              <div className="flex items-center justify-between border-b border-claude-border px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium text-claude-text">
                  <Terminal size={15} className="text-claude-accent" />
                  Live activity
                  {busy && <Loader2 size={13} className="animate-spin text-claude-accent" />}
                </span>
                <button
                  onClick={copyActivityLog}
                  disabled={activity.length === 0}
                  className="flex items-center gap-1.5 rounded-md border border-claude-border px-2 py-1 text-xs text-claude-muted transition-colors hover:border-claude-accent hover:text-claude-accent disabled:opacity-40"
                  title="Copy logs"
                >
                  {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div
                ref={activityRef}
                className="max-h-64 flex-1 overflow-y-auto bg-[#faf9f6] px-4 py-2 font-mono text-[11px] leading-relaxed"
              >
                {activity.length === 0 ? (
                  <div className="py-2 text-claude-muted">
                    No activity yet — add files and start processing.
                  </div>
                ) : (
                  activity.map((line) => (
                    <div
                      key={line.id}
                      className={cn(
                        "flex gap-2 py-0.5",
                        line.kind === "ok" && "text-[#3d7a3d]",
                        line.kind === "warn" && "text-[#9a7b2d]",
                        line.kind === "error" && "text-[#a04040]",
                        line.kind === "info" && "text-claude-muted"
                      )}
                    >
                      <span className="shrink-0 opacity-60">{timeLabel(line.ts)}</span>
                      <span className="break-words">{line.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* File list — scrollable, so the page doesn't scroll */}
          {items.length > 0 && (
            <div className="mt-4 flex max-h-72 flex-col overflow-hidden rounded-xl border border-claude-border bg-white">
              <div className="flex items-center justify-between border-b border-claude-border px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-claude-text">
                    Files ({items.length})
                  </span>
                  {(batchExtracted > 0 || batchDuplicates > 0) && (
                    <span className="flex items-center gap-1.5 rounded-full bg-[#f3e8f5] px-2.5 py-0.5 text-[11px] text-[#7a3d8c]">
                      <span className="font-semibold">
                        Total: {batchExtracted} new
                      </span>
                      <span className="opacity-60">·</span>
                      <span>{batchDuplicates} dup</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-xs text-claude-muted hover:text-claude-text"
                  >
                    <Trash2 size={13} />
                    Clear
                  </button>
                  <button
                    onClick={processAll}
                    disabled={busy || pendingCount === 0}
                    className="flex items-center gap-2 rounded-lg bg-claude-accent px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-claude-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Process {pendingCount > 0 ? `${pendingCount} file(s)` : "all"}
                      </>
                    )}
                  </button>
                </div>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-claude-border overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                    <FileText size={15} className="shrink-0 text-claude-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-claude-text">
                        {item.file.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-claude-muted">
                        <span>{(item.file.size / 1024 / 1024).toFixed(1)}MB</span>
                        {item.status === "extracting" && (
                          <span className="flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" />
                            Extracting text…
                          </span>
                        )}
                      </div>

                      {/* Extraction progress bar — green %, no chunk detail */}
                      {item.chunksTotal &&
                        item.chunksTotal > 0 &&
                        (item.status === "parsing" || item.status === "done") && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-claude-beige-deep">
                              <div
                                className="h-full rounded-full bg-[#3d7a3d] transition-all duration-300"
                                style={{
                                  width: `${Math.min(100, (item.chunksDone ?? 0) / item.chunksTotal * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold text-[#3d7a3d]">
                              {Math.min(100, Math.round((item.chunksDone ?? 0) / item.chunksTotal * 100))}%
                            </span>
                          </div>
                        )}

                      {item.status === "done" && item.result && (
                        <div className="mt-1 text-[11px] font-medium text-[#3d7a3d]">
                          +{item.result.added} new
                          {item.result.duplicates ? ` · ${item.result.duplicates} duplicate` : ""}
                        </div>
                      )}

                      {item.status === "error" && (
                        <div className="mt-1 text-xs text-[#a04040]">
                          {item.error}
                          {item.failStatus === 402 && (
                            <span className="text-claude-muted">
                              {" "}Switch to a different free model and retry.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <StatusBadge item={item} />
                    {item.status === "error" && (
                      <button
                        onClick={() => processItem(item)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-md border border-claude-border px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:border-claude-accent hover:text-claude-accent disabled:opacity-50"
                        title="Retry with the currently selected model"
                      >
                        <RefreshCw size={11} />
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-claude-muted hover:text-claude-text"
                      title="Remove"
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ item }: { item: UploadItem }) {
  switch (item.status) {
    case "queued":
      return (
        <span className="rounded-full bg-claude-beige-deep px-2 py-0.5 text-[11px] text-claude-muted">
          Queued
        </span>
      );
    case "extracting":
      return (
        <span className="flex items-center gap-1 rounded-full bg-[#e6edf5] px-2 py-0.5 text-[11px] text-[#4a6d8c]">
          <Loader2 size={11} className="animate-spin" />
          Extracting…
        </span>
      );
    case "parsing":
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-[#f3e8f5] px-2 py-0.5 text-[11px] text-[#7a3d8c]">
          <span className="font-semibold">
            Extracted {item.liveNew ?? 0}
          </span>
          <span className="opacity-60">·</span>
          <span>Dup {item.liveDup ?? 0}</span>
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1 rounded-full bg-[#e3efe3] px-2 py-0.5 text-[11px] text-[#3d7a3d]">
          <CheckCircle2 size={11} />
          {item.result
            ? `+${item.result.added} new${item.result.duplicates ? `, ${item.result.duplicates} dup` : ""}`
            : "Done"}
        </span>
      );
    case "error":
      return (
        <span
          className="flex items-center gap-1 rounded-full bg-[#f5e5e5] px-2 py-0.5 text-[11px] text-[#a04040]"
          title={item.error}
        >
          <XCircle size={11} />
          Failed
        </span>
      );
  }
}

function LoginGate({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  loginError,
  loginBusy,
  onLogin,
}: {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  loginError: string | null;
  loginBusy: boolean;
  onLogin: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-claude-border bg-white p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
          <Lock size={22} />
        </div>
        <h2 className="text-lg font-semibold text-claude-text">
          Admin access required
        </h2>
        <p className="mt-1 text-sm text-claude-muted">
          Uploading job PDFs is restricted. Enter the admin credentials to
          continue.
        </p>
      </div>

      <form onSubmit={onLogin} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-claude-muted">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-lg border border-claude-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-claude-accent"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-claude-muted">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-claude-border bg-white px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-claude-accent"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-claude-muted hover:text-claude-text"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {loginError && (
          <div className="rounded-lg bg-[#f5e5e5] p-3 text-xs text-[#a04040]">
            {loginError}
          </div>
        )}

        <button
          type="submit"
          disabled={loginBusy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-claude-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-claude-accent-strong disabled:opacity-50"
        >
          {loginBusy ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              <ShieldCheck size={15} />
              Sign in
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-claude-muted">
        Don&apos;t have admin access? Head back to the{" "}
        <a href="/" className="text-claude-accent hover:underline">
          All Jobs
        </a>{" "}
        view to explore the available jobs.
      </p>
    </div>
  );
}
