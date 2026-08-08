"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Search,
  Loader2,
  ChevronDown,
  MapPin,
  Mail,
  Briefcase,
  Clock,
  X,
  ArrowUpDown,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/lib/types";

type CompanyGroup = {
  company: string;
  count: number;
  jobs: Job[];
};

type Response = {
  totalCompanies: number;
  totalJobs: number;
  companies: CompanyGroup[];
};

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

export default function CompaniesPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("jobs");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("search", debounced);
      params.set("sort", sort);
      const res = await fetch(`/api/companies/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [debounced, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-claude-text">
            Jobs by Company
          </h1>
          <p className="mt-1.5 text-sm text-claude-muted">
            All tracked jobs grouped under each company. Expand a company to
            see its openings.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-claude-muted sm:flex">
          <span className="inline-block h-2 w-2 rounded-full bg-claude-accent" />
          {data ? `${data.totalCompanies} companies · ${data.totalJobs} jobs` : "…"}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-claude-border bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, job title, location, email…"
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
            className="rounded-lg border border-claude-border bg-white py-2 pl-8 pr-3 text-sm text-claude-text outline-none focus:border-claude-accent"
          >
            <option value="jobs">Most jobs first</option>
            <option value="name">Company A–Z</option>
          </select>
        </div>
      </div>

      {/* Companies list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-claude-muted">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading companies…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-claude-border bg-white p-8 text-center text-sm text-claude-muted shadow-sm">
          {error}
        </div>
      ) : !data || data.companies.length === 0 ? (
        <div className="rounded-xl border border-claude-border bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
            <Inbox size={24} />
          </div>
          <p className="text-base font-semibold text-claude-text">No companies found</p>
          <p className="mt-2 text-sm text-claude-muted">
            Upload job PDFs with company emails to see jobs grouped here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.companies.map((group) => {
            const color = avatarColor(group.company);
            const open = expanded === group.company;
            return (
              <div
                key={group.company}
                className={cn(
                  "overflow-hidden rounded-xl border bg-white shadow-sm transition-all",
                  open ? "border-claude-accent/40 ring-2 ring-claude-accent/10" : "border-claude-border"
                )}
              >
                {/* Company header */}
                <button
                  onClick={() => setExpanded(open ? null : group.company)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                      color
                    )}
                  >
                    {initials(group.company)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[15px] font-semibold text-claude-text">
                        {group.company}
                      </h2>
                      <span className="rounded-full bg-claude-accent-soft px-2 py-0.5 text-[11px] font-medium text-claude-accent-strong">
                        {group.count} job{group.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-claude-muted">
                      <Building2 size={12} className="shrink-0 text-claude-accent/70" />
                      {group.jobs[0]?.email?.split("@")[1] || "—"}
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn("shrink-0 text-claude-muted transition-transform", open && "rotate-180")}
                  />
                </button>

                {/* Jobs */}
                {open && (
                  <div className="border-t border-claude-border bg-claude-bg/40">
                    {group.jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-start gap-3 border-b border-claude-border px-5 py-3 last:border-b-0"
                      >
                        <Briefcase size={14} className="mt-0.5 shrink-0 text-claude-muted" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-claude-text">
                            {job.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-claude-muted">
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} />
                                {job.location}
                              </span>
                            )}
                            {job.experience && (
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {job.experience}
                              </span>
                            )}
                            {job.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={11} />
                                {job.email}
                              </span>
                            )}
                          </div>
                          {job.description && (
                            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-claude-muted">
                              {job.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
