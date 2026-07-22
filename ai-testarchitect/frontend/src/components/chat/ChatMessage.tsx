"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-4 px-6 py-5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center mt-0.5">
          <Bot size={14} className="text-white" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-xl px-5 py-3.5 text-[15px] leading-relaxed",
          isUser
            ? "bg-bg-user text-text-primary rounded-br-sm shadow-sm"
            : "bg-bg-surface text-text-primary rounded-bl-sm shadow-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="markdown-body prose max-w-none prose-p:my-1.5 prose-headings:text-text-primary prose-headings:font-semibold prose-a:text-amber-700 prose-a:font-medium prose-strong:text-text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-amber-600 animate-pulse ml-0.5 align-middle rounded-sm" />
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-bg-surface flex items-center justify-center mt-0.5 border border-border">
          <User size={13} className="text-text-secondary" />
        </div>
      )}
    </div>
  );
}
