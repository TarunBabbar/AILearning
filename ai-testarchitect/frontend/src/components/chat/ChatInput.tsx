"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, disabled, placeholder }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      <div className="flex gap-2 items-end border border-border-input rounded-2xl bg-bg-input px-4 py-2 shadow-sm focus-within:border-border-focus focus-within:ring-1 focus-within:ring-amber-600/20 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask QA Copilot..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent py-1.5 text-[15px] text-text-primary placeholder-text-muted focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={cn(
            "shrink-0 rounded-full p-2 mb-0.5 transition-colors",
            value.trim() && !disabled
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-[#e6dfd1] text-text-muted cursor-not-allowed"
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
