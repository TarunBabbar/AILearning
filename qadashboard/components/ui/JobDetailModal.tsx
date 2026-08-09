"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobAvatar } from "./JobAvatar";

/**
 * Centered full-screen detail modal (port of job-details JobDetailModal).
 * Locks body scroll and closes on Escape / backdrop click.
 */
export default function JobDetailModal({
  open,
  onClose,
  title,
  company,
  subtitle,
  score,
  scoreLabel,
  sections,
  footer,
  maxWidthClass = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  company?: string;
  subtitle?: React.ReactNode;
  /** 0-100 match score — renders a colored badge + progress bar when present. */
  score?: number | null;
  scoreLabel?: string;
  sections: { label: string; body: React.ReactNode }[];
  footer?: React.ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const scoreColor =
    score == null
      ? "text-text-muted"
      : score >= 60
        ? "text-[#3d7a3d]"
        : score >= 30
          ? "text-[#9a7b2d]"
          : "text-[#a04040]";
  const scoreBg =
    score == null
      ? "bg-bg-surface"
      : score >= 60
        ? "bg-[#e3efe3]"
        : score >= 30
          ? "bg-[#fdf0d5]"
          : "bg-[#f5e5e5]";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className={cn(
          "fade-up relative flex max-h-[min(90vh,56rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl",
          maxWidthClass
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-border p-5 sm:p-6">
          {company ? <JobAvatar name={company} size="lg" /> : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug text-text-primary sm:text-xl">
              {title}
            </h2>
            {subtitle && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                {subtitle}
              </div>
            )}
            {score != null && (
              <div className="mt-3 flex max-w-xs items-center gap-2">
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-bg-surface">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      score >= 60 ? "bg-[#3d7a3d]" : score >= 30 ? "bg-[#9a7b2d]" : "bg-[#a04040]"
                    )}
                    style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-sm font-bold",
                    scoreBg,
                    scoreColor
                  )}
                >
                  {score}
                  {scoreLabel ? ` ${scoreLabel}` : "%"}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-surface hover:text-text-primary"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="space-y-4">
            {sections.map((s) => (
              <div key={s.label}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted/70">
                  {s.label}
                </div>
                {s.body}
              </div>
            ))}
          </div>
          {footer && <div className="mt-5 border-t border-border pt-4">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
