"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders bot chat messages as markdown, styled to match the app's
 * Claude beige theme. Bot bubbles are light (bg-claude-bg), so text uses
 * claude-text / claude-muted with accent emphasis.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => <p className="mb-1.5 last:mb-0">{c}</p>,
        strong: ({ children: c }) => (
          <strong className="font-semibold text-claude-text">{c}</strong>
        ),
        em: ({ children: c }) => <em className="italic">{c}</em>,
        ul: ({ children: c }) => (
          <ul className="mb-1.5 list-disc space-y-0.5 pl-4 last:mb-0">{c}</ul>
        ),
        ol: ({ children: c }) => (
          <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{c}</ol>
        ),
        li: ({ children: c }) => <li className="leading-snug">{c}</li>,
        h1: ({ children: c }) => (
          <h1 className="mb-1 mt-1 text-sm font-semibold text-claude-text first:mt-0">{c}</h1>
        ),
        h2: ({ children: c }) => (
          <h2 className="mb-1 mt-1 text-sm font-semibold text-claude-text first:mt-0">{c}</h2>
        ),
        h3: ({ children: c }) => (
          <h3 className="mb-1 mt-1 text-[13px] font-semibold text-claude-text first:mt-0">{c}</h3>
        ),
        a: ({ href, children: c }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-claude-accent underline decoration-claude-accent/40 hover:decoration-claude-accent"
          >
            {c}
          </a>
        ),
        code: ({ children: c }) => (
          <code className="rounded bg-claude-border/30 px-1 py-0.5 font-mono text-[12px]">
            {c}
          </code>
        ),
        pre: ({ children: c }) => (
          <pre className="mb-1.5 overflow-x-auto rounded-lg bg-claude-bg px-2.5 py-2 text-[12px] last:mb-0">
            {c}
          </pre>
        ),
        blockquote: ({ children: c }) => (
          <blockquote className="mb-1.5 border-l-2 border-claude-accent/40 pl-2 text-claude-muted last:mb-0">
            {c}
          </blockquote>
        ),
        table: ({ children: c }) => (
          <div className="mb-1.5 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-[12px]">{c}</table>
          </div>
        ),
        th: ({ children: c }) => (
          <th className="border border-claude-border bg-claude-bg px-2 py-1 text-left font-semibold">
            {c}
          </th>
        ),
        td: ({ children: c }) => (
          <td className="border border-claude-border px-2 py-1">{c}</td>
        ),
        hr: () => <hr className="my-1.5 border-claude-border" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
