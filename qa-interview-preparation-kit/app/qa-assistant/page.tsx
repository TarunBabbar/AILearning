"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Bot, User, Loader2, FileText } from "lucide-react";

function renderMarkdown(text: string): string {
  // 1. Extract code blocks first so they're not touched by inline formatting
  const codeBlocks: string[] = [];
  let html = text.replace(/```([\s\S]+?)```/g, (_, code) => {
    codeBlocks.push(code.trim());
    return `%%%CODEBLOCK${codeBlocks.length - 1}%%%`;
  });

  // Escape HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Inline formatting
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

  // Split into lines for block-level processing
  const lines = html.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const trimmed = line.trim();

    // Empty line — close any open list
    if (!trimmed) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      out.push("");
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      if (!inUl) { out.push('<ul class="list-disc pl-4 space-y-1 my-1">'); inUl = true; }
      out.push(`<li>${ulMatch[1]}</li>`);
      continue;
    } else if (inUl) { out.push("</ul>"); inUl = false; }

    // Ordered list
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (olMatch) {
      if (!inOl) { out.push('<ol class="list-decimal pl-4 space-y-1 my-1">'); inOl = true; }
      out.push(`<li>${olMatch[1]}</li>`);
      continue;
    } else if (inOl) { out.push("</ol>"); inOl = false; }

    // Headers
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level} class="font-semibold text-claude-text mt-3 mb-1">${hMatch[2]}</h${level}>`);
      continue;
    }

    // Plain paragraph
    out.push(`<p class="my-1">${line}</p>`);
  }

  // Close any unclosed lists
  if (inUl) out.push("</ul>");
  if (inOl) out.push("</ol>");

  return out.join("\n").replace(/%%%CODEBLOCK(\d+)%%%/g, (_, idx) =>
    `<pre><code>${codeBlocks[parseInt(idx)]}</code></pre>`
  );
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { text: string; source: string }[];
}

function QAAssistantContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  // Handle initial query from dashboard
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInput(q);
      handleAsk(q);
    }
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedContent]);

  async function handleAsk(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    setStreamedContent("");
    setCurrentSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) throw new Error("Failed to get answer");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      let fullContent = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "sources") {
              setCurrentSources(parsed.content);
            } else if (parsed.type === "chunk") {
              fullContent += parsed.content;
              setStreamedContent(fullContent);
            } else if (parsed.type === "done") {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: fullContent,
                  sources: currentSources,
                },
              ]);
              setStreamedContent("");
              setCurrentSources([]);
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Check your API key and try again.",
        },
      ]);
    }
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleAsk();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-8 py-5 border-b border-claude-border bg-claude-beige-light">
        <h2 className="text-lg font-semibold text-claude-text">QA Assistant</h2>
        <p className="text-sm text-claude-text-muted">Ask questions from your interview documents</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="max-w-sm">
              <Bot size={40} className="mx-auto mb-4 text-claude-text-light" />
              <p className="text-claude-text-muted">
                Ask a question about QA, software testing, or any interview topic.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-claude-beige-dark flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-claude-text-muted" />
              </div>
            )}
            <div className={msg.role === "user" ? "message-bubble-user" : "message-bubble-assistant"}>
              <div className="text-sm prose-sm prose-claude max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-claude-border">
                  <p className="text-xs font-medium text-claude-text-muted mb-1">Sources:</p>
                  {msg.sources.map((s, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-claude-text-light mb-0.5">
                      <FileText size={12} className="shrink-0 mt-0.5" />
                      <span>{s.source}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-claude-accent/20 flex items-center justify-center shrink-0 mt-1">
                <User size={16} className="text-claude-accent" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {loading && streamedContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-claude-beige-dark flex items-center justify-center shrink-0 mt-1">
              <Bot size={16} className="text-claude-text-muted" />
            </div>
            <div className="message-bubble-assistant">
              <div className="text-sm prose-sm prose-claude max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamedContent) }} />
              {currentSources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-claude-border">
                  <p className="text-xs font-medium text-claude-text-muted mb-1">Sources:</p>
                  {currentSources.map((s, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-claude-text-light mb-0.5">
                      <FileText size={12} className="shrink-0 mt-0.5" />
                      <span>{s.source}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && !streamedContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-claude-beige-dark flex items-center justify-center shrink-0 mt-1">
              <Bot size={16} className="text-claude-text-muted" />
            </div>
            <div className="message-bubble-assistant">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEnd} />
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t border-claude-border bg-claude-beige-light">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="claude-input flex-1"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="claude-btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default function QAAssistantPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-claude-text-muted" />
      </div>
    }>
      <QAAssistantContent />
    </Suspense>
  );
}
