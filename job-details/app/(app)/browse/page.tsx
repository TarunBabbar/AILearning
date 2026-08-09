"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Search,
  ChevronDown,
  Mail,
  Briefcase,
  Clock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupListSkeleton } from "@/components/Skeleton";
import ListPagination from "@/components/ListPagination";
import ShowingRange from "@/components/ShowingRange";
import PageChrome from "@/components/PageChrome";
import { useListSWR } from "@/lib/use-list-swr";
import type { Job } from "@/lib/types";

const PAGE_SIZE = 40;

type CompanyGroup = {
  company: string;
  count: number;
  jobs: Job[];
};

type LocationJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  experience: string | null;
  email: string | null;
  jobDate: string | null;
  description: string | null;
};

type LocationGroup = {
  location: string;
  jobs: LocationJob[];
  count: number;
};

type View = "company" | "location";

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

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type CompaniesResponse = {
  totalCompanies: number;
  totalJobs: number;
  page: number;
  pageCount: number;
  companies: CompanyGroup[];
};

type LocationsResponse = {
  totalLocations: number;
  totalJobs: number;
  page: number;
  pageCount: number;
  locations: LocationGroup[];
};

export default function BrowsePage() {
  const [view, setView] = useState<View>("company");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [debounced, view]);

  useEffect(() => {
    setExpanded(null);
    document.getElementById("page-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const listKey = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (view === "company") {
      params.set("sort", "name");
      return `/api/companies/jobs?${params.toString()}`;
    }
    return `/api/locations?${params.toString()}`;
  }, [debounced, page, view]);

  const { data, error: swrError, isLoading } = useListSWR<
    CompaniesResponse | LocationsResponse
  >(listKey);

  const companies =
    view === "company" && data && "companies" in data ? data.companies : [];
  const locations =
    view === "location" && data && "locations" in data ? data.locations : [];
  const totals = data
    ? view === "company" && "totalCompanies" in data
      ? {
          groups: data.totalCompanies,
          jobs: data.totalJobs,
        }
      : "totalLocations" in data
        ? {
            groups: data.totalLocations,
            jobs: data.totalJobs,
          }
        : null
    : null;
  const pageCount = data?.pageCount ?? 1;
  const currentPage = data?.page ?? page;
  const loading = isLoading && !data;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "Failed to load"
    : null;

  const groups = view === "company" ? companies : locations;
  const groupLabel = view === "company" ? "companies" : "locations";

  return (
    <PageChrome
      header={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-claude-text">
              Browse Jobs
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-claude-muted">
              {view === "company" ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#e6edf5] px-1.5 py-0.5 font-medium text-[#4a6d8c]">
                    <Building2 size={11} />
                    {(totals?.groups ?? 0).toLocaleString()} companies
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-claude-accent-soft px-1.5 py-0.5 font-medium text-claude-accent">
                    <Briefcase size={11} />
                    {(totals?.jobs ?? 0).toLocaleString()} jobs
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#e3efe3] px-1.5 py-0.5 font-medium text-[#3d7a3d]">
                    <MapPin size={11} />
                    {(totals?.groups ?? 0).toLocaleString()} locations
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-claude-accent-soft px-1.5 py-0.5 font-medium text-claude-accent">
                    <Briefcase size={11} />
                    {(totals?.jobs ?? 0).toLocaleString()} jobs
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5">
            <div className="inline-flex shrink-0 rounded-md bg-claude-bg p-0.5">
              <button
                type="button"
                onClick={() => setView("company")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                  view === "company"
                    ? "bg-white text-claude-text shadow-sm"
                    : "text-claude-muted hover:text-claude-text"
                )}
              >
                <Building2 size={12} />
                Company
              </button>
              <button
                type="button"
                onClick={() => setView("location")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                  view === "location"
                    ? "bg-white text-claude-text shadow-sm"
                    : "text-claude-muted hover:text-claude-text"
                )}
              >
                <MapPin size={12} />
                Location
              </button>
            </div>

            <div className="relative w-[11rem] sm:w-[14rem]">
              <Search
                size={13}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-claude-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Company or location…"
                className="w-full rounded-md border border-claude-border bg-white py-1 pl-7 pr-6 text-xs outline-none transition-colors placeholder:text-claude-muted focus:border-claude-accent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-claude-muted hover:text-claude-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      {/* Compact cards — same chrome as All Jobs JobCard */}
      {loading ? (
        <GroupListSkeleton />
      ) : error ? (
        <p className="py-6 text-center text-sm text-claude-muted">{error}</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-claude-border bg-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-claude-text">
            No {groupLabel} found
          </p>
          <p className="mt-0.5 text-xs text-claude-muted">
            Try a different filter, or upload more job PDFs.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-end px-0.5">
            <ShowingRange
              page={currentPage}
              pageSize={PAGE_SIZE}
              itemCount={groups.length}
              total={totals?.groups ?? 0}
            />
          </div>
          {view === "company"
            ? companies.map((group) => {
                const color = avatarColor(group.company);
                const open = expanded === group.company;
                return (
                  <div
                    key={group.company}
                    className={cn(
                      "overflow-hidden rounded-lg border bg-white shadow-sm",
                      open
                        ? "border-claude-accent/35"
                        : "border-claude-border"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(open ? null : group.company)
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
                          color
                        )}
                      >
                        {initials(group.company)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[13px] font-semibold text-claude-text">
                          {group.company}
                        </h2>
                      </div>
                      <span className="rounded bg-claude-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-claude-accent">
                        {group.count}
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "shrink-0 text-claude-muted transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-claude-border">
                        {group.jobs.map((job) => (
                          <div
                            key={job.id}
                            className="border-b border-claude-border/70 px-3.5 py-2 last:border-b-0"
                          >
                            <div className="text-[13px] font-medium text-claude-text">
                              {job.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-claude-muted">
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} />
                                  {job.location}
                                </span>
                              )}
                              {job.experience && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {job.experience}
                                </span>
                              )}
                              {job.email && (
                                <span className="flex items-center gap-1">
                                  <Mail size={10} />
                                  {job.email}
                                </span>
                              )}
                            </div>
                            {job.description && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-claude-muted">
                                {job.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            : locations.map((group) => {
                const open = expanded === group.location;
                return (
                  <div
                    key={group.location}
                    className={cn(
                      "overflow-hidden rounded-lg border bg-white shadow-sm",
                      open
                        ? "border-claude-accent/35"
                        : "border-claude-border"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(open ? null : group.location)
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-claude-accent-soft text-claude-accent">
                        <MapPin size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[13px] font-semibold text-claude-text">
                          {group.location}
                        </h2>
                      </div>
                      <span className="rounded bg-claude-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-claude-accent">
                        {group.count}
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          "shrink-0 text-claude-muted transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-claude-border">
                        {group.jobs.map((job) => (
                          <div
                            key={job.id}
                            className="border-b border-claude-border/70 px-3.5 py-2 last:border-b-0"
                          >
                            <div className="text-[13px] font-medium text-claude-text">
                              {job.title}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-claude-muted">
                              <span className="flex items-center gap-1">
                                <Building2 size={10} />
                                {job.company}
                              </span>
                              {job.email && (
                                <span className="flex items-center gap-1">
                                  <Mail size={10} />
                                  {job.email}
                                </span>
                              )}
                              {job.experience && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {job.experience}
                                </span>
                              )}
                              {job.jobDate && (
                                <span>{formatShortDate(job.jobDate)}</span>
                              )}
                            </div>
                            {job.description && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-claude-muted">
                                {job.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <ListPagination
          page={currentPage}
          pageCount={pageCount}
          total={totals?.groups}
          loading={isLoading}
          onPageChange={setPage}
        />
      )}
    </PageChrome>
  );
}
