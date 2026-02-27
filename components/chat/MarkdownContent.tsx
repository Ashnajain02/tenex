"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./CodeBlock";
import { SandboxPreview } from "./SandboxPreview";

interface MarkdownContentProps {
  content: string;
  compact?: boolean;
  conversationId?: string;
}

/**
 * Shared markdown renderer used in all chat surfaces:
 * main thread, tangent popover, and saved tangent history viewer.
 * Supports GFM (tables, strikethrough, etc.), math via KaTeX,
 * and interactive Python code blocks via E2B.
 */
export function MarkdownContent({
  content,
  compact,
  conversationId,
}: MarkdownContentProps) {
  return (
    <div className={compact ? "prose-twix-sm" : "prose-twix"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Override block code rendering to inject CodeBlock with Run button
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            // Inline code (no className) → render default
            if (!className) {
              return <code className={className}>{children}</code>;
            }

            const codeString = String(children).replace(/\n$/, "");

            return (
              <CodeBlock
                code={codeString}
                language={language}
                conversationId={conversationId || ""}
                compact={compact}
              />
            );
          },
          // Avoid double <pre> wrapping — CodeBlock renders its own <pre>
          pre({ children }) {
            return <>{children}</>;
          },
          // Detect E2B sandbox URLs and render an inline preview iframe
          a({ href, children }) {
            if (href && /\be2b[.-]/.test(href)) {
              return <SandboxPreview url={href} />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
