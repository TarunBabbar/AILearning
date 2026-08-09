"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Search, Copy, Check, X, Building2 } from "lucide-react";
import { TableSkeleton } from "@/components/Skeleton";
import ListPagination from "@/components/ListPagination";
import ShowingRange from "@/components/ShowingRange";
import PageChrome from "@/components/PageChrome";
import { useListSWR } from "@/lib/use-list-swr";

const PAGE_SIZE = 40;

type Contact = {
  company: string;
  emails: string[];
};

type Response = {
  totalCompanies: number;
  totalEmails: number;
  page: number;
  pageCount: number;
  contacts: Contact[];
};

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    document.getElementById("page-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const contactsKey = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return `/api/contacts?${params.toString()}`;
  }, [debounced, page]);

  const { data, error: swrError, isLoading } = useListSWR<Response>(contactsKey);
  const loading = isLoading && !data;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "Failed to load"
    : null;

  const copyEmail = useCallback(async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(email);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }, []);

  const pageCount = data?.pageCount ?? 1;
  const currentPage = data?.page ?? page;

  return (
    <PageChrome
      header={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-claude-text">
              Recruiter Contacts
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-claude-muted">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#e6edf5] px-1.5 py-0.5 font-medium text-[#4a6d8c]">
                <Building2 size={11} />
                {(data?.totalCompanies ?? 0).toLocaleString()} companies
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-claude-accent-soft px-1.5 py-0.5 font-medium text-claude-accent">
                <Mail size={11} />
                {(data?.totalEmails ?? 0).toLocaleString()} emails
              </span>
            </div>
          </div>

          <div className="relative w-full sm:w-[14rem]">
            <Search
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-claude-muted"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter company or email…"
              className="w-full rounded-md border border-claude-border bg-white py-1 pl-7 pr-6 text-xs outline-none placeholder:text-claude-muted focus:border-claude-accent"
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
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <p className="py-6 text-center text-sm text-claude-muted">{error}</p>
      ) : !data || data.contacts.length === 0 ? (
        <div className="rounded-lg border border-claude-border bg-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-claude-text">No contacts found</p>
          <p className="mt-0.5 text-xs text-claude-muted">
            Upload job PDFs with company emails to see contacts here.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-claude-border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-claude-border bg-white px-3.5 py-2">
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(9rem,14rem)_1fr] gap-x-3 text-[11px] font-medium uppercase tracking-wide text-claude-muted">
                <span>Company</span>
                <span>Email</span>
              </div>
              <ShowingRange
                page={currentPage}
                pageSize={PAGE_SIZE}
                itemCount={data.contacts.length}
                total={data.totalCompanies}
                className="shrink-0 normal-case tracking-normal"
              />
            </div>
            <div className="divide-y divide-claude-border">
              {data.contacts.map((contact) => (
                <div
                  key={`${contact.company}|${contact.emails[0] ?? ""}`}
                  className="grid grid-cols-[minmax(9rem,14rem)_1fr] gap-x-3 px-3.5 py-2.5 hover:bg-claude-bg/30"
                >
                  <div className="truncate text-[13px] font-semibold text-claude-text">
                    {contact.company}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {contact.emails.map((email) => (
                      <div
                        key={email}
                        className="group flex min-w-0 items-center gap-1.5"
                      >
                        <Mail
                          size={12}
                          className="shrink-0 text-claude-accent/70"
                        />
                        <a
                          href={`mailto:${email}`}
                          className="truncate text-[13px] text-claude-text hover:text-claude-accent hover:underline"
                          title={`Email ${email}`}
                        >
                          {email}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyEmail(email)}
                          className="shrink-0 text-claude-muted opacity-0 transition-opacity hover:text-claude-accent group-hover:opacity-100"
                          title="Copy email"
                        >
                          {copied === email ? (
                            <Check size={12} className="text-[#3d7a3d]" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ListPagination
            page={currentPage}
            pageCount={pageCount}
            total={data.totalCompanies}
            loading={isLoading}
            onPageChange={setPage}
          />
        </>
      )}
    </PageChrome>
  );
}
