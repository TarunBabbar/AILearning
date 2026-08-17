"use client";

import { Star, MessageSquareHeart, Quote } from "lucide-react";
import useSWR from "swr";
import PageChrome from "@/components/PageChrome";
import { swrFetcher } from "@/lib/swr-fetcher";

type Review = {
  id: string;
  name: string;
  rating: number;
  message: string;
  createdAt: string;
};

type FeedbackResponse = {
  reviews: Review[];
  averageRating: number | null;
  reviewCount: number;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            n <= value ? "fill-amber-400 text-amber-400" : "fill-claude-border/30 text-claude-border/30"
          }
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { data } = useSWR<FeedbackResponse>("/api/feedback", swrFetcher, {
    revalidateOnFocus: false,
  });

  const hasReviews = (data?.reviews?.length ?? 0) > 0;

  return (
    <PageChrome
      header={
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight text-claude-text">
            What other users say about this portal
          </h1>
          <p className="text-[11px] leading-snug text-claude-muted">
            Real stories from job seekers — interview calls, recruiter connections, and
            roles they found through QA Jobs Portal.
          </p>
        </div>
      }
    >
      {!hasReviews ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-claude-border bg-white px-6 py-16 text-center shadow-sm">
          <MessageSquareHeart size={22} className="mb-2 text-claude-accent" />
          <p className="text-sm font-medium text-claude-text">No reviews yet</p>
          <p className="mt-1 text-xs text-claude-muted">
            Be the first to share your experience — use the Share Feedback
            option in the sidebar.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-claude-border bg-white p-4 shadow-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-claude-accent/10 text-claude-accent">
              <MessageSquareHeart size={20} />
            </span>
            <div>
              <p className="text-2xl font-bold text-claude-text">
                {data?.averageRating ?? "—"}
                <span className="ml-1 text-sm font-medium text-claude-muted">/ 5</span>
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <Stars value={Math.round(data?.averageRating ?? 0)} />
                <span className="text-xs text-claude-muted">
                  {data?.reviewCount} review{data?.reviewCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal scroll of top reviews */}
          <div className="flex gap-3 overflow-x-auto pb-3">
            {data?.reviews.map((r) => (
              <div
                key={r.id}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-claude-border bg-white p-4 shadow-sm"
              >
                <Quote size={16} className="mb-2 text-claude-accent/50" />
                <p className="line-clamp-4 flex-1 text-[13px] leading-relaxed text-claude-muted">
                  {r.message}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-claude-border pt-2.5">
                  <span className="truncate text-xs font-semibold text-claude-text">{r.name}</span>
                  <Stars value={r.rating} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageChrome>
  );
}
