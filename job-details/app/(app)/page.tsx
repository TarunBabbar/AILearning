"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Building2,
  MapPin,
  Mail,
  Briefcase,
  Clock,
  Loader2,
  ChevronDown,
  X,
  Calendar,
  FileText,
  Sparkles,
  Inbox,
  Database,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobsResponse, Job } from "@/lib/types";

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

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (dateStr === todayKey) return `Today · ${d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}`;
  if (dateStr === yesterday) return `Yesterday · ${d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}`;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function Dashboard() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Check if an API key is configured
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setApiKeyConfigured(d.apiKeyConfigured))
      .catch(() => setApiKeyConfigured(false));
  }, []);

  const stats = useMemo(() => {
    if (!data) return { total: 0, withCompany: 0, sources: 0 };
    const withCompany = data.jobs.filter((j) => j.companyInfo).length;
    const sources = new Set(data.jobs.map((j) => j.fileName).filter(Boolean)).size;
    return { total: data.total, withCompany, sources };
  }, [data]);

  // Group jobs by date (jobDate or createdAt fallback)
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

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-claude-text">
            QA Job Details
          </h1>
          <p className="mt-1.5 text-sm text-claude-muted">
            All your tracked QA opportunities, in one place.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-claude-muted sm:flex">
          <span className="inline-block h-2 w-2 rounded-full bg-claude-accent" />
          {data ? `${data.total} job${data.total === 1 ? "" : "s"} in the database` : "…"}
        </div>
      </div>

      {/* API key banner */}
      {apiKeyConfigured === false && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-claude-border bg-white p-4 text-sm shadow-sm">
          <Sparkles size={18} className="shrink-0 text-claude-accent" />
          <span className="flex-1 text-claude-muted">
            No OpenRouter API key configured. Set{" "}
            <code className="rounded bg-claude-beige-deep px-1.5 py-0.5 text-[12px]">
              OPENROUTER_API_KEY
            </code>{" "}
            in the environment to enable extraction.
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Briefcase}
          label="Total Jobs"
          value={stats.total}
          accent="bg-claude-accent-soft text-claude-accent"
        />
        <StatCard
          icon={Building2}
          label="Known Companies"
          value={stats.withCompany}
          accent="bg-[#e6edf5] text-[#4a6d8c]"
          hint={stats.total > 0 ? `${Math.round((stats.withCompany / stats.total) * 100)}% resolved` : undefined}
        />
        <StatCard
          icon={FileText}
          label="Source Files"
          value={stats.sources}
          accent="bg-[#e3efe3] text-[#3d7a3d]"
        />
      </div>

      {/* Filters + status pills */}
      <div className="mb-4 rounded-xl border border-claude-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, company, location, email…"
              className="w-full rounded-lg border border-claude-border bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-claude-muted focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/15"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-claude-muted hover:text-claude-text"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative">
            <ArrowUpDown
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-claude-border bg-white py-2 pl-8 pr-3 text-sm text-claude-text outline-none transition-colors focus:border-claude-accent"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="company">Company A–Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-claude-muted">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading jobs…
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
        <div className="space-y-8">
          {grouped.map(({ date, jobs }) => (
            <div key={date}>
              {/* Date header */}
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold text-claude-text">
                  {formatDateHeader(date)}
                </h2>
                <span className="rounded-full bg-claude-accent-soft px-2 py-0.5 text-[11px] font-medium text-claude-accent-strong">
                  {jobs.length} job{jobs.length === 1 ? "" : "s"}
                </span>
                <div className="h-px flex-1 bg-claude-border" />
              </div>

              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onOpen={() => setSelectedJob(job)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job detail modal */}
      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-claude-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div
        className={cn(
          "pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.06] transition-transform group-hover:scale-125",
          accent
        )}
      />
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            accent
          )}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-[26px] font-semibold leading-tight text-claude-text">
            {value}
          </div>
          <div className="text-xs text-claude-muted">{label}</div>
          {hint && <div className="mt-0.5 text-[11px] text-claude-accent">{hint}</div>}
        </div>
      </div>
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
      className="fade-up group flex h-full flex-col overflow-hidden rounded-xl border border-claude-border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Top accent bar */}
      <div className={cn("h-1 w-full", color.split(" ")[0])} />

      {/* Card body */}
      <button onClick={onOpen} className="flex flex-1 flex-col p-5 text-left">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
              color
            )}
          >
            {initials(job.company)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 min-h-[40px] text-[15px] font-semibold leading-snug text-claude-text">
              {job.title}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-claude-muted">
              <Building2 size={13} className="shrink-0 text-claude-accent/70" />
              <span className="truncate font-medium text-claude-text/80">
                {job.company}
              </span>
            </div>
          </div>
        </div>

        {/* Meta chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.location && (
            <MetaChip icon={<MapPin size={11} />} text={job.location} />
          )}
          {job.experience && (
            <MetaChip icon={<Clock size={11} />} text={job.experience} />
          )}
          {job.email && (
            <MetaChip icon={<Mail size={11} />} text={job.email} />
          )}
        </div>

        {/* Description preview — fixed 2-line height keeps cards even */}
        {job.description ? (
          <p className="mt-3 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-claude-muted">
            {job.description}
          </p>
        ) : (
          <div className="mt-3 min-h-[32px]" />
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-claude-muted">
          <span className="flex items-center gap-1.5">
            {job.companyInfo && (
              <span className="flex items-center gap-1 text-claude-text/70">
                <Building2 size={11} className="text-[#4a6d8c]" />
                {job.companyInfo.name}
              </span>
            )}
            {job.companyInfo?.location && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {job.companyInfo.location}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {job.jobDate ? formatShortDate(job.jobDate) : ""}
            <ChevronDown size={14} />
          </span>
        </div>
      </button>
    </div>
  );
}

function JobDetailModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const color = avatarColor(job.company);

  // Close on Escape
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
        {/* Header */}
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

        {/* Company info */}
        {job.companyInfo && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-claude-border bg-claude-bg/50 px-6 py-3 text-sm text-claude-muted">
            <span className="flex items-center gap-1.5 font-medium text-claude-text">
              <Building2 size={14} className="text-[#4a6d8c]" />
              {job.companyInfo.name}
            </span>
            {job.companyInfo.type && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] ring-1 ring-claude-border">
                {job.companyInfo.type}
              </span>
            )}
            {job.companyInfo.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {job.companyInfo.location}
              </span>
            )}
            {job.companyInfo.website && (
              <a
                href={job.companyInfo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-claude-accent hover:underline"
              >
                {job.companyInfo.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        )}

        {/* Description */}
        <div className="max-h-[50vh] overflow-y-auto p-6">
          {job.description ? (
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
    <span className="flex max-w-full items-center gap-1 rounded-md bg-claude-bg px-2 py-1 text-[11px] text-claude-muted">
      <span className="shrink-0 text-claude-accent/70">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}
