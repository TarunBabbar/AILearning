"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, HelpCircle, SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";
import Markdown from "@/components/Markdown";

type ChatMsg = {
  id: string;
  role: "bot" | "user" | "system";
  text: string;
};

/** Which action the user picked on the welcome screen. */
type ChatMode = "question" | "message" | null;

/** Memory window — the last N user/assistant turns sent to the model. */
const HISTORY_LIMIT = 20;

const GREETING =
  "Hi! 👋 I'm Tarun's assistant. Need help with the site or how job parsing works? " +
  "If you're facing an issue or have an idea for improvement, tell me and I'll pass it to Tarun.";

function nextId(): string {
  return Math.random().toString(36).slice(2);
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "greet", role: "bot", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<ChatMode>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Conversation memory: user/assistant turns only (greeting + system
  // confirmations are excluded), capped at HISTORY_LIMIT.
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  // User context snapshot (project + user data) — fetched once when the chat
  // opens, cached in the browser, sent with each message so the LLM answers
  // fast without a per-message DB query.
  const contextRef = useRef<string | null>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Pre-load the user context once when the chat opens, so messages are
  // answered quickly with full project + user knowledge.
  useEffect(() => {
    if (!open || contextRef.current) return;
    let active = true;
    fetch("/api/chat/context", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.context) contextRef.current = d.context;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setBusy(true);

    // In "message to Tarun" mode, the server forwards directly. In
    // "question" mode, the LLM answers (with the cached user context).
    const currentMode = mode ?? "question";
    historyRef.current.push({ role: "user", content: text });
    const history = historyRef.current.slice(-HISTORY_LIMIT);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode: currentMode,
          history,
          context: contextRef.current ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mode?: string;
        answer?: string;
        error?: string;
      };

      if (data.mode === "forwarded") {
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "system",
            text: "✅ Your message has been sent to Tarun and will be acted upon.",
          },
        ]);
      } else if (data.answer) {
        // Keep memory of answered turns only (not system confirmations).
        historyRef.current.push({ role: "assistant", content: data.answer });
        setMessages((m) => [...m, { id: nextId(), role: "bot", text: data.answer! }]);
      } else {
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "bot", text: "Something went wrong — please try again." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "bot", text: "Something went wrong — please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Launcher bubble */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat with Tarun's assistant"
        className="fixed bottom-6 right-6 z-[300] flex h-14 w-14 items-center justify-center rounded-full bg-claude-accent text-white shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat with Tarun's assistant"
          className="fixed bottom-24 right-6 z-[300] flex max-h-[28rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-claude-border bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-claude-border bg-claude-bg/40 px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-claude-accent text-sm font-semibold text-white">
              T
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-claude-text">
                Tarun&apos;s assistant
              </p>
              <p className="text-[11px] text-claude-muted">Project help · issues → Tarun</p>
            </div>

            {/* Mode switch — lets the user flip between Ask / Message Tarun */}
            {mode !== null && (
              <div className="flex shrink-0 items-center rounded-md border border-claude-border bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("question")}
                  title="Ask the AI a question"
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    mode === "question"
                      ? "bg-claude-accent text-white"
                      : "text-claude-muted hover:text-claude-text"
                  )}
                >
                  Ask
                </button>
                <button
                  type="button"
                  onClick={() => setMode("message")}
                  title="Send a message to Tarun"
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    mode === "message"
                      ? "bg-claude-accent text-white"
                      : "text-claude-muted hover:text-claude-text"
                  )}
                >
                  Message
                </button>
              </div>
            )}
          </div>

          {/* Body: welcome screen (no mode chosen yet) or conversation */}
          {mode === null ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3.5 py-4">
              <div className="mb-1 text-sm font-semibold text-claude-text">
                Hi! 👋 What would you like to do?
              </div>
              <p className="mb-3 text-xs leading-relaxed text-claude-muted">
                Ask a question and I&apos;ll answer from what I know about the
                site. Or send a message directly to Tarun — suggestions,
                feedback, or anything you&apos;d like him to act on.
              </p>

              <button
                type="button"
                onClick={() => setMode("question")}
                className="mb-2 flex items-start gap-2.5 rounded-xl border border-claude-border bg-white px-3 py-2.5 text-left transition-colors hover:border-claude-accent hover:bg-claude-accent/5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-claude-accent/10 text-claude-accent">
                  <HelpCircle size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-claude-text">
                    Ask a question
                  </span>
                  <span className="block text-[11px] text-claude-muted">
                    I&apos;ll answer about the site, jobs, and how things work.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode("message")}
                className="flex items-start gap-2.5 rounded-xl border border-claude-border bg-white px-3 py-2.5 text-left transition-colors hover:border-claude-accent hover:bg-claude-accent/5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fbf6e9] text-[#9a7b2d]">
                  <SendHorizonal size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-claude-text">
                    Send a message to Tarun
                  </span>
                  <span className="block text-[11px] text-claude-muted">
                    Suggestion, feedback, or a request — goes straight to him.
                  </span>
                </span>
              </button>

              {messages[0] && messages[0].role === "bot" && (
                <div className="mt-3 rounded-xl bg-claude-bg px-3 py-2 text-[12px] leading-relaxed text-claude-muted">
                  {messages[0].text}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-white px-3.5 py-3"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug",
                      msg.role === "user" &&
                        "self-end bg-claude-accent text-white rounded-br-sm",
                      msg.role === "bot" &&
                        "self-start bg-claude-bg text-claude-text rounded-bl-sm",
                      msg.role === "system" &&
                        "self-center bg-[#fbf6e9] text-center text-[12px] text-[#6b5a2e] ring-1 ring-[#eadfc2]"
                    )}
                  >
                    {msg.role === "bot" ? (
                      <Markdown>{msg.text}</Markdown>
                    ) : (
                      msg.text
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 self-start rounded-xl bg-claude-bg px-3 py-2.5">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-claude-accent [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-claude-accent [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-claude-accent" />
                    </span>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 border-t border-claude-border px-3 py-2.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  placeholder={
                    mode === "message"
                      ? "Message for Tarun…"
                      : "Ask me anything…"
                  }
                  aria-label="Chat message"
                  className="min-w-0 flex-1 rounded-lg border border-claude-border bg-white px-3 py-2 text-[13px] text-claude-text outline-none placeholder:text-claude-muted focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/15"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !input.trim()}
                  aria-label="Send message"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-claude-accent text-white transition-colors hover:opacity-90 disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
