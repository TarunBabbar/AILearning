"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search, X } from "lucide-react";
import { useListSWR } from "@/lib/use-list-swr";
import PageChrome from "@/components/ui/PageChrome";
import { JobAvatar } from "@/components/ui/JobAvatar";
import ListPagination from "@/components/ui/ListPagination";
import ShowingRange from "@/components/ui/ShowingRange";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string; domain: string; location?: string | null; website?: string | null; jobCount: number; maxScore?: number | null };
type CompaniesResponse = { companies: Company[]; total: number; page: number; pageSize: number; pageCount: number };
const PAGE_SIZE = 40;

/** Show a city, not a country: "Pune, India" → "Pune"; "India" → "—". */
function cityLabel(location?: string | null): string {
  if (!location) return "—";
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts.find((p) => !/^(india|remote|pan-india|all india)$/i.test(p));
  return city || parts[0] || "—";
}

export default function CompaniesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [searchInput]);
  const key = useMemo(() => `/api/companies?page=${page}&pageSize=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ""}`, [page, search]);
  const { data, error, isLoading } = useListSWR<CompaniesResponse>(key);
  const companies = data?.companies || [];

  return <PageChrome maxWidthClass="max-w-6xl" header={<div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h1 className="text-lg font-semibold tracking-tight text-text-primary">Companies</h1><span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">{data?.total || 0} companies</span></div><div className="relative w-full sm:w-64"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search companies…" className="w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-7 text-sm outline-none focus:border-amber-500" />{searchInput && <button onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"><X size={13} /></button>}</div></div>}>
    <div className="space-y-3 pb-8"><p className="text-sm text-text-muted">Companies from your scored job matches, ranked by best score.</p>{error ? <div className="rounded-xl border border-border bg-white p-12 text-center text-sm text-red-600">Failed to load companies.</div> : isLoading && !data ? <TableSkeleton rows={8} /> : companies.length === 0 ? <div className="rounded-xl border border-border bg-white p-16 text-center"><Building2 size={28} className="mx-auto mb-3 text-amber-500" /><p className="font-medium text-text-primary">No companies found</p><p className="mt-1 text-sm text-text-muted">Score more jobs to build your company list.</p></div> : <><div className="flex items-center justify-end"><ShowingRange page={page} pageSize={PAGE_SIZE} itemCount={companies.length} total={data?.total || 0} /></div><div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"><div className="hidden grid-cols-[minmax(220px,1.5fr)_100px_120px_1fr] gap-3 border-b border-border bg-bg-surface/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted md:grid"><span>Company</span><span>Jobs</span><span>Best score</span><span>Location</span></div>{companies.map((company) => <div key={company.id} className="group grid gap-3 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-bg-page md:grid-cols-[minmax(220px,1.5fr)_100px_120px_1fr] md:items-center"><div className="flex min-w-0 items-center gap-3"><JobAvatar name={company.name} /><div className="min-w-0"><p className="truncate font-medium text-text-primary">{company.name}</p><p className="truncate text-xs text-text-muted">{company.domain}</p></div></div><span className="text-sm text-text-secondary">{company.jobCount}</span><span className={cn("w-fit rounded-md px-2 py-0.5 text-xs font-bold", company.maxScore != null && company.maxScore >= 60 ? "bg-[#e3efe3] text-[#3d7a3d]" : "bg-bg-surface text-text-muted")}>{company.maxScore ?? "—"}</span><span className="truncate text-sm text-text-muted">{cityLabel(company.location)}</span></div>)}</div><ListPagination page={page} pageCount={data?.pageCount || 1} total={data?.total} loading={isLoading} onPageChange={setPage} /></>}</div>
  </PageChrome>;
}
