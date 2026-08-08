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
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupListSkeleton } from "@/components/Skeleton";
import { useListSWR } from "@/lib/use-list-swr";
import type { Job } from "@/lib/types";

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
  companies: CompanyGroup[];
};

type LocationsResponse = {
  totalLocations: number;
  totalJobs: number;
  locations: LocationGroup[];
};

export default function BrowsePage() {
  const [view, setView] = useState<View>("company");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { companiesKey, locationsKey } = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    params.set("sort", "name");
    const companiesKey = `/api/companies/jobs?${params.toString()}`;
    const locParams = new URLSearchParams();
    if (debounced) locParams.set("search", debounced);
    const locQs = locParams.toString();
    return {
      companiesKey,
      locationsKey: locQs ? `/api/locations?${locQs}` : "/api/locations",
    };
  }, [debounced]);

  const {
    data: cData,
    error: cError,
    isLoading: cLoading,
  } = useListSWR<CompaniesResponse>(companiesKey);
  const {
    data: lData,
    error: lError,
    isLoading: lLoading,
  } = useListSWR<LocationsResponse>(locationsKey);

  const companies = cData?.companies ?? [];
  const locations = lData?.locations ?? [];
  const totals =
    cData || lData
      ? {
          companies: cData?.totalCompanies ?? 0,
          companyJobs: cData?.totalJobs ?? 0,
          locations: lData?.totalLocations ?? 0,
          locationJobs: lData?.totalJobs ?? 0,
        }
      : null;
  const loading = (cLoading && !cData) || (lLoading && !lData);
  const error =
    cError || lError
      ? cError instanceof Error
        ? cError.message
        : lError instanceof Error
          ? lError.message
          : "Failed to load"
      : null;

  const groups = view === "company" ? companies : locations;
  const groupLabel = view === "company" ? "companies" : "locations";

  const headerStats = useMemo(() => {
    if (!totals) return "";
    return view === "company"
      ? `${totals.companies} companies · ${totals.companyJobs} jobs`
      : `${totals.locations} locations · ${totals.locationJobs} jobs`;
  }, [totals, view]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-claude-text">
            Browse Jobs
          </h1>
          <p className="mt-1.5 text-sm text-claude-muted">
            Group openings by company or location, and filter by either.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-claude-muted sm:flex">
          <span className="inline-block h-2 w-2 rounded-full bg-claude-accent" />
          {totals ? headerStats : "…"}
        </div>
      </div>

      {/* Filters: toggle + one search */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-claude-border bg-white p-4 shadow-sm">
        {/* Group by toggle */}
        <div className="flex items-center rounded-lg bg-claude-bg p-1">
          <button
            onClick={() => {
              setView("company");
              setExpanded(null);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "company"
                ? "bg-white text-claude-text shadow-sm ring-1 ring-claude-border"
                : "text-claude-muted hover:text-claude-text"
            )}
          >
            <Building2 size={14} />
            By Company
          </button>
          <button
            onClick={() => {
              setView("location");
              setExpanded(null);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "location"
                ? "bg-white text-claude-text shadow-sm ring-1 ring-claude-border"
                : "text-claude-muted hover:text-claude-text"
            )}
          >
            <MapPin size={14} />
            By Location
          </button>
        </div>

        {/* One search — filters by company OR location in both views */}
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a company or location…"
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
      </div>

      {/* List */}
      {loading ? (
        <GroupListSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-claude-border bg-white p-8 text-center text-sm text-claude-muted shadow-sm">
          {error}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-claude-border bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
            <Inbox size={24} />
          </div>
          <p className="text-base font-semibold text-claude-text">
            No {groupLabel} found
          </p>
          <p className="mt-2 text-sm text-claude-muted">
            Try a different filter, or upload more job PDFs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {view === "company"
            ? companies.map((group) => {
                const color = avatarColor(group.company);
                const open = expanded === group.company;
                return (
                  <div
                    key={group.company}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white shadow-sm transition-all",
                      open
                        ? "border-claude-accent/40 ring-2 ring-claude-accent/10"
                        : "border-claude-border"
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
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "shrink-0 text-claude-muted transition-transform",
                          open && "rotate-180"
                        )}
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
                            <Briefcase
                              size={14}
                              className="mt-0.5 shrink-0 text-claude-muted"
                            />
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
                                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-claude-muted">
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
              })
            : locations.map((group) => {
                const open = expanded === group.location;
                return (
                  <div
                    key={group.location}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white shadow-sm transition-all",
                      open
                        ? "border-claude-accent/40 ring-2 ring-claude-accent/10"
                        : "border-claude-border"
                    )}
                  >
                    {/* Location header */}
                    <button
                      onClick={() => setExpanded(open ? null : group.location)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-claude-accent-soft text-claude-accent">
                        <MapPin size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-[15px] font-semibold text-claude-text">
                            {group.location}
                          </h2>
                          <span className="rounded-full bg-claude-accent-soft px-2 py-0.5 text-[11px] font-medium text-claude-accent-strong">
                            {group.count} job{group.count === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "shrink-0 text-claude-muted transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </button>

                    {/* Jobs — same detail style as the company view */}
                    {open && (
                      <div className="border-t border-claude-border bg-claude-bg/40">
                        {group.jobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-start gap-3 border-b border-claude-border px-5 py-3 last:border-b-0"
                          >
                            <Briefcase
                              size={14}
                              className="mt-0.5 shrink-0 text-claude-muted"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-claude-text">
                                {job.title}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-claude-muted">
                                <span className="flex items-center gap-1">
                                  <Building2 size={11} />
                                  {job.company}
                                </span>
                                {job.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail size={11} />
                                    {job.email}
                                  </span>
                                )}
                                {job.experience && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} />
                                    {job.experience}
                                  </span>
                                )}
                                {job.jobDate && (
                                  <span className="flex items-center gap-1">
                                    {formatShortDate(job.jobDate)}
                                  </span>
                                )}
                              </div>
                              {job.description && (
                                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-claude-muted">
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
