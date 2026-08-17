"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Upload, FileText, Check, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import PageChrome from "@/components/PageChrome";
import { extractFileText } from "@/lib/client/pdf";
import { SESSION_KEY, swrFetcher } from "@/lib/swr-fetcher";
import { mutate } from "swr";

type MeResponse = {
  user: { id: string; email: string; name: string | null } | null;
  resume: { filename: string; updatedAt: string; mimeType: string | null } | null;
};

export default function ResumePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [success, setSuccess] = useState(false);
  // File waiting for replace-confirmation (only when a resume already exists).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: me, mutate: mutateMe } = useSWR<MeResponse>(SESSION_KEY, swrFetcher, {
    revalidateOnFocus: false,
  });
  const loggedIn = Boolean(me?.user);
  const resume = me?.resume ?? null;

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || busy) return;
      setError(null);
      setSuccess(false);

      // Re-uploading a resume clears existing scores — ask for confirmation
      // with an inline modal instead of a browser alert.
      if (resume) {
        setPendingFile(file);
        return;
      }

      await uploadResume(file);
    },
    [busy, mutateMe, resume]
  );

  const uploadResume = useCallback(
    async (file: File) => {
      setBusy(true);
      setProgress("Extracting text…");
      try {
        const name = file.name.toLowerCase();
        if (!name.endsWith(".pdf") && !name.endsWith(".docx") && !name.endsWith(".txt")) {
          setError("Use PDF, DOCX (Word .docx), or TXT.");
          return;
        }
        const text = await extractFileText(file, (page, total) => {
          setProgress(`Extracting page ${page}/${total}…`);
        });
        if (!text || text.trim().length < 80) {
          setError("Could not extract enough text from this file.");
          return;
        }
        setProgress("Saving resume…");
        const mimeType = name.endsWith(".pdf")
          ? "application/pdf"
          : name.endsWith(".docx")
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "text/plain";
        const res = await fetch("/api/user/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content: text, mimeType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to save resume.");
          return;
        }
        await mutateMe();
        await mutate(SESSION_KEY);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [mutateMe]
  );

  if (!loggedIn) {
    return (
      <PageChrome
        header={<h1 className="text-lg font-semibold tracking-tight text-claude-text">Upload Resume</h1>}
      >
        <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-claude-border bg-white px-6 py-10 text-center shadow-sm">
          <FileText size={22} className="mb-3 text-claude-accent" />
          <p className="text-sm font-medium text-claude-text">Sign in to upload your resume</p>
          <Link
            href="/score"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-claude-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Go to Sign in
          </Link>
        </div>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      header={
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight text-claude-text">Upload Resume</h1>
          <p className="text-[11px] leading-snug text-claude-muted">
            Upload your resume once, then head to <b>Match by Resume</b> to score jobs against it.
          </p>
        </div>
      }
    >
      <div className="mx-auto max-w-xl">
        {/* Current resume status */}
        {resume && (
          <>
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-claude-border bg-white px-3.5 py-2.5 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e3efe3] text-[#3d7a3d]">
                <Check size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-claude-text">{resume.filename}</p>
                <p className="text-[11px] text-claude-muted">
                  {new Date(resume.updatedAt).toLocaleString()} · uploaded
                </p>
              </div>
              <Link
                href="/score"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-claude-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Score jobs <ArrowRight size={12} />
              </Link>
            </div>

            <div className="mb-4 rounded-lg border border-[#f5e5e5] bg-[#fdf6f6] px-3.5 py-2.5 text-xs leading-relaxed text-[#a04040]">
              <span className="font-semibold">Heads up:</span> replacing this resume will{" "}
              <b>clear all your current job scores</b> — you&apos;ll need to run scoring again.
            </div>
          </>
        )}

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          className={
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors " +
            (dragOver
              ? "border-claude-accent bg-claude-accent/5"
              : "border-claude-border bg-white hover:border-claude-accent")
          }
        >
          {busy ? (
            <>
              <Loader2 size={24} className="animate-spin text-claude-accent" />
              <p className="mt-3 text-sm font-medium text-claude-text">{progress || "Uploading…"}</p>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-claude-accent/10 text-claude-accent">
                <Upload size={22} />
              </span>
              <p className="mt-3 text-sm font-medium text-claude-text">
                {resume ? "Replace your resume" : "Upload your resume"}
              </p>
              <p className="mt-1 text-xs text-claude-muted">
                Drag &amp; drop a PDF, DOCX, or TXT — or click to browse
              </p>
              {success && (
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#e3efe3] px-3 py-1 text-xs font-medium text-[#3d7a3d]">
                  <Check size={12} /> Resume saved — go score your matches
                </p>
              )}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && <p className="mt-3 text-center text-xs text-[#a04040]">{error}</p>}

        {/* Guidance */}
        {!resume && (
          <div className="mt-5 rounded-lg border border-[#eadfc2] bg-[#fbf6e9] p-3.5 text-xs leading-relaxed text-[#6b5a2e]">
            <span className="font-semibold uppercase tracking-wide text-[#7a6120]">Tip</span>
            <p className="mt-1">
              No resume uploaded yet. Upload one to enable AI scoring — then open{" "}
              <b>Match by Resume</b> and hit the <b>Score</b> button to see fit % for every job.
            </p>
          </div>
        )}
      </div>

      {/* Replace-resume confirmation modal */}
      {pendingFile && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-claude-border bg-white p-6 shadow-2xl">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fdf0d5] text-[#9a7b2d]">
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-base font-semibold text-claude-text">Replace your resume?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-claude-muted">
              Replacing <span className="font-medium text-claude-text">{resume?.filename}</span> will{" "}
              <span className="font-medium text-[#a04040]">clear all your current job scores</span> —
              you&apos;ll need to run scoring again.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="flex-1 rounded-lg border border-claude-border bg-white px-3 py-2 text-sm font-medium text-claude-muted transition-colors hover:bg-claude-bg hover:text-claude-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const f = pendingFile;
                  setPendingFile(null);
                  void uploadResume(f);
                }}
                className="flex-1 rounded-lg bg-claude-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Replace &amp; re-score
              </button>
            </div>
          </div>
        </div>
      )}
    </PageChrome>
  );
}
