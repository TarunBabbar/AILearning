"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, X, Send, Loader2, MessageSquareHeart } from "lucide-react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { SESSION_KEY, swrFetcher } from "@/lib/swr-fetcher";
import { mutate } from "swr";

type MeResponse = { user: { id: string; email: string; name: string | null } | null };

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          disabled={!onChange}
          className={cn("transition-colors", onChange && "hover:scale-110")}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={22}
            className={
              n <= value ? "fill-amber-400 text-amber-400" : "fill-claude-border/30 text-claude-border/30"
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data: me } = useSWR<MeResponse>(SESSION_KEY, swrFetcher, { revalidateOnFocus: false });

  useEffect(() => {
    if (me?.user) {
      if (!name) setName(me.user.name || "");
      if (!email) setEmail(me.user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setError(null);
      setRating(0);
      setMessage("");
    }
  }, [open]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy) return;
      setError(null);
      if (rating < 1) {
        setError("Please select a star rating.");
        return;
      }
      if (message.trim().length < 10) {
        setError("Please write a short review (at least 10 characters).");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), rating, message: message.trim() }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(body.error || "Failed to save feedback.");
          return;
        }
        setSubmitted(true);
        await mutate("/api/feedback");
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, rating, message, name, email]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-claude-border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-claude-border bg-claude-bg/40 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-claude-accent text-white">
            <MessageSquareHeart size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-claude-text">Share your feedback</p>
            <p className="text-[11px] text-claude-muted">Help us grow &amp; help others find their job</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-claude-muted hover:bg-claude-bg hover:text-claude-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {submitted ? (
            <div className="py-8 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e3efe3] text-[#3d7a3d]">
                <MessageSquareHeart size={24} />
              </span>
              <p className="text-base font-semibold text-claude-text">Thank you! 🙏</p>
              <p className="mt-2 text-sm leading-relaxed text-claude-muted">
                Your review helps other job seekers trust the portal — and helps us
                improve it for everyone.
              </p>
            </div>
          ) : (
            <>
              {/* Intro */}
              <div className="mb-4 rounded-xl border border-[#eadfc2] bg-[#fbf6e9] p-3.5">
                <p className="text-[13px] font-semibold text-[#7a6120]">
                  Did QA Jobs Portal help you? 🌟
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#6b5a2e]">
                  Whether you landed an interview, connected with a recruiter, or just
                  found the portal useful — your review helps other job seekers and
                  helps us grow. It takes less than a minute!
                </p>
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-claude-muted">
                    Your rating
                  </label>
                  <Stars value={rating} onChange={setRating} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
                  />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email"
                    disabled={!!me?.user?.email}
                    readOnly={!!me?.user?.email}
                    title={
                      me?.user?.email
                        ? "Your email — set from your account"
                        : undefined
                    }
                    className="rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent disabled:bg-claude-bg/40 disabled:text-claude-muted"
                  />
                </div>

                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us about your experience — did you get interview calls, connect with recruiters, find relevant jobs…?"
                  className="w-full resize-none rounded-lg border border-claude-border px-3 py-2 text-sm outline-none focus:border-claude-accent"
                />

                {error && <p className="text-xs text-[#a04040]">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-claude-accent px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  <Send size={14} />
                  Submit review
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
