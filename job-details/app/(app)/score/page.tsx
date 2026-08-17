"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton, JobGridSkeleton } from "@/components/Skeleton";
import JobCard from "@/components/JobCard";
import JobFilters, { type JobFilterValue } from "@/components/JobFilters";
import JobDetailModal from "@/components/JobDetailModal";
import ChatWidget from "@/components/ChatWidget";
import ListPagination from "@/components/ListPagination";
import ShowingRange from "@/components/ShowingRange";
import PageChrome from "@/components/PageChrome";
import { mutate } from "swr";
import { SESSION_KEY } from "@/lib/swr-fetcher";
import { cachedListFetch, invalidateUserListCache } from "@/lib/use-list-swr";
import type { JobLike, JobFiltersOptions } from "@/lib/types";

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
  job: JobLike;
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

const MATCH_PAGE_SIZE = 40;

const SCORE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "score", label: "Best score" },
  { value: "company", label: "Company A–Z" },
  { value: "location", label: "Location A–Z" },
];

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

export default function ScoreJobsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [scope, setScope] = useState<"unscored" | "all">("unscored");
  const [stats, setStats] = useState<ScoreStats | null>(null);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreProgress, setScoreProgress] = useState<string | null>(null);
  const [scorePct, setScorePct] = useState<number | null>(null);
  const [runCompleted, setRunCompleted] = useState(0);
  const runTotalRef = useRef(1);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreFailed, setScoreFailed] = useState(0);
  // Cumulative "scored" count streamed live from the score run (base + new).
  const [liveScored, setLiveScored] = useState<number | null>(null);
  const liveRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRefreshPendingRef = useRef(false);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [matchesPageCount, setMatchesPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "score" | "company" | "location">(
    "newest"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [filterOptions, setFilterOptions] = useState<JobFiltersOptions>({
    companies: [],
    locations: [],
  });

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/user/me", { cache: "no-store" });
    const data = (await res.json()) as MeResponse;
    setMe(data);
    return data;
  }, []);

  const loadMatches = useCallback(
    async (overrides?: {
      minScore?: number;
      search?: string;
      company?: string;
      location?: string;
      today?: boolean;
      sort?: "newest" | "score" | "company" | "location";
      order?: "asc" | "desc";
      page?: number;
      /** Background refresh — don't flip the loading skeleton. */
      silent?: boolean;
    }) => {
      if (!overrides?.silent) setMatchesLoading(true);
      try {
        const params = new URLSearchParams();
        const ms = overrides?.minScore ?? minScore;
        const searchQ = overrides?.search ?? search;
        const company = overrides?.company ?? companyFilter;
        const location = overrides?.location ?? locationFilter;
        const today = overrides?.today ?? todayOnly;
        const sort = overrides?.sort ?? sortBy;
        const order = overrides?.order ?? sortOrder;
        const pageNo = overrides?.page ?? page;

        if (ms > 0) params.set("minScore", String(ms));
        if (searchQ.trim()) params.set("search", searchQ.trim());
        if (company.trim()) params.set("company", company.trim());
        if (location.trim()) params.set("location", location.trim());
        if (today) params.set("today", "1");
        params.set("sort", sort);
        params.set("order", order);
        params.set("page", String(pageNo));
        params.set("pageSize", String(MATCH_PAGE_SIZE));

        const url = `/api/user/matches?${params}`;
        type MatchesData = {
          matches: MatchRow[];
          total?: number;
          page?: number;
          pageCount?: number;
        };
        const apply = (data: MatchesData) => {
          setMatches(data.matches ?? []);
          setMatchesTotal(data.total ?? data.matches?.length ?? 0);
          setMatchesPageCount(Math.max(1, data.pageCount ?? 1));
          if (data.page && data.page !== pageNo) setPage(data.page);
        };

        if (overrides?.silent) {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            setMatches([]);
            setMatchesTotal(0);
            setMatchesPageCount(1);
            return;
          }
          apply(await res.json());
          return;
        }

        // Cache-first: show whatever we have immediately (no DB wait), then
        // revalidate in the background and update state with fresh data.
        const cached = await cachedListFetch<MatchesData>(url);
        apply(cached);
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) apply(await res.json());
        } catch {
          // keep showing cached data on refresh failure
        }
      } finally {
        if (!overrides?.silent) setMatchesLoading(false);
      }
    },
    [
      minScore,
      search,
      companyFilter,
      locationFilter,
      todayOnly,
      sortBy,
      sortOrder,
      page,
    ]
  );

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
    // Initial load only — do not re-run when filter inputs change while typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load dropdown options once on mount — scoped to this user's scored jobs
  // so counts match what the results grid will actually show.
  useEffect(() => {
    fetch("/api/user/matches/filters", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setFilterOptions(d);
      })
      .catch(() => {});
  }, []);

  const pendingCount = useMemo(() => {
    if (!stats) return 0;
    return scope === "all" ? stats.totalMatching : stats.unscored;
  }, [stats, scope]);

  const handleFilters = useCallback(
    (next: JobFilterValue) => {
      const sort: "newest" | "score" | "company" | "location" =
        next.sort === "company" || next.sort === "location"
          ? next.sort
          : next.sort === "newest"
            ? "newest"
            : "score";
      const order: "asc" | "desc" =
        sort === "company" || sort === "location" ? "asc" : "desc";
      setSearch(next.search);
      setCompanyFilter(next.company);
      setLocationFilter(next.location);
      setSortBy(sort);
      setSortOrder(order);
      setTodayOnly(next.today === true);
      setPage(1);
      loadMatches({
        search: next.search,
        company: next.company,
        location: next.location,
        today: next.today === true,
        sort,
        order,
        page: 1,
      });
    },
    [loadMatches]
  );

  const filterValue: JobFilterValue = {
    search,
    company: companyFilter,
    location: locationFilter,
    sort: sortBy,
    order: sortOrder,
    today: todayOnly,
  };

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
        // Update the shared session key so sidebar/contacts pages reflect
        // the login immediately (no refresh needed).
        await mutate(SESSION_KEY, next, { revalidate: false });
        await Promise.all([loadMatches(), loadStats("")]);
        // New users land on the Upload Resume page so their first step is
        // guided, instead of an empty scoring screen.
        if (authMode === "register" && !next.resume) {
          window.location.href = "/resume";
        }
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/user/logout", { method: "POST" });
    // Clear the shared session key so sidebar/contacts pages hide the
    // Recruiter Contacts section immediately.
    await mutate(SESSION_KEY, { user: null }, { revalidate: false });
    setMe({ user: null, resume: null });
    setMatches([]);
    setStats(null);
  }

  async function runScoring(force = false) {
    setScoreError(null);
    setScoreFailed(0);
    if (!force && pendingCount >= 100 && !confirmLarge) {
      setConfirmLarge(true);
      return;
    }
    setConfirmLarge(false);
    setScoring(true);
    setLiveScored(me?.scoreCount ?? null);
    const totalAtStart = Math.max(1, pendingCount);
    runTotalRef.current = totalAtStart;
    let completed = 0;
    setRunCompleted(0);
    setScorePct(0);
    setScoreProgress(`0% · 0/${totalAtStart.toLocaleString()}`);

    // Monotonic client-side progress: totalAtStart is fixed, `completed`
    // only ever increases via scoredDelta / final scored. Never sawtooths.
    const bumpProgress = (extra = "") => {
      const pct =
        completed >= totalAtStart
          ? 100
          : Math.min(99, Math.round((completed / totalAtStart) * 100));
      setRunCompleted(completed);
      setScorePct(pct);
      setScoreProgress(
        `${pct}% · ${completed.toLocaleString()}/${totalAtStart.toLocaleString()}${extra}`
      );
    };

    // Live results: refresh the grid only when a scoring chunk actually lands
    // in the DB (server fires `progress` after each batch save). Debounced so
    // back-to-back chunks collapse into one refetch, and silent — no skeleton.
    const scheduleLiveRefresh = () => {
      if (liveRefreshTimerRef.current) return;
      liveRefreshTimerRef.current = setTimeout(() => {
        liveRefreshTimerRef.current = null;
        if (liveRefreshPendingRef.current) return;
        liveRefreshPendingRef.current = true;
        void Promise.all([
          loadMatches({ silent: true }),
          loadStats(""),
        ]).finally(() => {
          liveRefreshPendingRef.current = false;
        });
      }, 800);
    };
    const stopLiveRefresh = () => {
      if (liveRefreshTimerRef.current) {
        clearTimeout(liveRefreshTimerRef.current);
        liveRefreshTimerRef.current = null;
      }
      liveRefreshPendingRef.current = false;
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
              scheduleLiveRefresh();
              const delta = Number(ev.scoredDelta ?? 0);
              if (Number.isFinite(Number(ev.scored))) {
                setLiveScored(Number(ev.scored));
              }
              if (delta > 0) {
                waveScored += delta;
                completed += delta;
                bumpProgress();
              }
            } else if (ev.type === "done") {
              waveDone = Boolean(ev.done);
              if (Number.isFinite(Number(ev.scored))) {
                setLiveScored(Number(ev.scored));
              }
              const reported = Number(ev.scored ?? waveScored);
              if (reported > waveScored) {
                completed += reported - waveScored;
                waveScored = reported;
              }
              const fc = Number(ev.failedCount ?? 0);
              if (fc > 0) {
                setScoreFailed((prev) => prev + fc);
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
      await Promise.all([loadMatches(), loadStats(""), refreshMe()]);
      // Scoring wrote new rows — clear the match cache so the next load is fresh.
      invalidateUserListCache();
    } finally {
      stopLiveRefresh();
      setScoring(false);
      setLiveScored(null);
      // Clear the progress UI so the next interaction starts clean
      // (no stale "0%" or run counter from a finished run).
      setScorePct(null);
      setScoreProgress(null);
    }
  }

  if (loadingMe) {
    return (
      <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-claude-border bg-white px-3 py-2.5">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="overflow-hidden rounded-lg border border-claude-border bg-white">
          <div className="flex flex-wrap gap-2 border-b border-claude-border bg-claude-bg/30 px-3 py-2.5">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="ml-auto h-8 w-24 rounded-md" />
          </div>
          <JobGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  // ── Auth gate ──────────────────────────────────────────
  if (!me?.user) {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-claude-text">
            Match Jobs by Resume
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-claude-muted">
            Sign in, upload your resume, and score board openings against it.
            Each job gets a fit % plus short strengths and gaps for your profile.
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

          {authMode === "register" && (
            <div className="mb-4 rounded-lg border border-[#eadfc2] bg-[#fbf6e9] p-3 text-xs leading-relaxed text-[#6b5a2e]">
              <span className="font-semibold uppercase tracking-wide text-[#7a6120]">
                Note
              </span>
              <p className="mt-1">
                Use any email id and password to create an account — your
                results are private to your account.
              </p>
            </div>
          )}

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
            {authMode === "login" && (
              <p className="text-center text-xs text-claude-muted">
                <Link
                  href="/forgot-password"
                  className="font-medium text-claude-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </p>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ── Logged-in workspace ────────────────────────────────
  return (
    <PageChrome
      maxWidthClass="max-w-7xl"
      hideHeader={!!selected}
      header={
        <div className="flex flex-col gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h1 className="shrink-0 text-sm font-semibold tracking-tight text-claude-text">
                Match Jobs by Resume
              </h1>

              <div className="inline-flex h-7 rounded-md border border-claude-border bg-claude-bg p-0.5">
                <button
                  type="button"
                  onClick={() => setScope("unscored")}
                  className={cn(
                    "rounded px-1.5 text-[11px] font-medium",
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
                    "rounded px-1.5 text-[11px] font-medium",
                    scope === "all"
                      ? "bg-white text-claude-text shadow-sm"
                      : "text-claude-muted"
                  )}
                >
                  Rescore
                </button>
              </div>

              <button
                type="button"
                disabled={!me.resume || scoring || pendingCount === 0}
                onClick={() => runScoring(false)}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-claude-accent px-2 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {scoring && scorePct != null ? (
                  `${scorePct}%`
                ) : (
                  <>
                    <RefreshCw size={11} />
                    {`Score${pendingCount ? ` ${pendingCount.toLocaleString()}` : ""}`}
                  </>
                )}
              </button>

              {scoring && scorePct != null && (
                <div className="flex h-7 w-20 items-center">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-claude-border/60">
                    <div
                      className="h-full rounded-full bg-claude-accent transition-[width] duration-300 ease-out"
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Confirm prompt — same line, right after the controls */}
              {confirmLarge && (
                <span className="inline-flex shrink-0 items-center gap-2 text-[11px] text-claude-text">
                  <span className="font-medium">Score {pendingCount.toLocaleString()} jobs?</span>
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
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <div
                className="flex h-7 max-w-[7.5rem] items-center gap-1 rounded-md border border-claude-border bg-white px-1.5"
                title={me.user.email}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-claude-accent text-[9px] font-semibold text-white">
                  {userInitials(me.user.name, me.user.email)}
                </span>
                <span className="min-w-0 truncate text-[11px] font-medium text-claude-text">
                  {me.user.name || me.user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-claude-border bg-white px-1.5 text-[11px] text-claude-muted hover:bg-claude-bg hover:text-claude-text"
              >
                <LogOut size={11} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-claude-muted">
            {(me.scoreCount != null || stats) && (
              <span className="shrink-0">
                {scoring && liveScored != null ? (
                  <span className="font-medium text-[#3d7a3d]">
                    {liveScored.toLocaleString()} scored
                  </span>
                ) : me.scoreCount != null ? (
                  <span className="font-medium text-[#3d7a3d]">
                    {me.scoreCount.toLocaleString()} scored
                  </span>
                ) : null}
                {scoring && (
                  <>
                    <span className="text-claude-border"> · </span>
                    <span className="font-medium text-claude-text">
                      {runCompleted.toLocaleString()} processed
                    </span>
                    <span className="text-claude-border"> · </span>
                    <span className="font-medium text-[#9a7b2d]">
                      {Math.max(
                        0,
                        runTotalRef.current - runCompleted
                      ).toLocaleString()}{" "}
                      remaining
                    </span>
                    {scoreFailed > 0 && (
                      <>
                        <span className="text-claude-border"> · </span>
                        <span className="font-medium text-[#a04040]">
                          {scoreFailed.toLocaleString()} error
                        </span>
                      </>
                    )}
                  </>
                )}
                {!scoring && stats && (
                  <>
                    <span className="text-claude-border"> · </span>
                    <span className="font-medium text-[#9a7b2d]">
                      {pendingCount.toLocaleString()} left
                    </span>
                  </>
                )}
                <span className="text-claude-border"> · </span>
              </span>
            )}
            <span className="min-w-0 flex-1">
              Score shared board jobs against your resume. Results show fit % with
              strengths and gaps — private to your account.
            </span>
          </div>
        </div>
      }
    >
      {(scoreError || scoreFailed > 0 || !me.resume) && (
        <div className="space-y-1 text-[11px]">
          {scoreError && <p className="text-[#a04040]">{scoreError}</p>}
          {!scoring && scoreFailed > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#eadfc2] bg-[#fbf6e9] px-2.5 py-1.5 text-[#6b5a2e]">
              <span>
                {scoreFailed.toLocaleString()} job{scoreFailed === 1 ? "" : "s"}{" "}
                hit an error and couldn&apos;t be scored. The rest are done —
                click Score again later to retry the failed ones.
              </span>
            </div>
          )}
          {!me.resume && (
            <p className="text-claude-muted">
              No resume yet —{" "}
              <Link href="/resume" className="font-medium text-claude-accent hover:underline">
                upload your resume
              </Link>{" "}
              to enable scoring.
            </p>
          )}
        </div>
      )}

      {/* Filter bar — shared with QA Jobs, plus score-only controls */}
      <div className="mb-3 flex min-w-0 flex-nowrap items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <JobFilters
            value={filterValue}
            onChange={handleFilters}
            companyOptions={filterOptions.companies}
            locationOptions={filterOptions.locations}
            sortOptions={SCORE_SORT_OPTIONS}
            rightSlot={
              <select
                value={minScore}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setMinScore(v);
                  setPage(1);
                  loadMatches({ minScore: v, page: 1 });
                }}
                title="Minimum fit score"
                className="h-9 shrink-0 cursor-pointer appearance-none rounded-lg border border-claude-border bg-white px-2.5 text-[13px] text-claude-text outline-none focus:border-claude-accent"
              >
                <option value={0}>Any score</option>
                <option value={30}>≥ 30%</option>
                <option value={50}>≥ 50%</option>
                <option value={70}>≥ 70%</option>
                <option value={80}>≥ 80%</option>
              </select>
            }
          />
        </div>

        {/* Showing range — pinned to the far right of the same line */}
        {matchesTotal > 0 && (
          <ShowingRange
            page={page}
            pageSize={MATCH_PAGE_SIZE}
            itemCount={matches.length}
            total={matchesTotal}
            className="ml-auto shrink-0"
          />
        )}
      </div>

      {/* Results — shared card grid with score badges */}
      {matchesLoading ? (
        <JobGridSkeleton />
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-claude-border bg-white px-4 py-12 text-center shadow-sm">
          <Briefcase size={18} className="mb-2 text-claude-accent" />
          <p className="text-sm text-claude-text">
            {scoring
              ? "Scoring in progress…"
              : minScore || search || companyFilter || locationFilter
                ? "No scores match these filters"
                : me.resume
                  ? "No scores yet"
                  : "No resume yet"}
          </p>
          <p className="mt-0.5 text-[11px] text-claude-muted">
            {scoring
              ? "Results appear here as they're scored — no need to wait for the full run."
              : minScore || search || companyFilter || locationFilter
                ? "Clear or loosen filters, or score more jobs."
                : me.resume
                  ? "Your resume is ready — click the Score button to match jobs against it."
                  : "Upload a resume, then score jobs against it."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {matches.map((m) => (
              <JobCard
                key={m.id}
                job={m.job}
                score={m.score}
                strengths={m.strengths}
                onOpen={() => setSelected(m)}
              />
            ))}
          </div>

          {matchesPageCount > 1 && (
            <ListPagination
              page={page}
              pageCount={matchesPageCount}
              total={matchesTotal}
              loading={matchesLoading}
              onPageChange={(p) => {
                setPage(p);
                loadMatches({ page: p });
              }}
            />
          )}
        </>
      )}

      {selected && (
        <JobDetailModal
          job={selected.job}
          loading={false}
          score={selected.score}
          strengths={selected.strengths}
          gaps={selected.gaps}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Floating chat — only rendered for logged-in users (this branch) */}
      <ChatWidget />
    </PageChrome>
  );
}
