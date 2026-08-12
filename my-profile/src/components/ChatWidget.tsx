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

type ChatMode = "question" | "message" | null;

const WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "Hi! I'm **Tarun's AI Assistant** — here to help you learn about Tarun's experience, projects, skills, or how to get in touch. If I can't answer, I'll ping Tarun on WhatsApp for you. 🤖",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>(null);
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

    const currentMode = mode ?? "question";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: trimmed }],
          mode: currentMode,
        }),
      });
      const data: ApiResponse = await res.json();

      let reply: ChatMsg;
      if (data.type === "forward") {
        reply = {
          role: "assistant",
          content: data.content,
          waLink: data.waLink,
        };
      } else if (data.type === "error") {
        reply = { role: "assistant", content: data.content, waLink: data.waLink };
      } else {
        reply = { role: "assistant", content: data.content };
      }
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong reaching the bot. Please try again, or contact Tarun directly on WhatsApp.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-3 w-[min(92vw,380px)] rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-400 text-white">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
                🤖
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold leading-tight">Tarun Kumar Babbar</div>
                <div className="text-[11px] text-white/80 leading-tight">
                  AI assistant · answers from the profile
                </div>
              </div>

              {/* Mode switch — flip between Ask / Message Tarun */}
              {mode !== null && (
                <div className="flex items-center rounded-lg bg-white/20 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode("question")}
                    title="Ask the AI a question"
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      mode === "question" ? "bg-white text-amber-700" : "text-white/80 hover:text-white"
                    }`}
                  >
                    Ask
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("message")}
                    title="Send a message to Tarun"
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      mode === "message" ? "bg-white text-amber-700" : "text-white/80 hover:text-white"
                    }`}
                  >
                    Message
                  </button>
                </div>
              )}

              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Welcome screen — pick a mode before chatting */}
            {mode === null ? (
              <div className="h-80 overflow-y-auto px-4 py-4 bg-cream/60">
                <div className="mb-1 text-sm font-semibold text-text">
                  Hi! 👋 What would you like to do?
                </div>
                <p className="mb-3 text-xs leading-relaxed text-text-secondary">
                  Ask a question and I&apos;ll answer from Tarun&apos;s profile.
                  Or send a message directly to Tarun — he&apos;ll get back to you
                  on WhatsApp.
                </p>

                <button
                  type="button"
                  onClick={() => setMode("question")}
                  className="mb-2 w-full flex items-start gap-2.5 rounded-xl border border-border bg-white px-3 py-2.5 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
                >
                  <span className="mt-0.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                    💬
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">
                      Ask a question
                    </span>
                    <span className="block text-[11px] text-text-secondary">
                      About Tarun&apos;s experience, projects, skills, or how to get in touch.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("message")}
                  className="w-full flex items-start gap-2.5 rounded-xl border border-border bg-white px-3 py-2.5 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
                >
                  <span className="mt-0.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 text-sm">
                    ✉️
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">
                      Send a message to Tarun
                    </span>
                    <span className="block text-[11px] text-text-secondary">
                      A message, question, or hello — goes straight to his WhatsApp.
                    </span>
                  </span>
                </button>

                <div className="mt-3 rounded-xl bg-white border border-border px-3 py-2.5 text-[12px] leading-relaxed text-text-secondary">
                  {WELCOME.content.replace(/\*\*/g, "")}
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="h-80 overflow-y-auto px-4 py-4 space-y-3 bg-cream/60">
                  {messages.map((m, i) => (
                    <MessageBubble key={i} msg={m} />
                  ))}
                  {loading && <TypingBubble />}
                </div>

                {/* Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex items-center gap-2 px-3 py-3 border-t border-border bg-surface"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      mode === "message" ? "Message for Tarun…" : "Ask about Tarun…"
                    }
                    disabled={loading}
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-cream border border-border outline-none focus:border-amber-400 disabled:opacity-50"
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Tarun's AI Assistant chat"
        className="flex items-center gap-2.5 px-4 py-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-xl shadow-amber-500/30 transition-colors"
      >
        <span className="text-lg">🤖</span>
        {!open && <span>Have a question?</span>}
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
            ? "bg-amber-500 text-white rounded-br-sm"
            : "bg-white border border-border rounded-bl-sm text-text"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:text-text">
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
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border border-border rounded-bl-sm">
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
