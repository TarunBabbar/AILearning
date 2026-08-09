"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogIn,
  UserPlus,
  LogOut,
  Upload,
  Loader2,
  Search,
  X,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractFileText } from "@/lib/client/pdf";
import { TableSkeleton } from "@/components/Skeleton";

type MeResponse = {
  user: { id: string; email: string; name: string | null } | null;
  resume: { filename: string; updatedAt: string; mimeType: string | null } | null;
  scoreCount?: number;
};

type MatchRow = {
  id: string;
  score: number;
  strengths: string | null;
  gaps: string | null;
  scoredAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    experience: string | null;
    email: string | null;
    description: string | null;
    jobDate: string | null;
  };
};

type ScoreStats = {
  totalMatching: number;
  scoredCount: number;
  unscored: number;
  estMinutesUnscored: number;
  waveCapacity?: number;
  jobsPerModel?: number;
};

type AuthMode = "login" | "register";

function scoreColor(score: number) {
  if (score >= 60) return "text-[#3d7a3d]";
  if (score >= 30) return "text-[#9a7b2d]";
  return "text-[#a04040]";
}

function scoreBg(score: number) {
  if (score >= 60) return "bg-[#e3efe3]";
  if (score >= 30) return "bg-[#fdf0d5]";
  return "bg-[#f5e5e5]";
}

function userInitials(name: string | null | undefined, email: string) {
  const raw = (name || "").trim();
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function MatchJobsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeProgress, setResumeProgress] = useState<string | null>(null);

  const [scope, setScope] = useState<"unscored" | "all">("unscored");
  const [stats, setStats] = useState<ScoreStats | null>(null);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreProgress, setScoreProgress] = useState<string | null>(null);
  const [scorePct, setScorePct] = useState<number | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [selected, setSelected] = useState<MatchRow | null>(null);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/user/me", { cache: "no-store" });
    const data = (await res.json()) as MeResponse;
    setMe(data);
    return data;
  }, []);

  const loadMatches = useCallback(async (search = "") => {
    setMatchesLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/user/matches?${params}`, { cache: "no-store" });
      if (!res.ok) {
        setMatches([]);
        return;
      }
      const data = (await res.json()) as { matches: MatchRow[] };
      setMatches(data.matches ?? []);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (search: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/user/score?${params}`, { cache: "no-store" });
    if (!res.ok) return;
    setStats((await res.json()) as ScoreStats);
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingMe(true);
      try {
        const data = await refreshMe();
        if (data.user) {
          await Promise.all([loadMatches(), loadStats("")]);
        }
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [refreshMe, loadMatches, loadStats]);

  const pendingCount = useMemo(() => {
    if (!stats) return 0;
    return scope === "all" ? stats.totalMatching : stats.unscored;
  }, [stats, scope]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const path = authMode === "login" ? "/api/user/login" : "/api/user/register";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(authMode === "register" ? { name } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data.error || "Authentication failed.");
        return;
      }
      const next = await refreshMe();
      if (next.user) {
        await Promise.all([loadMatches(), loadStats("")]);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/user/logout", { method: "POST" });
    setMe({ user: null, resume: null });
    setMatches([]);
    setStats(null);
  }

  async function handleResumeFile(file: File | null) {
    if (!file) return;
    setResumeBusy(true);
    setResumeError(null);
    setResumeProgress("Extracting text…");
    try {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".pdf") && !name.endsWith(".docx") && !name.endsWith(".txt")) {
        setResumeError("Use PDF or DOCX (Word .docx).");
        return;
      }
      const text = await extractFileText(file, (page, total) => {
        setResumeProgress(`Extracting page ${page}/${total}…`);
      });
      if (!text || text.trim().length < 80) {
        setResumeError("Could not extract enough text from this file.");
        return;
      }
      setResumeProgress("Saving resume…");
      const mimeType = name.endsWith(".pdf")
        ? "application/pdf"
        : name.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/plain";
      const res = await fetch("/api/user/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content: text,
          mimeType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResumeError(data.error || "Failed to save resume.");
        return;
      }
      await refreshMe();
      setMatches([]);
      await loadStats("");
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setResumeBusy(false);
      setResumeProgress(null);
    }
  }

  async function runScoring(force = false) {
    setScoreError(null);
    if (!force && pendingCount >= 100 && !confirmLarge) {
      setConfirmLarge(true);
      return;
    }
    setConfirmLarge(false);
    setScoring(true);
    const totalAtStart = Math.max(1, pendingCount);
    let completed = 0;
    setScorePct(0);
    setScoreProgress(`0% · 0/${totalAtStart.toLocaleString()}`);

    const bumpProgress = (extra = "") => {
      const pct =
        completed >= totalAtStart
          ? 100
          : Math.min(99, Math.round((completed / totalAtStart) * 100));
      setScorePct(pct);
      setScoreProgress(
        `${pct}% · ${completed.toLocaleString()}/${totalAtStart.toLocaleString()}${extra}`
      );
    };

    try {
      let done = false;
      let guard = 0;
      while (!done && guard < 500) {
        guard++;
        const res = await fetch("/api/user/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope }),
        });

        const ctype = res.headers.get("content-type") || "";

        // Non-stream JSON (auth / validation / empty done)
        if (!ctype.includes("ndjson")) {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setScoreError(data.error || "Scoring failed.");
            break;
          }
          if (data.done) {
            completed = totalAtStart;
            bumpProgress(" · Done");
            done = true;
            break;
          }
          setScoreError(data.error || "Unexpected scoring response.");
          break;
        }

        if (!res.body) {
          setScoreError("Scoring stream unavailable.");
          break;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let waveScored = 0;
        let waveError: string | null = null;
        let waveDone = false;
        let streamFinished = false;

        while (!streamFinished) {
          const { done: readDone, value } = await reader.read();
          if (readDone) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const raw = line.trim();
            if (!raw) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (ev.type === "progress") {
              const delta = Number(ev.scoredDelta ?? 0);
              waveScored += delta;
              completed += delta;
              bumpProgress();
            } else if (ev.type === "done") {
              waveDone = Boolean(ev.done);
              const reported = Number(ev.scored ?? waveScored);
              if (reported > waveScored) {
                completed += reported - waveScored;
                waveScored = reported;
              }
              bumpProgress(waveDone ? " · Done" : "");
              streamFinished = true;
            } else if (ev.type === "error") {
              waveError = String(ev.error || "Scoring failed.");
              streamFinished = true;
            }
          }
        }

        if (waveError) {
          setScoreError(waveError);
          break;
        }
        if (waveScored === 0 && !waveDone) {
          setScoreError("Wave scored 0 jobs — stopping. Try again later.");
          break;
        }
        done = waveDone;
        if (!done) await new Promise((r) => setTimeout(r, 200));
      }
      await Promise.all([loadMatches(tableSearch), loadStats(""), refreshMe()]);
    } finally {
      setScoring(false);
    }
  }

  if (loadingMe) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-claude-muted">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  // ── Auth gate ──────────────────────────────────────────
  if (!me?.user) {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-claude-text">
            Match Jobs
          </h1>
          <p className="mt-1 text-sm text-claude-muted">
            Sign in to score the job board against your resume.
          </p>
        </div>

        <div className="rounded-xl border border-claude-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                authMode === "login"
                  ? "bg-claude-accent text-white"
                  : "bg-claude-bg text-claude-muted"
              )}
            >
              <LogIn size={14} />
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                authMode === "register"
                  ? "bg-claude-accent text-white"
                  : "bg-claude-bg text-claude-muted"
              )}
            >
              <UserPlus size={14} />
              Create account
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-3">
            {authMode === "register" && (
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="w-full rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
            />
            {authError && (
              <p className="text-xs text-[#a04040]">{authError}</p>
            )}
            <button
              type="submit"
              disabled={authBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-claude-accent px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {authBusy ? <Loader2 size={14} className="animate-spin" /> : null}
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Logged-in workspace ────────────────────────────────
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h1 className="shrink-0 text-lg font-semibold tracking-tight text-claude-text">
            Match Jobs
          </h1>
          {(me.scoreCount != null || stats) && (
            <span className="truncate text-xs">
              {me.scoreCount != null && (
                <span className="font-medium text-[#3d7a3d]">
                  {me.scoreCount.toLocaleString()} scored
                </span>
              )}
              {me.scoreCount != null && stats && (
                <span className="text-claude-border"> · </span>
              )}
              {stats && (
                <span className="font-medium text-[#9a7b2d]">
                  {pendingCount.toLocaleString()} left
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-claude-border bg-white px-2.5"
            title={me.user.email}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-claude-accent text-[10px] font-semibold tracking-wide text-white">
              {userInitials(me.user.name, me.user.email)}
            </span>
            <span className="min-w-0 truncate text-xs font-medium text-claude-text">
              {me.user.name || me.user.email}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-claude-border bg-white px-2.5 text-xs text-claude-muted hover:bg-claude-bg hover:text-claude-text"
          >
            <LogOut size={12} />
            Log out
          </button>
        </div>
      </div>

      {/* Control strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-claude-border bg-white px-3 py-2.5">
        <label
          className={cn(
            "inline-flex max-w-[14rem] cursor-pointer items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 text-xs hover:bg-claude-bg",
            me.resume ? "text-claude-text" : "text-claude-muted"
          )}
          title={me.resume?.filename || "Upload resume"}
        >
          {resumeBusy ? (
            <Loader2 size={14} className="shrink-0 animate-spin" />
          ) : (
            <Upload size={14} className="shrink-0 text-claude-accent" />
          )}
          <span className="truncate">
            {resumeBusy
              ? resumeProgress || "…"
              : me.resume
                ? me.resume.filename
                : "Upload resume"}
          </span>
          <input
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={resumeBusy}
            onChange={(e) => handleResumeFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <span className="hidden h-4 w-px bg-claude-border sm:block" />

        <div className="inline-flex rounded-md bg-claude-bg p-0.5">
          <button
            type="button"
            onClick={() => setScope("unscored")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium",
              scope === "unscored"
                ? "bg-white text-claude-text shadow-sm"
                : "text-claude-muted"
            )}
          >
            Unscored
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium",
              scope === "all"
                ? "bg-white text-claude-text shadow-sm"
                : "text-claude-muted"
            )}
          >
            Rescore all
          </button>
        </div>

        <button
          type="button"
          disabled={!me.resume || scoring || pendingCount === 0}
          onClick={() => runScoring(false)}
          className="inline-flex items-center gap-1.5 rounded-md bg-claude-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {scoring ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {scoring && scorePct != null
            ? `${scorePct}%`
            : `Score${pendingCount ? ` ${pendingCount.toLocaleString()}` : ""}`}
        </button>

        {scoring && scorePct != null && (
          <div className="flex min-w-[10rem] flex-1 items-center gap-2.5 sm:max-w-sm">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-claude-border/60">
              <div
                className="h-full rounded-full bg-claude-accent transition-[width] duration-300 ease-out"
                style={{ width: `${scorePct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-claude-muted">
              {scoreProgress}
            </span>
          </div>
        )}

        <div className="relative ml-auto min-w-[10rem] flex-1 sm:max-w-[16rem] sm:flex-none">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
          />
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadMatches(tableSearch);
            }}
            placeholder="Filter results…"
            className="w-full rounded-md border border-claude-border py-1.5 pl-8 pr-8 text-xs outline-none focus:border-claude-accent"
          />
          {tableSearch && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-claude-muted"
              onClick={() => {
                setTableSearch("");
                loadMatches("");
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {(resumeError || scoreError || confirmLarge || (!me.resume && !resumeBusy)) && (
        <div className="space-y-1 text-[11px]">
          {resumeError && <p className="text-[#a04040]">{resumeError}</p>}
          {scoreError && <p className="text-[#a04040]">{scoreError}</p>}
          {!me.resume && !resumeBusy && (
            <p className="text-claude-muted">Upload a resume to enable scoring.</p>
          )}
          {confirmLarge && (
            <div className="flex flex-wrap items-center gap-2 text-claude-muted">
              <span>Score {pendingCount.toLocaleString()} jobs?</span>
              <button
                type="button"
                onClick={() => runScoring(true)}
                className="rounded bg-claude-accent px-2 py-0.5 text-white"
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => setConfirmLarge(false)}
                className="rounded px-2 py-0.5 text-claude-muted ring-1 ring-claude-border"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results — primary surface */}
      {matchesLoading ? (
        <TableSkeleton />
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-claude-border bg-white/60 px-4 py-10 text-center">
          <Briefcase size={18} className="mb-2 text-claude-accent" />
          <p className="text-sm text-claude-text">No scores yet</p>
          <p className="mt-0.5 text-[11px] text-claude-muted">
            Upload resume, then score to fill this table.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-claude-border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-claude-border bg-claude-bg/50 text-[10px] uppercase tracking-wide text-claude-muted">
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Company</th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">
                  Location
                </th>
                <th className="hidden px-3 py-2 font-semibold lg:table-cell">
                  Strengths
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-claude-border">
              {matches.map((m) => (
                <tr
                  key={m.id}
                  className="cursor-pointer transition-colors hover:bg-claude-bg/40"
                  onClick={() => setSelected(m)}
                >
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex min-w-[2.75rem] justify-center rounded px-1.5 py-0.5 text-xs font-bold",
                        scoreBg(m.score),
                        scoreColor(m.score)
                      )}
                    >
                      {m.score}%
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-claude-text">
                    {m.job.title}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-claude-muted">
                    {m.job.company}
                  </td>
                  <td className="hidden max-w-[120px] truncate px-3 py-2 text-claude-muted md:table-cell">
                    {m.job.location || "—"}
                  </td>
                  <td className="hidden max-w-[240px] truncate px-3 py-2 text-xs text-claude-muted lg:table-cell">
                    {m.strengths || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setSelected(null)}
        >
          <div
            className="fade-up w-full max-w-2xl overflow-hidden rounded-2xl border border-claude-border bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-claude-border p-5">
              <div>
                <div
                  className={cn(
                    "mb-2 inline-flex rounded-md px-2.5 py-1 text-sm font-bold",
                    scoreBg(selected.score),
                    scoreColor(selected.score)
                  )}
                >
                  {selected.score}% match
                </div>
                <h3 className="text-lg font-semibold text-claude-text">
                  {selected.job.title}
                </h3>
                <p className="mt-1 text-sm text-claude-muted">
                  {selected.job.company}
                  {selected.job.location ? ` · ${selected.job.location}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-claude-muted hover:bg-claude-bg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {selected.strengths && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-claude-muted">
                    Strengths
                  </div>
                  <p className="text-claude-text">{selected.strengths}</p>
                </div>
              )}
              {selected.gaps && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-claude-muted">
                    Gaps
                  </div>
                  <p className="text-claude-text">{selected.gaps}</p>
                </div>
              )}
              {selected.job.description && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-claude-muted">
                    Description
                  </div>
                  <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-claude-muted">
                    {selected.job.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
