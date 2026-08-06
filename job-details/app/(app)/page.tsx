"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  MapPin,
  Mail,
  Briefcase,
  Clock,
  Upload,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { JobsResponse, Job } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-[#f7e9e2] text-[#c96443]",
  reviewed: "bg-[#e6edf5] text-[#4a6d8c]",
  applied: "bg-[#e3efe3] text-[#3d7a3d]",
  interview: "bg-[#f3e8f5] text-[#7a3d8c]",
  offer: "bg-[#e8f0d9] text-[#5a7a2d]",
  rejected: "bg-[#f5e5e5] text-[#a04040]",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export default function Dashboard() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [expanded, setExpanded] = useState<string | null>(null);
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
      if (statusFilter) params.set("status", statusFilter);
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
  }, [debouncedSearch, statusFilter, sort]);

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
    if (!data) return { total: 0, withCompany: 0 };
    const withCompany = data.jobs.filter((j) => j.companyInfo).length;
    return { total: data.total, withCompany };
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-claude-text">
            Job Dashboard
          </h1>
          <p className="mt-1 text-sm text-claude-muted">
            Browse extracted jobs, search, and see company details resolved from
            email domains.
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 rounded-lg bg-claude-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-claude-accent-strong"
        >
          <Upload size={16} />
          Upload Jobs
        </Link>
      </div>

      {/* API key banner */}
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

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Briefcase}
          label="Total Jobs"
          value={stats.total}
        />
        <StatCard
          icon={Building2}
          label="With Company Info"
          value={stats.withCompany}
        />
        <StatCard
          icon={FileText}
          label="Sources (Files)"
          value={
            data
              ? new Set(data.jobs.map((j) => j.fileName).filter(Boolean)).size
              : 0
          }
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, company, location, email…"
            className="w-full rounded-lg border border-claude-border bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-claude-muted focus:border-claude-accent"
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="company">Company A–Z</option>
        </select>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-claude-muted">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading jobs…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-claude-border bg-white p-6 text-sm text-claude-muted">
          {error}
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <div className="rounded-lg border border-claude-border bg-white p-12 text-center">
          <Briefcase size={32} className="mx-auto mb-3 text-claude-muted/50" />
          <p className="text-sm font-medium text-claude-text">No jobs yet</p>
          <p className="mt-1 text-sm text-claude-muted">
            Upload job PDFs to start extracting job details.
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-claude-accent px-4 py-2 text-sm font-medium text-white hover:bg-claude-accent-strong"
          >
            <Upload size={16} />
            Go to Upload
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              expanded={expanded === job.id}
              onToggle={() =>
                setExpanded(expanded === job.id ? null : job.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-claude-border bg-white p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-claude-accent-soft text-claude-accent">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-semibold text-claude-text">{value}</div>
        <div className="text-xs text-claude-muted">{label}</div>
      </div>
    </div>
  );
}

function JobCard({
  job,
  expanded,
  onToggle,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusStyle = STATUS_STYLES[job.status] || STATUS_STYLES.new;
  const statusLabel = STATUS_LABELS[job.status] || job.status;

  return (
    <div className="fade-up rounded-xl border border-claude-border bg-white transition-shadow hover:shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-claude-accent-soft text-claude-accent">
          <Briefcase size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-claude-text">{job.title}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                statusStyle
              )}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-claude-muted">
            <span className="flex items-center gap-1">
              <Building2 size={12} />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {job.location}
              </span>
            )}
            {job.experience && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {job.experience}
              </span>
            )}
            {job.email && (
              <span className="flex items-center gap-1">
                <Mail size={12} />
                {job.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-claude-muted">
          <span>{timeAgo(job.createdAt)}</span>
          {expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-claude-border px-5 py-4">
          {job.companyInfo ? (
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg bg-claude-bg p-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-claude-text">
                <Building2 size={14} className="text-claude-accent" />
                {job.companyInfo.name}
              </span>
              {job.companyInfo.type && (
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-claude-muted ring-1 ring-claude-border">
                  {job.companyInfo.type}
                </span>
              )}
              {job.companyInfo.location && (
                <span className="flex items-center gap-1 text-claude-muted">
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
          ) : (
            <div className="mb-4 rounded-lg bg-claude-bg p-3 text-sm text-claude-muted">
              Company info not resolved for this job's email domain.
            </div>
          )}

          {job.description && (
            <div className="text-sm leading-relaxed text-claude-muted">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-claude-muted/70">
                Description
              </div>
              <div
                className={cn(
                  "whitespace-pre-wrap",
                  !expanded && "line-clamp-4"
                )}
              >
                {job.description}
              </div>
            </div>
          )}
          {job.fileName && (
            <div className="mt-3 text-xs text-claude-muted">
              Source: {job.fileName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
