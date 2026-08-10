"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, MapPin, Mail, Clock, Calendar, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColor, initials, formatShortDate, MetaChip } from "@/components/JobCard";
import type { JobLike } from "@/lib/types";

/**
 * Shared job detail modal used by QA Jobs and Match by Resume.
 * Pass `score` / `strengths` / `gaps` when opened from the Score page.
 */
export default function JobDetailModal({
  job,
  loading,
  onClose,
  score,
  strengths,
  gaps,
}: {
  job: JobLike;
  loading: boolean;
  onClose: () => void;
  score?: number;
  strengths?: string | null;
  gaps?: string | null;
}) {
  const color = avatarColor(job.company);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="fade-up relative max-h-[min(90vh,56rem)] w-full max-w-2xl overflow-hidden rounded-2xl border border-claude-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("h-1.5 w-full", color.split(" ")[0])} />
        <div className="flex items-start gap-4 border-b border-claude-border p-6">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold",
              color
            )}
          >
            {initials(job.company)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-snug text-claude-text">
              {job.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-claude-muted">
              <span className="flex items-center gap-1.5">
                <Building2 size={14} className="text-claude-accent/70" />
                {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-claude-accent/70" />
                  {job.location}
                </span>
              )}
              {job.jobDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-claude-accent/70" />
                  {formatShortDate(job.jobDate)}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {score != null && (
                <span className="rounded bg-claude-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-claude-accent">
                  {score}% score
                </span>
              )}
              {job.experience && (
                <MetaChip icon={<Clock size={11} />} text={job.experience} />
              )}
              {job.email && (
                <MetaChip icon={<Mail size={11} />} text={job.email} />
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-claude-muted transition-colors hover:bg-claude-bg hover:text-claude-text"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[min(50vh,28rem)] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-claude-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading full description…
            </div>
          ) : (
            <div className="space-y-4">
              {strengths && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-claude-muted/70">
                    Strengths
                  </div>
                  <p className="text-sm leading-relaxed text-claude-text">
                    {strengths}
                  </p>
                </div>
              )}
              {gaps && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-claude-muted/70">
                    Gaps
                  </div>
                  <p className="text-sm leading-relaxed text-claude-text">
                    {gaps}
                  </p>
                </div>
              )}
              {job.description ? (
                <>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-claude-muted/70">
                    Full description
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-claude-muted">
                    {job.description}
                  </div>
                </>
              ) : (
                <p className="text-sm text-claude-muted">No description available.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
