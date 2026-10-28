"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type ChatMsg = { role: "user" | "assistant"; content: string; waLink?: string };
type ApiResponse = {
  type: "answer" | "forward" | "error";
  content: string;
  model?: string;
  modelName?: string;
  waLink?: string;
  summary?: string;
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

      const reply: ChatMsg =
        data.type === "answer"
          ? { role: "assistant", content: data.content }
          : { role: "assistant", content: data.content, waLink: data.waLink };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong reaching the assistant. Please try again, or reach Tarun directly on WhatsApp.",
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

        {msg.waLink && (
          <a
            href={msg.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1fb857] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Open WhatsApp
          </a>
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
