"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageCount: number;
  total?: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

/** Shared First / Prev / Page / Next / Last control (QA Jobs style). */
export default function ListPagination({
  page,
  pageCount,
  total,
  loading = false,
  onPageChange,
}: Props) {
  if (pageCount <= 1) return null;

  return (
    <div className="mt-6 flex justify-center">
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-claude-border bg-white px-2 py-1.5 shadow-sm">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(1)}
          title="First page"
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={12} className="-mr-1" />
          <ChevronLeft size={12} />
          <span className="ml-0.5">First</span>
        </button>
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="px-2 text-xs text-claude-muted">
          Page{" "}
          <span className="font-semibold text-claude-text">{page}</span>
          {" of "}
          <span className="font-semibold text-claude-text">{pageCount}</span>
          {total != null && (
            <span className="ml-1.5 text-claude-muted/70">
              · {total.toLocaleString()}
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={page >= pageCount || loading}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          disabled={page >= pageCount || loading}
          onClick={() => onPageChange(pageCount)}
          title="Last page"
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-claude-text transition-colors hover:bg-claude-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="mr-0.5">Last</span>
          <ChevronRight size={12} />
          <ChevronRight size={12} className="-ml-1" />
        </button>
      </div>
    </div>
  );
}
