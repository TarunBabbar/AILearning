"use client";

import { Building2, MapPin, Mail, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobLike } from "@/lib/types";

// Deterministic pastel avatar colors derived from the company name
const AVATAR_COLORS = [
  "bg-[#f7e9e2] text-[#c96443]",
  "bg-[#e6edf5] text-[#4a6d8c]",
  "bg-[#e3efe3] text-[#3d7a3d]",
  "bg-[#f3e8f5] text-[#7a3d8c]",
  "bg-[#e8f0d9] text-[#5a7a2d]",
  "bg-[#fdf0d5] text-[#9a7b2d]",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** True if the job was added to the board today (by createdAt). */
export function isNewToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function scoreColor(score: number): string {
  if (score >= 60) return "text-[#3d7a3d]";
  if (score >= 30) return "text-[#9a7b2d]";
  return "text-[#a04040]";
}

export function scoreBg(score: number): string {
  if (score >= 60) return "bg-[#e3efe3]";
  if (score >= 30) return "bg-[#fdf0d5]";
  return "bg-[#f5e5e5]";
}

export function MetaChip({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string | null | undefined;
}) {
  // Never render a literal "null"/"undefined" — hide the chip instead.
  if (!text || text === "null" || text === "undefined" || text === "N/A") {
    return null;
  }
  return (
    <span className="flex max-w-full items-center gap-0.5 rounded bg-claude-bg px-1.5 py-0.5 text-[10px] text-claude-muted">
      <span className="shrink-0 text-claude-accent/70">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

/**
 * Shared job card used by QA Jobs and Match by Resume.
 * The Score page passes an optional `score` badge and `strengths` line.
 */
export default function JobCard({
  job,
  onOpen,
  score,
  strengths,
}: {
  job: JobLike;
  onOpen: () => void;
  score?: number;
  strengths?: string | null;
}) {
  const color = avatarColor(job.company);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-claude-border bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className={cn("h-0.5 w-full", color.split(" ")[0])} />

      <button onClick={onOpen} className="flex flex-1 flex-col p-3.5 text-left">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
              color
            )}
          >
            {initials(job.company)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h3 className="line-clamp-2 min-h-[36px] flex-1 text-[13px] font-semibold leading-snug text-claude-text">
                {job.title}
              </h3>
              {isNewToday(job.createdAt) && (
                <span className="mt-0.5 shrink-0 rounded bg-claude-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  New
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-claude-muted">
              <Building2 size={11} className="shrink-0 text-claude-accent/70" />
              <span className="truncate font-medium text-claude-text/80">
                {job.company}
              </span>
            </div>
          </div>
          {score != null && (
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold",
                scoreBg(score),
                scoreColor(score)
              )}
            >
              {score}%
            </span>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {job.location && (
            <MetaChip icon={<MapPin size={10} />} text={job.location} />
          )}
          {job.experience && (
            <MetaChip icon={<Clock size={10} />} text={job.experience} />
          )}
          {job.email && <MetaChip icon={<Mail size={10} />} text={job.email} />}
        </div>

        {job.description ? (
          <p className="mt-2 line-clamp-2 min-h-[28px] text-[11px] leading-relaxed text-claude-muted">
            {job.description}
          </p>
        ) : (
          <div className="mt-2 min-h-[28px]" />
        )}

        {strengths ? (
          <p className="mt-1.5 line-clamp-1 min-h-[16px] text-[10px] italic text-claude-muted">
            {strengths}
          </p>
        ) : (
          <div className="mt-1.5 min-h-[16px]" />
        )}

        <div className="mt-auto flex items-center justify-between pt-2.5 text-[11px] text-claude-muted">
          <span className="truncate pr-2">
            {score != null ? "Scored job" : job.email ?? ""}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {job.jobDate ? formatShortDate(job.jobDate) : ""}
            <ChevronDown size={12} />
          </span>
        </div>
      </button>
    </div>
  );
}
