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
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractFileText } from "@/lib/client/pdf";

type FileStatus = "queued" | "extracting" | "parsing" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
  failStatus?: number;
  result?: { added: number; extracted: number; total: number };
};

type ModelInfo = {
  id: string;
  name: string;
  context: number | null;
};

const MAX_FILE_SIZE_MB = 50;

const MODELS_CACHE_KEY = "jobdetails_free_models";
const MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type ModelsCache = { at: number; models: ModelInfo[] };

// In-memory cache shared across the whole running app session.
// Once models are fetched, no further network call happens until the
// app is reloaded AND the localStorage cache has aged past 24h.
let sessionCache: ModelsCache | null = null;

function readModelsCache(): ModelsCache | null {
  try {
    const raw = localStorage.getItem(MODELS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelsCache;
    if (!Array.isArray(parsed.models)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeModelsCache(models: ModelInfo[]) {
  try {
    localStorage.setItem(
      MODELS_CACHE_KEY,
      JSON.stringify({ at: Date.now(), models } satisfies ModelsCache)
    );
  } catch {
    // localStorage unavailable — ignore
  }
}

function formatContext(ctx: number | null): string {
  if (!ctx) return "—";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K`;
  return String(ctx);
}

function vendorOf(id: string): string {
  return id.split("/")[0] || id;
}

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check key + load free models on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setApiKeyConfigured(d.apiKeyConfigured);
        // Default selection = the env-configured model, if present
        if (d.llmModel) setModel(d.llmModel);
      })
      .catch(() => setApiKeyConfigured(false));
  }, []);

  const applyModels = useCallback((list: ModelInfo[]) => {
    setModels(list);
    // Ensure a default is selected once models arrive
    setModel((prev) => {
      if (prev) return prev;
      const envDefault = list.find((m) => m.id.includes("nemotron-3-ultra"));
      return envDefault?.id || list[0]?.id || "";
    });
  }, []);

  const loadModels = useCallback(
    async (force = false) => {
      // 1) In-memory cache: if the app has already fetched this session,
      //    never call the network again (regardless of elapsed time).
      if (!force && sessionCache && sessionCache.models.length) {
        applyModels(sessionCache.models);
        setModelsLoading(false);
        return;
      }

      // 2) localStorage cache: serve instantly if younger than 24h.
      const cached = readModelsCache();
      if (!force && cached && Date.now() - cached.at < MODELS_CACHE_TTL_MS) {
        if (cached.models.length) {
          sessionCache = cached;
          applyModels(cached.models);
          setModelsLoading(false);
          return;
        }
      }

      // 3) Network fetch (only on first load, when cache is stale/missing,
      //    or when the user explicitly hits Refresh).
      setModelsLoading(true);
      setModelsError(null);
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load models");
        const fresh: ModelsCache = { at: Date.now(), models: data.models };
        sessionCache = fresh;
        writeModelsCache(data.models);
        applyModels(data.models);
      } catch (e) {
        // If we have a stale cache, still show it rather than an error
        if (cached?.models.length) {
          sessionCache = cached;
          applyModels(cached.models);
          setModelsError("Using cached list — live refresh failed.");
        } else {
          setModelsError(e instanceof Error ? e.message : "Failed to load models");
        }
      } finally {
        setModelsLoading(false);
      }
    },
    [applyModels]
  );

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const addFiles = useCallback((files: FileList | File[]) => {
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
    if (tooBig.length) {
      setSummary(
        `Skipped ${tooBig.length} file(s) over ${MAX_FILE_SIZE_MB}MB (PDF text is extracted in-browser, but very large files can stall).`
      );
    }
  }, []);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    setItems([]);
    setSummary(null);
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const selectedModel = useCustom ? customModel.trim() : model;

  const processItem = useCallback(
    async (item: UploadItem, modelOverride?: string) => {
      const useModel = modelOverride || selectedModel;
      updateItem(item.id, { status: "extracting" });
      try {
        const text = await extractFileText(item.file);
        if (!text || text.trim().length < 50) {
          updateItem(item.id, {
            status: "error",
            error: "Could not extract readable text from this file.",
          });
          return;
        }

        updateItem(item.id, { status: "parsing" });
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: item.file.name,
            text,
            model: useModel || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg =
            data.error ||
            (res.status === 401
              ? "API key rejected. Check OPENROUTER_API_KEY in the environment."
              : res.status === 402
                ? "This model requires credits. Pick a different (free) model."
                : "Failed to parse jobs.");
          updateItem(item.id, {
            status: "error",
            error: errMsg,
            failStatus: res.status,
          });
          return;
        }
        updateItem(item.id, {
          status: "done",
          result: { added: data.added, extracted: data.extracted, total: data.total },
        });
      } catch (e) {
        updateItem(item.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Failed to process file.",
        });
      }
    },
    [selectedModel]
  );

  const processAll = async () => {
    if (!selectedModel && useCustom) return;
    setBusy(true);
    setSummary(null);
    for (const item of items) {
      if (item.status === "queued" || item.status === "error") {
        await processItem(item);
      }
    }
    setBusy(false);
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "error").length;
    setSummary(
      `Processed ${items.length} file(s): ${done} succeeded, ${failed} failed.`
    );
  };

  const pendingCount = items.filter(
    (i) => i.status === "queued" || i.status === "error"
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-claude-text">
          Upload Job Files
        </h1>
        <p className="mt-1 text-sm text-claude-muted">
          Drop job listing PDFs, DOCX, or text files. Text is extracted in your
          browser and parsed with an OpenRouter free model.
        </p>
      </div>

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
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging
            ? "border-claude-accent bg-claude-accent-soft"
            : "border-claude-border bg-white hover:border-claude-accent/60"
        )}
      >
        <UploadCloud size={36} className="mb-3 text-claude-accent" />
        <p className="text-sm font-medium text-claude-text">
          Drag & drop job files here
        </p>
        <p className="mt-1 text-xs text-claude-muted">
          or click to browse — PDF, DOCX, TXT, MD (up to {MAX_FILE_SIZE_MB}MB
          each, multiple files allowed)
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

      {/* Model selector */}
      <div className="mt-6 rounded-xl border border-claude-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="block text-sm font-medium text-claude-text">
            Parsing model
          </label>
          <button
            onClick={() => loadModels(true)}
            disabled={modelsLoading}
            className="flex items-center gap-1.5 text-xs text-claude-muted hover:text-claude-text disabled:opacity-50"
            title="Refresh free model list"
          >
            <RefreshCw size={12} className={modelsLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {modelsLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-claude-muted">
            <Loader2 size={14} className="animate-spin" />
            Loading free models from OpenRouter…
          </div>
        ) : modelsError ? (
          <div className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-[#a04040]">{modelsError}</span>
            <button
              onClick={() => loadModels(true)}
              className="text-claude-accent hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {models.map((m) => {
                const active = !useCustom && model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModel(m.id);
                      setUseCustom(false);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-claude-accent bg-claude-accent-soft text-claude-accent-strong"
                        : "border-claude-border bg-white text-claude-muted hover:border-claude-accent/50 hover:text-claude-text"
                    )}
                    title={m.id}
                  >
                    <Cpu size={11} className={active ? "text-claude-accent" : ""} />
                    {m.id.replace(":free", "")}
                    <span className="rounded bg-claude-beige-deep px-1 py-px text-[10px] text-claude-muted">
                      {formatContext(m.context)}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setUseCustom(true)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  useCustom
                    ? "border-claude-accent bg-claude-accent-soft text-claude-accent-strong"
                    : "border-claude-border bg-white text-claude-muted hover:border-claude-accent/50 hover:text-claude-text"
                )}
              >
                Custom…
              </button>
            </div>
            <p className="text-[11px] text-claude-muted">
              {models.length} free model(s) available · showing context window
              (tokens) — larger is better for big files.
            </p>
          </>
        )}

        {useCustom && (
          <input
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="e.g. openrouter/free or nvidia/nemotron-3-ultra-550b-a55b:free"
            className="mt-3 w-full rounded-lg border border-claude-border bg-white px-3 py-2 text-sm outline-none focus:border-claude-accent"
          />
        )}
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="mt-6 rounded-xl border border-claude-border bg-white">
          <div className="flex items-center justify-between border-b border-claude-border px-5 py-3">
            <span className="text-sm font-medium text-claude-text">
              Files ({items.length})
            </span>
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
          <ul className="divide-y divide-claude-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <FileText size={16} className="shrink-0 text-claude-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-claude-text">
                    {item.file.name}
                  </div>
                  <div className="text-xs text-claude-muted">
                    {(item.file.size / 1024 / 1024).toFixed(1)}MB
                  </div>
                  {item.status === "error" && (
                    <div className="mt-1 text-xs text-[#a04040]">
                      {item.error}
                      {item.failStatus === 402 && (
                        <span className="text-claude-muted">
                          {" "}Switch to a different free model above and retry.
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

      {/* Summary */}
      {summary && (
        <div className="mt-4 rounded-lg border border-claude-border bg-white p-4 text-sm text-claude-muted">
          {summary}
        </div>
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
        <span className="flex items-center gap-1 rounded-full bg-[#f3e8f5] px-2 py-0.5 text-[11px] text-[#7a3d8c]">
          <Loader2 size={11} className="animate-spin" />
          Parsing…
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1 rounded-full bg-[#e3efe3] px-2 py-0.5 text-[11px] text-[#3d7a3d]">
          <CheckCircle2 size={11} />
          {item.result
            ? `+${item.result.added} new`
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
