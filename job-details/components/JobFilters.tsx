"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, ArrowUpDown, Building2, MapPin, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  count: number;
};

export type JobFilterValue = {
  search: string;
  company: string;
  location: string;
  sort: string;
  order?: "asc" | "desc";
};

const DEFAULT_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "company", label: "Company A–Z" },
];

/**
 * Shared filter bar for QA Jobs and Match by Resume.
 * Debounces the search input internally; company/location are exact-match
 * dropdowns driven by server-provided options.
 */
export default function JobFilters({
  value,
  onChange,
  companyOptions,
  locationOptions,
  sortOptions = DEFAULT_SORT_OPTIONS,
  rightSlot,
  onReset,
}: {
  value: JobFilterValue;
  onChange: (next: JobFilterValue) => void;
  companyOptions: FilterOption[];
  locationOptions: FilterOption[];
  sortOptions?: { value: string; label: string }[];
  rightSlot?: React.ReactNode;
  onReset?: () => void;
}) {
  const [searchInput, setSearchInput] = useState(value.search);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sync the input when the parent resets / changes search externally.
  useEffect(() => {
    setSearchInput(value.search);
  }, [value.search]);

  const hasFilters =
    value.search.trim() !== "" ||
    value.company !== "" ||
    value.location !== "" ||
    value.sort !== sortOptions[0]?.value;

  const activeCount = useMemo(
    () =>
      (value.search.trim() ? 1 : 0) +
      (value.company ? 1 : 0) +
      (value.location ? 1 : 0),
    [value.search, value.company, value.location]
  );

  const handleSearch = (next: string) => {
    setSearchInput(next);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(
      setTimeout(() => onChange({ ...value, search: next }), 300)
    );
  };

  const reset = () => {
    setSearchInput("");
    if (searchTimer) clearTimeout(searchTimer);
    onChange({
      search: "",
      company: "",
      location: "",
      sort: sortOptions[0]?.value ?? "newest",
      order: undefined,
    });
    onReset?.();
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {/* Search */}
      <div className="relative min-w-[170px] flex-1">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
        />
        <input
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search title, company, location, email…"
          className="w-full rounded-lg border border-claude-border bg-white py-1.5 pl-8 pr-7 text-sm outline-none transition-colors placeholder:text-claude-muted focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/15"
        />
        {searchInput && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-claude-muted hover:text-claude-text"
            title="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Company dropdown */}
      <div className="relative shrink-0">
        <Building2
          size={12}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
        />
        <select
          value={value.company}
          onChange={(e) => onChange({ ...value, company: e.target.value })}
          className={cn(
            "max-w-[13rem] cursor-pointer appearance-none rounded-lg border bg-white py-1.5 pl-7 pr-7 text-sm outline-none transition-colors focus:border-claude-accent",
            value.company
              ? "border-claude-accent text-claude-text"
              : "border-claude-border text-claude-muted"
          )}
        >
          <option value="">All companies</option>
          {companyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value} ({opt.count.toLocaleString()})
            </option>
          ))}
        </select>
        <ArrowUpDown
          size={12}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
        />
      </div>

      {/* Location dropdown */}
      <div className="relative shrink-0">
        <MapPin
          size={12}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
        />
        <select
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          className={cn(
            "max-w-[13rem] cursor-pointer appearance-none rounded-lg border bg-white py-1.5 pl-7 pr-7 text-sm outline-none transition-colors focus:border-claude-accent",
            value.location
              ? "border-claude-accent text-claude-text"
              : "border-claude-border text-claude-muted"
          )}
        >
          <option value="">All locations</option>
          {locationOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value} ({opt.count.toLocaleString()})
            </option>
          ))}
        </select>
        <ArrowUpDown
          size={12}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
        />
      </div>

      {/* Sort */}
      <div className="relative shrink-0">
        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value })}
          className="cursor-pointer appearance-none rounded-lg border border-claude-border bg-white py-1.5 pl-3 pr-7 text-sm text-claude-text outline-none transition-colors focus:border-claude-accent"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ArrowUpDown
          size={12}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-claude-muted"
        />
      </div>

      {/* Reset (only when a filter is active) */}
      {(hasFilters || activeCount > 0) && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-claude-border bg-white px-2 py-1.5 text-sm font-medium text-claude-muted transition-colors hover:bg-claude-bg hover:text-claude-text"
          title="Reset all filters"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      )}

      {rightSlot}
    </div>
  );
}
