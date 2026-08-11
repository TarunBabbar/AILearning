"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Markdown from "@/components/Markdown";

type ChatMsg = {
  id: string;
  role: "bot" | "user" | "system";
  text: string;
};

/** Memory window — the last N user/assistant turns sent to the model. */
const HISTORY_LIMIT = 20;

const GREETING =
  "Hi! 👋 I'm Tarun's assistant. Need help with the site or how job parsing works? " +
  "If you're facing an issue or have an idea for improvement, tell me and I'll pass it to Tarun.";

// If the user's message reads like an issue/suggestion, forward it to Tarun.
// Otherwise answer from the project knowledge (OpenRouter).
const ISSUE_KEYWORDS = [
  "issue",
  "problem",
  "not working",
  "broken",
  "bug",
  "improvement",
  "feature",
  "suggestion",
  "please fix",
  "please add",
  "can you add",
  "would be nice",
  "idea",
  "error",
];

function looksLikeIssue(text: string): boolean {
  const t = text.toLowerCase();
  return ISSUE_KEYWORDS.some((k) => t.includes(k));
}

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
  const listRef = useRef<HTMLDivElement>(null);
  // Conversation memory: user/assistant turns only (greeting + system
  // confirmations are excluded), capped at HISTORY_LIMIT.
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

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

    const kind = looksLikeIssue(text) ? "issue" : "question";
    historyRef.current.push({ role: "user", content: text });
    const history = historyRef.current.slice(-HISTORY_LIMIT);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, kind, history }),
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
          </div>

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
              <div className="flex items-center gap-1.5 self-start rounded-xl bg-claude-bg px-3 py-2 text-[13px] text-claude-muted">
                <Loader2 size={13} className="animate-spin" />
                thinking…
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
              placeholder="Ask me anything…"
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
        </div>
      )}
    </>,
    document.body
  );
}
