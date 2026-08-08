"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Search,
  Loader2,
  Copy,
  Check,
  Inbox,
  X,
} from "lucide-react";

type Contact = {
  company: string;
  emails: string[];
};

type Response = {
  totalCompanies: number;
  contacts: Contact[];
};

export default function ContactsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("search", debounced);
      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyEmail = useCallback(async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(email);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }, []);

  const emailCount = data?.contacts.reduce((s, c) => s + c.emails.length, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-claude-text">
            Recruiter Contacts
          </h1>
          <p className="mt-1.5 text-sm text-claude-muted">
            Email addresses from job postings, grouped by company.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-claude-muted sm:flex">
          <span className="inline-block h-2 w-2 rounded-full bg-claude-accent" />
          {data
            ? `${data.totalCompanies} companies · ${emailCount} emails`
            : "…"}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-claude-border bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by company or email…"
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-claude-muted">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading contacts…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-claude-border bg-white p-8 text-center text-sm text-claude-muted shadow-sm">
          {error}
        </div>
      ) : !data || data.contacts.length === 0 ? (
        <div className="rounded-xl border border-claude-border bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
            <Inbox size={24} />
          </div>
          <p className="text-base font-semibold text-claude-text">
            No contacts found
          </p>
          <p className="mt-2 text-sm text-claude-muted">
            Upload job PDFs with company emails to see recruiter contacts here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-claude-border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-claude-border bg-claude-bg/50 text-xs uppercase tracking-wide text-claude-muted">
                <th className="px-5 py-3 font-semibold">Company</th>
                <th className="px-5 py-3 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-claude-border">
              {data.contacts.map((contact) => (
                <tr
                  key={`${contact.company}|${contact.emails[0] ?? ""}`}
                  className="transition-colors hover:bg-claude-bg/40"
                >
                  {/* Company */}
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-claude-text">
                      {contact.company}
                    </div>
                  </td>

                  {/* Emails */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1.5">
                      {contact.emails.map((email) => (
                        <div key={email} className="group flex items-center gap-2">
                          <Mail
                            size={13}
                            className="shrink-0 text-claude-accent/70"
                          />
                          <a
                            href={`mailto:${email}`}
                            className="truncate text-claude-text hover:text-claude-accent hover:underline"
                            title={`Email ${email}`}
                          >
                            {email}
                          </a>
                          <button
                            onClick={() => copyEmail(email)}
                            className="shrink-0 rounded p-1 text-claude-muted opacity-0 transition-opacity hover:bg-claude-bg hover:text-claude-accent group-hover:opacity-100"
                            title="Copy email"
                          >
                            {copied === email ? (
                              <Check size={13} className="text-[#3d7a3d]" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
