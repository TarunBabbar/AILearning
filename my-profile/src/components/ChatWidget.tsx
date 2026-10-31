"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type ChatMsg = { role: "user" | "assistant"; content: string };
type ApiResponse = {
  type: "answer" | "forward" | "error";
  content: string;
  model?: string;
  modelName?: string;
};

const WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "Hi! I'm **Tarun's AI Assistant**. Ask me anything — his 18+ years in QA engineering, the AI apps and GitHub repositories shown on this site, his skills, career, or how to reach him.",
};

// One-tap starters so a visitor can see what this helper knows.
const SUGGESTIONS = [
  "What's Tarun's experience?",
  "Tell me about QAE2E",
  "Which AI apps has he built?",
  "What's his tech stack?",
  "How do I contact him?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const nextUser: ChatMsg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, nextUser]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: trimmed }],
        }),
      });
      const data: ApiResponse = await res.json();

      const reply: ChatMsg = { role: "assistant", content: data.content };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong reaching the assistant. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Suggestions only show on a fresh, empty chat.
  const showSuggestions = messages.length === 1 && !loading;

  return (
    <div className="fixed bottom-24 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-3 w-[min(92vw,380px)] rounded-2xl bg-bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-400 text-white">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <SparkIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold leading-tight">Ask about Tarun</div>
                <div className="text-[11px] text-white/80 leading-tight">
                  Experience · Projects · Repos · Skills
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="h-80 overflow-y-auto px-4 py-4 space-y-3 bg-bg-soft/80">
              {messages.map((m, i) => (
                <MessageBubble key={i} msg={m} />
              ))}

              {showSuggestions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-[11.5px] font-medium text-text-secondary bg-bg-card border border-border rounded-full px-3 py-1.5 hover:border-amber-500/60 hover:text-amber-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {loading && <TypingBubble />}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 px-3 py-3 border-t border-border bg-bg-card"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about Tarun…"
                disabled={loading}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-bg-soft border border-border outline-none focus:border-amber-500/60 text-text placeholder:text-text-muted disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
              >
                ↑
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask about Tarun"
        className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-xl shadow-amber-500/30 transition-colors"
      >
        <SparkIcon className="w-4 h-4" />
        <span>{open ? "Close" : "Ask Anything"}</span>
      </motion.button>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] w-fit min-w-[60px] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-amber-500 text-white font-medium rounded-br-sm"
            : "bg-bg-soft border border-border rounded-bl-sm text-text"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:text-text [&_a]:text-amber-600">
            <ReactMarkdown
              urlTransform={(url) => url}
              components={{
                a: (props) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:text-amber-700 underline underline-offset-2 break-words"
                  />
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-bg-soft border border-border rounded-bl-sm">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-1.5 h-1.5 rounded-full bg-amber-500"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l2.2 6.6L21 10.8l-6.8 2.2L12 19.6l-2.2-6.6L3 10.8l6.8-2.2L12 2z" />
    </svg>
  );
}
