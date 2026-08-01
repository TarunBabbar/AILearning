"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; score: number }[];
};

type Props = {
  placeholder?: string;
  model?: string;
  namespace?: string;
  showSources?: boolean;
  systemMessage?: string;
};

export function ChatArea({
  placeholder = "Ask a question...",
  model,
  namespace = "default",
  showSources = true,
  systemMessage,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [expandedSources, setExpandedSources] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialSent = useRef(false);

  // Load top suggestion questions from the knowledge base
  useEffect(() => {
    fetch("/api/chat/suggestions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.suggestions?.length) setSuggestions(data.suggestions);
      })
      .catch(() => {});
  }, []);

  // Handle ?ask= query param — auto-send question on mount
  useEffect(() => {
    if (initialSent.current) return;
    const params = new URLSearchParams(window.location.search);
    const ask = params.get("ask");
    if (ask) {
      initialSent.current = true;
      // Clear the ?ask param so navigating again doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);

      setInput(ask);
      setLoading(true);
      const userMsg: Message = { role: "user", content: ask };
      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages([userMsg, assistantMsg]);
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: ask, namespace, model, systemMessage }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Request failed");
          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");
          const decoder = new TextDecoder();
          let buffer = "";
          let sources: { source: string; score: number }[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === "sources") sources = parsed.content;
                else if (parsed.type === "chunk") {
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.role !== "assistant") return prev;
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: last.content + parsed.content },
                    ];
                  });
                }
              } catch {}
            }
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, sources }];
          });
        })
        .catch(() => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, content: "Sorry, something went wrong." }];
          });
        })
        .finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, []);

  useEffect(() => { autoResize(); }, [input, autoResize]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: Message = { role: "user", content: q };
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          namespace,
          model,
          systemMessage,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let sources: { source: string; score: number }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "sources") {
              sources = parsed.content;
            } else if (parsed.type === "chunk") {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role !== "assistant") return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + parsed.content },
                ];
              });
            }
          } catch {
            // skip
          }
        }
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, sources }];
      });
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, content: "Sorry, something went wrong. Please try again." }];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-text-muted text-sm mb-4">{placeholder}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(suggestions.length > 0
                  ? suggestions
                  : [
                      "What are the top QA interview questions?",
                      "Explain Selenium WebDriver architecture",
                      "What is the difference between regression and smoke testing?",
                      "How do you write a good test case?",
                    ]
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="text-sm bg-bg-surface border border-border rounded-full px-3 py-1.5 text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2.5",
                msg.role === "user"
                  ? "bg-bg-user text-text-primary"
                  : "bg-bg-surface border border-border"
              )}
            >
              {msg.role === "assistant" && msg.content === "" && loading ? (
                <Loader2 size={18} className="animate-spin text-text-muted" />
              ) : msg.role === "assistant" ? (
                <div className="markdown-body text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              )}

              {/* Sources */}
              {showSources && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <button
                    onClick={() =>
                      setExpandedSources(expandedSources === i ? null : i)
                    }
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                  >
                    {expandedSources === i
                      ? "Hide sources"
                      : `Sources (${msg.sources.length})`}
                  </button>
                  {expandedSources === i && (
                    <div className="mt-1 space-y-1">
                      {msg.sources.map((s, j) => (
                        <div
                          key={j}
                          className="text-xs text-text-muted flex items-center gap-2"
                        >
                          <span className="bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded">
                            {(s.score * 100).toFixed(0)}%
                          </span>
                          <span className="truncate">{s.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-white">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-amber-500/20"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
