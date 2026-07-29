"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Bot, User, Loader2, FileText } from "lucide-react";

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/```(.+?)```/gs, "<pre><code>$1</code></pre>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 space-y-1 my-1">$&</ul>')
    .replace(/\n/g, "<br>");
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
