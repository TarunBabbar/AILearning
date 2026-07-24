import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { CompanyEntry } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { RefreshCw, Search, Building2, Globe, MapPin, User, ChevronDown, Square, CheckSquare, AlertCircle } from "lucide-react";

const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "rediffmail.com", "ymail.com", "live.com", "google.com"
]);

function getDomain(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : null;
}

export default function CompanyInfo() {
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Record<string, CompanyEntry>>({});
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>("domain");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [jd, ci] = await Promise.all([
        api.getJobs("?exclude_ignored=false"),
        api.getCompanyInfo()
      ]);
      setAllJobs(jd.jobs);
      setCompanies(ci.companies);
    } catch {}
    setLoading(false);
  }

  // Build unique domains from jobs
  const domainMap = new Map<string, string[]>();
  for (const j of allJobs) {
    const d = getDomain(j.email);
    if (!d || GENERIC_DOMAINS.has(d)) continue;
    const existing = domainMap.get(d) || [];
    if (!existing.includes(j.email)) existing.push(j.email);
    domainMap.set(d, existing);
  }

  // Merge cached companies into the domain list
  const allEntries = [...domainMap.entries()].map(([domain, emails]) => {
    const cached = companies[domain];
    return {
      domain,
      emails,
      company: cached?.company || "—",
      personName: cached?.personName || "—",
      location: cached?.location || "—",
      type: cached?.type || "—",
      updatedAt: cached?.updatedAt || null,
      cached: !!cached
    };
  });

  // Add orphaned cached domains (no current jobs for them)
  for (const [domain, info] of Object.entries(companies)) {
    if (!domainMap.has(domain)) {
      allEntries.push({
        domain,
        emails: [],
        company: info.company || "—",
        personName: info.personName || "—",
        location: info.location || "—",
        type: info.type || "—",
        updatedAt: info.updatedAt || null,
        cached: true
      });
    }
  }

  const filtered = allEntries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.domain.toLowerCase().includes(q)
      || e.company.toLowerCase().includes(q)
      || e.personName.toLowerCase().includes(q)
      || e.location.toLowerCase().includes(q)
      || e.type.toLowerCase().includes(q)
      || e.emails.some(em => em.toLowerCase().includes(q));
  }).sort((a, b) => {
    let va = (a as any)[sortKey] || "";
    let vb = (b as any)[sortKey] || "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleSelect(domain: string) {
    const next = new Set(selected);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    setSelected(next);
  }

  function selectAll() {
    const uncached = filtered.filter(e => !e.cached);
    if (uncached.length === 0) return;
    const next = new Set(selected);
    for (const e of uncached) next.add(e.domain);
    setSelected(next);
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleEnrich() {
    if (!selected.size) return;
    setEnriching(true);
    try {
      const result = await api.getCompanyDetails([...selected]);
      setCompanies(prev => ({ ...prev, ...result.companies }));
      setSelected(new Set());
    } catch {}
    setEnriching(false);
  }

  function SortHeader({ label, sort }: { label: string; sort: string }) {
    return (
      <button
        onClick={() => toggleSort(sort)}
        className="flex items-center gap-1 text-xs uppercase tracking-wider text-[#7c6e60] hover:text-[#1c1917] transition-colors font-medium"
      >
        {label}
        {sortKey === sort && (
          <ChevronDown size={12} className={cn("transition-transform", sortDir === "desc" && "rotate-180")} />
        )}
      </button>
    );
  }

  const uncachedCount = allEntries.filter(e => !e.cached).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-amber-600" />
          <h1 className="text-lg font-semibold text-[#1c1917]">Company Information</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#f5f0eb] text-xs text-[#7c6e60]">
            <Globe size={12} />
            {allEntries.length} domains · {uncachedCount} new
          </div>
          <button
            onClick={handleEnrich}
            disabled={enriching || !selected.size}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} className={enriching ? "animate-spin" : ""} />
            {enriching ? "Fetching..." : `Get Details (${selected.size})`}
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89f93]" />
          <input
            type="text"
            placeholder="Search domain, company, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#ede3da] bg-white text-[13px] text-[#1c1917] placeholder:text-[#b8ae9e] focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} disabled={!uncachedCount} className="text-xs text-[#7c6e60] hover:text-amber-700 disabled:opacity-30">Select new</button>
          <button onClick={deselectAll} disabled={!selected.size} className="text-xs text-[#7c6e60] hover:text-amber-700 disabled:opacity-30">Clear</button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[#a89f93]">
          <RefreshCw size={18} className="animate-spin mr-2" />
          Loading...
        </div>
      )}

      {/* Empty */}
      {!loading && allEntries.length === 0 && (
        <div className="text-center py-16 text-[#a89f93]">
          <Building2 size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No domains found. Upload jobs with email addresses first.</p>
        </div>
      )}

      {/* Table */}
      {allEntries.length > 0 && (
        <div className="bg-white rounded-lg border border-[#ede3da] overflow-hidden">
          <div className="grid grid-cols-[32px_1.5fr_1.2fr_1fr_1fr_0.8fr_1.5fr_0.9fr] gap-2 px-4 py-2.5 border-b border-[#ede3da] bg-[#fcfaf8] items-center">
            <span className="text-xs text-[#b8ae9e]">{filtered.length}</span>
            <SortHeader label="Domain" sort="domain" />
            <SortHeader label="Company" sort="company" />
            <SortHeader label="Person" sort="personName" />
            <SortHeader label="Location" sort="location" />
            <SortHeader label="Type" sort="type" />
            <span className="text-xs uppercase tracking-wider text-[#7c6e60] font-medium">Emails</span>
            <span className="text-xs text-[#b8ae9e]">Updated</span>
          </div>
          {filtered.map((e, i) => (
            <div
              key={e.domain}
              className={cn(
                "grid grid-cols-[32px_1.5fr_1.2fr_1fr_1fr_0.8fr_1.5fr_0.9fr] gap-2 px-4 py-2.5 border-b border-[#f5f0eb] last:border-0 items-center text-[13px] transition-colors hover:bg-amber-50/40",
                i % 2 === 0 ? "bg-white" : "bg-[#fcfaf8]"
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(e.domain)}
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded transition-colors",
                  !e.cached ? "text-[#7c6e60] hover:text-amber-700" : "text-[#d4cdc0]"
                )}
                disabled={e.cached}
              >
                {selected.has(e.domain)
                  ? <CheckSquare size={16} className="text-amber-600" />
                  : <Square size={16} />
                }
              </button>

              {/* Domain */}
              <span className={cn("font-mono text-xs", e.cached ? "text-[#7c6e60]" : "text-[#1c1917]")}>
                {e.domain}
              </span>

              {/* Company */}
              <span className={cn(
                "truncate",
                e.cached ? "text-[#1c1917]" : "text-[#b8ae9e] italic"
              )}>
                {e.cached ? e.company : "Not fetched"}
              </span>

              {/* Person */}
              <span className={cn(
                "flex items-center gap-1 truncate",
                e.cached ? "text-[#1c1917]" : "text-[#b8ae9e] italic"
              )}>
                {e.cached ? <><User size={12} className="text-[#a89f93] shrink-0" /> {e.personName}</> : "—"}
              </span>

              {/* Location */}
              <span className={cn(
                "flex items-center gap-1 truncate",
                e.cached ? "text-[#7c6e60]" : "text-[#b8ae9e] italic"
              )}>
                {e.cached ? <><MapPin size={12} className="shrink-0" /> {e.location}</> : "—"}
              </span>

              {/* Type */}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full w-fit",
                e.cached && e.type === "Product" ? "bg-blue-100 text-blue-700" :
                e.cached && e.type === "Service" ? "bg-amber-100 text-amber-700" :
                e.cached ? "bg-stone-100 text-stone-500" :
                "bg-stone-50 text-stone-300"
              )}>
                {e.cached ? e.type : "—"}
              </span>

              {/* Emails */}
              <span className="text-xs text-[#7c6e60] truncate" title={e.emails.join("\n")}>
                {e.emails.slice(0, 2).join(", ")}{e.emails.length > 2 ? ` +${e.emails.length - 2}` : ""}
              </span>

              {/* Updated */}
              <span className="text-xs text-[#b8ae9e]">
                {e.updatedAt ? formatDate(e.updatedAt) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
