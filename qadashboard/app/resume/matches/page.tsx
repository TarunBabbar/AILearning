"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { runScoreWave, type ScoreMatchJob, type ScoreProgress } from "@/lib/score-wave";
import { ScoreLivePanel } from "@/components/ui/ScoreLivePanel";
import PageChrome from "@/components/ui/PageChrome";
import JobDetailModal from "@/components/ui/JobDetailModal";
import { JobAvatar } from "@/components/ui/JobAvatar";
import ListPagination from "@/components/ui/ListPagination";
import ShowingRange from "@/components/ui/ShowingRange";
import { JobCardSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { invalidateListCaches, useListSWR } from "@/lib/use-list-swr";

type Job = {
  id: string;
  title: string;
  company: string;
  email?: string | null;
  location?: string | null;
  experience?: string | null;
  description?: string | null;
  status: string;
  score?: number | null;
  strengths?: string | null;
  gaps?: string | null;
  emailSent?: boolean;
};

type JobsResponse = {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  strongCount?: number;
  scoredCount?: number;
};

const PIPELINE = ["all", "emailed", "waiting", "interviewing", "offered", "ignored"] as const;
const PAGE_SIZE = 40;

function scoreTone(score?: number | null) {
  if (score == null) return "text-text-muted bg-bg-surface";
  if (score >= 80) return "text-[#3d7a3d] bg-[#e3efe3]";
  if (score >= 60) return "text-[#9a7b2d] bg-[#fdf0d5]";
  return "text-[#a04040] bg-[#f5e5e5]";
}

function statusTone(status: string) {
  return {
    new: "bg-blue-50 text-blue-700",
    emailed: "bg-purple-50 text-purple-700",
    waiting: "bg-amber-50 text-amber-700",
    interviewing: "bg-green-50 text-green-700",
    offered: "bg-emerald-50 text-emerald-700",
    ignored: "bg-bg-surface text-text-muted",
  }[status] || "bg-bg-surface text-text-muted";
}

/** Keep only the concise years part of an experience string
 * ("7 – 10 Yrs 5+ Yrs of Automation Testing..." → "7 – 10 Yrs"). */
function experienceLabel(exp?: string | null): string {
  if (!exp) return "";
  const m = exp.match(/(\d+\s*[-–]\s*\d+\s*Yrs?|\d+\+?\s*Yrs?|\d+\s*Years?)/i);
  return m ? m[1] : exp.slice(0, 24);
}

export default function JobMatchesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof PIPELINE)[number]>("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [progress, setProgress] = useState<ScoreProgress | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const key = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), minScore: "60" });
    if (search) params.set("search", search);
    if (filter === "all") params.set("view", "scored");
    else {
      params.set("localStatus", filter);
      params.set("scoredOnly", "1");
    }
    return `/api/jobs?${params}`;
  }, [filter, page, search]);

  const { data, error, isLoading, mutate } = useListSWR<JobsResponse>(key);
  const jobs = data?.jobs || [];

  const openDetail = useCallback(async (job: Job) => {
    setSelectedJob(job);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
      const body = await res.json();
      if (body.job) setSelectedJob(body.job);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const insertLiveMatch = useCallback((match: ScoreMatchJob) => {
    mutate((current) => {
      if (!current) return current;
      const exists = current.jobs.some((job) => job.id === match.id);
      if (exists) {
        return { ...current, jobs: current.jobs.map((job) => job.id === match.id ? { ...job, ...match } : job) };
      }
      return { ...current, jobs: [{ ...match, status: match.status || "new" }, ...current.jobs] };
    }, { revalidate: false });
  }, [mutate]);

  const updateStatus = async (status: string) => {
    if (!selectedJob) return;
    const previous = selectedJob;
    setSelectedJob({ ...previous, status });
    const res = await fetch(`/api/jobs/${selectedJob.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setSelectedJob(previous);
    await invalidateListCaches();
    await mutate();
  };

  const scoreWave = async () => {
    setScoring(true);
    setMessage("");
    setProgress({ percent: 1, completed: 0, attempted: 0, scored: 0, strongMatches: 0, message: "Starting…", ticker: "Scoring jobs across free models…" });
    try {
      const result = await runScoreWave({ scope: "unscored", search, onProgress: setProgress, onMatch: insertLiveMatch });
      setMessage(result.ok ? result.message : result.error || "Scoring failed");
      await invalidateListCaches();
      await mutate();
      if (result.strongMatches > 0) router.refresh();
    } catch {
      setMessage("Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  return (
    <PageChrome
      maxWidthClass="max-w-7xl"
      hideHeader={!!selectedJob}
      header={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-text-primary">Job Matches</h1>
            <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">{data?.total || 0} matches</span>
            <span className="rounded-md bg-[#e3efe3] px-2 py-1 text-xs font-medium text-[#3d7a3d]">{data?.scoredCount || 0} scored</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search title, company…" className="w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-7 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15" />
              {searchInput && <button onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"><X size={13} /></button>}
            </div>
            <Button size="sm" onClick={scoreWave} disabled={scoring}>
              {scoring ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {scoring ? "Scoring…" : "Score wave"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 pb-8">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-bg-surface p-1">
          {PIPELINE.map((item) => <button key={item} onClick={() => { setFilter(item); setPage(1); }} className={cn("rounded-md px-3 py-1.5 text-xs capitalize transition-colors whitespace-nowrap", filter === item ? "bg-white font-medium text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}>{item}</button>)}
        </div>
        {scoring && progress && <ScoreLivePanel progress={progress} />}
        {message && !scoring && <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-secondary">{message}</div>}
        {error ? <div className="rounded-xl border border-border bg-white p-12 text-center text-sm text-red-600">Failed to load matches.</div> : isLoading && !data ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <JobCardSkeleton key={i} />)}</div> : jobs.length === 0 ? <div className="rounded-xl border border-border bg-white p-16 text-center"><Sparkles size={24} className="mx-auto mb-3 text-amber-500" /><p className="font-medium text-text-primary">No strong matches yet</p><p className="mt-1 text-sm text-text-muted">Upload a resume and run a score wave to find roles.</p></div> : <>
          <div className="flex items-center justify-between px-1"><p className="text-xs text-text-muted">Strong matches ranked by fit</p><ShowingRange page={page} pageSize={PAGE_SIZE} itemCount={jobs.length} total={data?.total || 0} /></div>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {jobs.map((job) => <button key={job.id} onClick={() => openDetail(job)} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white text-left shadow-sm transition-shadow hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-1 flex-col p-3.5">
                <div className="flex items-start gap-2.5"><JobAvatar name={job.company} /><div className="min-w-0 flex-1"><h3 className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug text-text-primary">{job.title}</h3><p className="mt-0.5 truncate text-xs font-medium text-text-secondary">{job.company}</p></div><span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold", scoreTone(job.score))}>{job.score}%</span></div>
                <div className="mt-2.5 flex min-h-[22px] flex-wrap items-center gap-1">{job.location && <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">{job.location}</span>}{experienceLabel(job.experience) && <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">{experienceLabel(job.experience)}</span>}</div>
                <div className="mt-auto flex items-center justify-between pt-2.5"><span className={cn("rounded-full px-2 py-0.5 text-[10px] capitalize", statusTone(job.status))}>{job.status}</span><ChevronRight size={14} className="text-text-muted transition-transform group-hover:translate-x-0.5" /></div>
              </div>
            </button>)}
          </div>
          <ListPagination page={page} pageCount={data?.pageCount || 1} total={data?.total} loading={isLoading} onPageChange={setPage} />
        </>}
      </div>
      <JobDetailModal open={!!selectedJob} onClose={() => setSelectedJob(null)} title={selectedJob?.title || ""} company={selectedJob?.company} subtitle={<>{selectedJob?.company}{selectedJob?.location ? ` · ${selectedJob.location}` : ""}</>} score={selectedJob?.score} sections={[...(detailLoading ? [{ label: "Loading", body: <p className="text-sm text-text-muted">Loading full job details…</p> }] : []), ...(selectedJob?.strengths ? [{ label: "Strengths", body: <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{selectedJob.strengths}</p> }] : []), ...(selectedJob?.gaps ? [{ label: "Gaps", body: <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{selectedJob.gaps}</p> }] : []), ...(selectedJob?.description ? [{ label: "Description", body: <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{selectedJob.description}</p> }] : [])]} />
    </PageChrome>
  );
}
