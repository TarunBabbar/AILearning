"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Briefcase,
  FileText,
  Sparkles,
  Inbox,
  Database,
} from "lucide-react";
import { JobGridSkeleton } from "@/components/Skeleton";
import JobCard from "@/components/JobCard";
import JobFilters, { type JobFilterValue } from "@/components/JobFilters";
import JobDetailModal from "@/components/JobDetailModal";
import ListPagination from "@/components/ListPagination";
import PageChrome from "@/components/PageChrome";
import { useListSWR } from "@/lib/use-list-swr";
import type {
  JobsResponse,
  Job,
  JobFiltersOptions,
} from "@/lib/types";

const PAGE_SIZE = 40;

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState("newest");
  const [today, setToday] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [filterOptions, setFilterOptions] = useState<JobFiltersOptions>({
    companies: [],
    locations: [],
  });

  // Any filter / sort change → back to page 1
  useEffect(() => {
    setPage(1);
  }, [search, company, location, sort, today]);

  // New page → scroll list back to top
  useEffect(() => {
    document.getElementById("page-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const jobsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (company) params.set("company", company);
    if (location) params.set("location", location);
    if (sort) params.set("sort", sort);
    if (today) params.set("today", "1");
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return `/api/jobs?${params.toString()}`;
  }, [search, company, location, sort, today, page]);

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

  // Load dropdown options once on mount.
  useEffect(() => {
    fetch("/api/jobs/filters", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setFilterOptions(d);
      })
      .catch(() => {});
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

  const filterValue: JobFilterValue = { search, company, location, sort, today };

  const handleFilters = useCallback((next: JobFilterValue) => {
    setSearch(next.search);
    setCompany(next.company);
    setLocation(next.location);
    setSort(next.sort);
    setToday(next.today === true);
  }, []);

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
    <PageChrome
      hideHeader={!!selectedJob}
      header={
        <div className="flex flex-col gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-claude-text">
              QA Jobs
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
              {data?.todayCount != null && data.todayCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-claude-accent-soft px-2 py-1 font-semibold text-claude-accent">
                  <Sparkles size={12} />
                  {data.todayCount.toLocaleString()} new jobs today
                </span>
              )}
            </div>
          </div>

          <JobFilters
            value={filterValue}
            onChange={handleFilters}
            companyOptions={filterOptions.companies}
            locationOptions={filterOptions.locations}
          />
        </div>
      }
    >
      {/* Service status banner */}
      {apiKeyConfigured === false && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-claude-border bg-white px-3 py-2 text-xs shadow-sm">
          <Sparkles size={14} className="shrink-0 text-claude-accent" />
          <span className="flex-1 text-claude-muted">
            Some features may be temporarily unavailable. Please try again later.
          </span>
        </div>
      )}

      {/* Jobs grid */}
      {loading ? (
        <JobGridSkeleton />
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
                Jobs are temporarily unavailable
              </p>
              <p className="mt-2 text-sm text-claude-muted">
                We couldn&apos;t load the job list right now. Please try again in a
                moment.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
                <Inbox size={24} />
              </div>
              <p className="text-base font-semibold text-claude-text">
                {search || company || location
                  ? "No jobs match these filters"
                  : "No jobs yet"}
              </p>
              <p className="mt-2 text-sm text-claude-muted">
                {search || company || location
                  ? "Try clearing filters, or upload more job PDFs."
                  : "Jobs will appear here once uploaded. Use the left navigation to upload job PDFs."}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.jobs.map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => openJob(job)} />
            ))}
          </div>

          <ListPagination
            page={data.page}
            pageCount={pageCount}
            total={data.total}
            loading={isLoading}
            onPageChange={setPage}
          />
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
    </PageChrome>
  );
}
