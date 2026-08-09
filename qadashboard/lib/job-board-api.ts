import { getConfig } from "./config";
import {
  fetchRemoteCompaniesDb,
  fetchRemoteJobDb,
  fetchRemoteJobsDb,
} from "./job-board-db";

export type RemoteJob = {
  id: string;
  title: string;
  company: string;
  email?: string | null;
  location?: string | null;
  experience?: string | null;
  description?: string | null;
  fileName?: string | null;
  jobDate?: string | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
  companyId?: string | null;
  companyInfo?: RemoteCompany | null;
};

export type RemoteCompany = {
  id: string;
  domain: string;
  name: string;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  website?: string | null;
  source?: string | null;
  _count?: { jobs: number };
};

export type JobsListResponse = {
  jobs: RemoteJob[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  companyCount?: number;
  sourceCount?: number;
};

type CacheEntry = { at: number; data: unknown };
const memCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

function cachedGet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  fresh = false
): Promise<T> {
  if (!fresh) {
    const hit = memCache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      return Promise.resolve(hit.data as T);
    }
  }
  return loader().then((data) => {
    memCache.set(key, { at: Date.now(), data });
    return data;
  });
}

function baseUrl(): string {
  const cfg = getConfig();
  const url = cfg.jobDetailsApiBase;
  if (!url) {
    throw new Error(
      "JOB_DETAILS_API_BASE is not set. Add it to your .env (no trailing slash)."
    );
  }
  return url.replace(/\/$/, "");
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    // Allow Next/fetch HTTP cache when callers want it; default no-store for freshness
    cache: "no-store",
    // 10s safety net — the remote board is usually fast; never hang a request
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Job board ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRemoteJobs(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  company?: string;
  status?: string;
  /** Skip memory cache (e.g. scoring waves). */
  fresh?: boolean;
} = {}): Promise<JobsListResponse> {
  // Direct DB read when JOB_BOARD_DATABASE_URL is set — no HTTP hop.
  if (getConfig().jobBoardDatabaseUrl) {
    const { page, pageSize, search, sort, company, status } = opts;
    return cachedGet(
      `db:jobs:${page}:${pageSize}:${search || ""}:${sort || ""}:${company || ""}:${status || ""}`,
      DEFAULT_TTL_MS,
      () => fetchRemoteJobsDb({ page, pageSize, search, sort, company, status }),
      opts.fresh
    );
  }

  const params = new URLSearchParams();
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 40));
  if (opts.search) params.set("search", opts.search);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.company) params.set("company", opts.company);
  if (opts.status) params.set("status", opts.status);
  const path = `/api/jobs?${params}`;
  if (opts.fresh) return getJson<JobsListResponse>(path);
  return cachedGet(path, DEFAULT_TTL_MS, () => getJson<JobsListResponse>(path));
}

export async function fetchRemoteJob(id: string): Promise<RemoteJob> {
  if (getConfig().jobBoardDatabaseUrl) {
    return cachedGet(`db:job:${id}`, DEFAULT_TTL_MS, () => fetchRemoteJobDb(id));
  }
  const path = `/api/jobs/${encodeURIComponent(id)}`;
  return cachedGet(path, DEFAULT_TTL_MS, async () => {
    const data = await getJson<{ job: RemoteJob }>(path);
    return data.job;
  });
}

export async function fetchRemoteCompanies(): Promise<RemoteCompany[]> {
  if (getConfig().jobBoardDatabaseUrl) {
    return cachedGet("db:companies", DEFAULT_TTL_MS, () => fetchRemoteCompaniesDb());
  }
  return cachedGet("companies", DEFAULT_TTL_MS, async () => {
    const data = await getJson<{ companies: RemoteCompany[] }>("/api/companies");
    return data.companies || [];
  });
}

/** Fetch several pages of remote jobs (capped) for scoring waves. */
export async function fetchRemoteJobsForScoring(opts: {
  maxJobs: number;
  search?: string;
  pageSize?: number;
}): Promise<RemoteJob[]> {
  const pageSize = Math.min(100, opts.pageSize ?? 40);
  const out: RemoteJob[] = [];
  let page = 1;
  let pageCount = 1;

  while (out.length < opts.maxJobs && page <= pageCount) {
    const batch = await fetchRemoteJobs({
      page,
      pageSize,
      search: opts.search,
      sort: "newest",
      fresh: true,
    });
    pageCount = batch.pageCount || 1;
    out.push(...batch.jobs);
    if (batch.jobs.length === 0) break;
    page++;
  }

  return out.slice(0, opts.maxJobs);
}

/**
 * Batch-fetch full remote jobs by id (replaces the N+1 enrichment loop in the
 * score route). Each id fetch is individually memcached; failures fall back to
 * the slim list entry so a single bad job never fails the whole batch.
 */
export async function fetchRemoteJobByIds(
  jobs: RemoteJob[]
): Promise<RemoteJob[]> {
  const need = jobs.filter((j) => !j.description || j.description.length <= 180);
  if (need.length === 0) return jobs;
  const idToJob = new Map(jobs.map((j) => [j.id, j]));

  const results = await Promise.allSettled(need.map((j) => fetchRemoteJob(j.id)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value?.description) {
      idToJob.set(need[i].id, { ...idToJob.get(need[i].id)!, ...r.value });
    }
  });

  return jobs.map((j) => idToJob.get(j.id) ?? j);
}
