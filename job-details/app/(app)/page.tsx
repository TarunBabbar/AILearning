"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Building2,
  MapPin,
  Mail,
  Briefcase,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  FileText,
  Sparkles,
  Inbox,
  Database,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JobCardSkeleton } from "@/components/Skeleton";
import { useListSWR } from "@/lib/use-list-swr";
import type { JobsResponse, Job } from "@/lib/types";

const PAGE_SIZE = 40;

// Deterministic pastel avatar colors derived from the company name
const AVATAR_COLORS = [
  "bg-[#f7e9e2] text-[#c96443]",
  "bg-[#e6edf5] text-[#4a6d8c]",
  "bg-[#e3efe3] text-[#3d7a3d]",
  "bg-[#f3e8f5] text-[#7a3d8c]",
  "bg-[#e8f0d9] text-[#5a7a2d]",
  "bg-[#fdf0d5] text-[#9a7b2d]",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Search / sort change → back to page 1
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort]);

  // New page → scroll list back to top
  useEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const jobsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sort) params.set("sort", sort);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return `/api/jobs?${params.toString()}`;
  }, [debouncedSearch, sort, page]);

  const { data, error: swrError, isLoading } = useListSWR<JobsResponse>(jobsKey);
  const loading = isLoading && !data;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "Failed to load jobs"
    : null;

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setApiKeyConfigured(d.apiKeyConfigured))
      .catch(() => setApiKeyConfigured(false));
  }, []);

  const stats = useMemo(() => {
    if (!data) return { total: 0, companies: 0, sources: 0 };
    return {
      total: data.total,
      companies: data.companyCount ?? 0,
      sources: data.sourceCount ?? 0,
    };
  }, [data]);

  const pageCount = data?.pageCount ?? 1;

  // Group current page by date
  const grouped = useMemo(() => {
    if (!data || data.jobs.length === 0) return [];
    const map = new Map<string, Job[]>();
    for (const job of data.jobs) {
      const key = (job.jobDate || job.createdAt || "").slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(job);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, jobs]) => ({ date, jobs }));
  }, [data]);

  const openJob = useCallback(async (job: Job) => {
    setSelectedJob(job);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { job?: Job };
      if (body.job) setSelectedJob(body.job);
    } catch {
      // keep slim card data in the modal
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Compact header: title + stats + search/sort */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-claude-text">
            All Jobs
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-claude-muted">
            <span className="inline-flex items-center gap-1 rounded-md bg-claude-accent-soft px-2 py-1 font-medium text-claude-accent">
              <Briefcase size={12} />
              {stats.total.toLocaleString()} jobs
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#e6edf5] px-2 py-1 font-medium text-[#4a6d8c]">
              <Building2 size={12} />
              {stats.companies.toLocaleString()} companies
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#e3efe3] px-2 py-1 font-medium text-[#3d7a3d]">
              <FileText size={12} />
              {stats.sources.toLocaleString()} sources
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-xl lg:justify-end">
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, company, location, email…"
              className="w-full rounded-lg border border-claude-border bg-white py-1.5 pl-8 pr-7 text-sm outline-none transition-colors placeholder:text-claude-muted focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/15"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-claude-muted hover:text-claude-text"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="relative shrink-0">
            <ArrowUpDown
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-claude-border bg-white py-1.5 pl-7 pr-2 text-sm text-claude-text outline-none transition-colors focus:border-claude-accent"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </div>

      {/* API key banner */}
      {apiKeyConfigured === false && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-claude-border bg-white px-3 py-2 text-xs shadow-sm">
          <Sparkles size={14} className="shrink-0 text-claude-accent" />
          <span className="flex-1 text-claude-muted">
            No OpenRouter API key configured. Set{" "}
            <code className="rounded bg-claude-beige-deep px-1 py-0.5 text-[11px]">
              OPENROUTER_API_KEY
            </code>{" "}
            to enable extraction.
          </span>
        </div>
      )}

      {/* Jobs grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-claude-border bg-white p-8 text-center text-sm text-claude-muted shadow-sm">
          {error}
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <div className="rounded-xl border border-claude-border bg-white p-16 text-center shadow-sm">
          {data?.dbError ? (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5e5e5] text-[#a04040]">
                <Database size={24} />
              </div>
              <p className="text-base font-semibold text-claude-text">
                Database not reachable
              </p>
              <p className="mt-2 text-sm text-claude-muted">
                Could not connect to PostgreSQL. Make sure the database server is
                running and{" "}
                <code className="rounded bg-claude-beige-deep px-1.5 py-0.5 text-[12px]">
                  DATABASE_URL
                </code>{" "}
                is correct.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
                <Inbox size={24} />
              </div>
              <p className="text-base font-semibold text-claude-text">No jobs yet</p>
              <p className="mt-2 text-sm text-claude-muted">
                Jobs will appear here once uploaded. Use the left navigation to
                upload job PDFs.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {grouped.map(({ jobs }) => (
              <div key={jobs[0]?.id ?? "group"}>
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onOpen={() => openJob(job)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination at page footer */}
          {pageCount > 1 && (
            <div className="mt-8 flex justify-center">
              <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-claude-border bg-white px-2 py-1.5 shadow-sm">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage(1)}
                  title="First page"
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={12} className="-mr-1" />
                  <ChevronLeft size={12} />
                  <span className="ml-0.5">First</span>
                </button>
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="px-2 text-xs text-claude-muted">
                  Page{" "}
                  <span className="font-semibold text-claude-text">{data.page}</span>
                  {" of "}
                  <span className="font-semibold text-claude-text">{pageCount}</span>
                  <span className="ml-1.5 text-claude-muted/70">
                    · {data.total.toLocaleString()}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount || isLoading}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount || isLoading}
                  onClick={() => setPage(pageCount)}
                  title="Last page"
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="mr-0.5">Last</span>
                  <ChevronRight size={12} />
                  <ChevronRight size={12} className="-ml-1" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Job detail modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          loading={detailLoading}
          onClose={() => {
            setSelectedJob(null);
            setDetailLoading(false);
          }}
        />
      )}
    </div>
  );
}

function JobCard({
  job,
  onOpen,
}: {
  job: Job;
  onOpen: () => void;
}) {
  const color = avatarColor(job.company);

  return (
    <div
      className="fade-up group flex h-full flex-col overflow-hidden rounded-lg border border-claude-border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={cn("h-0.5 w-full", color.split(" ")[0])} />

      <button onClick={onOpen} className="flex flex-1 flex-col p-3.5 text-left">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
              color
            )}
          >
            {initials(job.company)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug text-claude-text">
              {job.title}
            </h3>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-claude-muted">
              <Building2 size={11} className="shrink-0 text-claude-accent/70" />
              <span className="truncate font-medium text-claude-text/80">
                {job.company}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {job.location && (
            <MetaChip icon={<MapPin size={10} />} text={job.location} />
          )}
          {job.experience && (
            <MetaChip icon={<Clock size={10} />} text={job.experience} />
          )}
        </div>

        {job.description ? (
          <p className="mt-2 line-clamp-2 min-h-[28px] text-[11px] leading-relaxed text-claude-muted">
            {job.description}
          </p>
        ) : (
          <div className="mt-2 min-h-[28px]" />
        )}

        <div className="mt-auto flex items-center justify-between pt-2.5 text-[11px] text-claude-muted">
          <span className="truncate pr-2">{job.email ?? ""}</span>
          <span className="flex shrink-0 items-center gap-0.5">
            {job.jobDate ? formatShortDate(job.jobDate) : ""}
            <ChevronDown size={12} />
          </span>
        </div>
      </button>
    </div>
  );
}

function JobDetailModal({
  job,
  loading,
  onClose,
}: {
  job: Job;
  loading: boolean;
  onClose: () => void;
}) {
  const color = avatarColor(job.company);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="fade-up relative w-full max-w-2xl overflow-hidden rounded-2xl border border-claude-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("h-1.5 w-full", color.split(" ")[0])} />
        <div className="flex items-start gap-4 border-b border-claude-border p-6">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold",
              color
            )}
          >
            {initials(job.company)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-snug text-claude-text">
              {job.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-claude-muted">
              <span className="flex items-center gap-1.5">
                <Building2 size={14} className="text-claude-accent/70" />
                {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-claude-accent/70" />
                  {job.location}
                </span>
              )}
              {job.jobDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-claude-accent/70" />
                  {formatShortDate(job.jobDate)}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.experience && (
                <MetaChip icon={<Clock size={11} />} text={job.experience} />
              )}
              {job.email && (
                <MetaChip icon={<Mail size={11} />} text={job.email} />
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-claude-muted transition-colors hover:bg-claude-bg hover:text-claude-text"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-claude-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading full description…
            </div>
          ) : job.description ? (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-claude-muted/70">
                Full description
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-claude-muted">
                {job.description}
              </div>
            </>
          ) : (
            <p className="text-sm text-claude-muted">No description available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex max-w-full items-center gap-0.5 rounded bg-claude-bg px-1.5 py-0.5 text-[10px] text-claude-muted">
      <span className="shrink-0 text-claude-accent/70">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}
