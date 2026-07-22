"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatAreaProps {
  projectId?: string;
}

export function ChatArea({ projectId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setInput("");
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, project_id: projectId }),
      });

      if (!res.ok) throw new Error("Stream failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                last.content += chunk;
              }
              return updated;
            });
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          last.content += "\n\n*Connection error. Please retry.*";
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex items-center justify-center min-h-[60vh] text-center px-8">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary mb-3">
                QA Copilot
              </h1>
              <p className="text-text-secondary text-[15px] max-w-sm mx-auto leading-relaxed">
                Generate test cases from PRDs, identify regression tests for bugs,
                automate test execution, or migrate test frameworks.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-8">
                {[
                  "Generate test cases for PRD-123",
                  "What tests cover BUG-456?",
                  "Run regression tests for BUG-789",
                  "Migrate LoginTest.java to Playwright",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3.5 py-1.5 text-[13px] rounded-full border border-border
                               text-text-secondary hover:text-amber-800 hover:border-amber-500
                               hover:bg-amber-50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={streaming && msg.role === "assistant" && msg === messages[messages.length - 1]}
          />
        ))}
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={streaming}
      />
    </div>
  );
}
