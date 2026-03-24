"use client";

import React, { Component, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./CodeBlock";


interface MarkdownContentProps {
  content: string;
  compact?: boolean;
  conversationId?: string;
}

/**
 * Error boundary that catches DOM reconciliation errors (e.g. "insertBefore")
 * from ReactMarkdown/KaTeX and recovers by forcing a clean remount.
 */
class MarkdownErrorBoundary extends Component<
  { children: React.ReactNode; fallbackKey: string },
  { hasError: boolean; errorCount: number }
> {
  state = { hasError: false, errorCount: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { fallbackKey: string }) {
    // When content changes (new fallbackKey), clear the error state so
    // the component re-renders with the updated content.
    if (prevProps.fallbackKey !== this.props.fallbackKey && this.state.hasError) {
      this.setState({ hasError: false, errorCount: this.state.errorCount + 1 });
    }
  }

  render() {
    if (this.state.hasError) {
      // Return nothing briefly — componentDidUpdate will clear on next content change
      return null;
    }
    return this.props.children;
  }
}

/**
 * Shared markdown renderer used in all chat surfaces:
 * main thread, tangent popover, and saved tangent history viewer.
 * Supports GFM (tables, strikethrough, etc.), math via KaTeX,
 * and interactive Python code blocks.
 */
export function MarkdownContent({
  content,
  compact,
  conversationId,
}: MarkdownContentProps) {
  // During streaming, markdown structure can change dramatically (e.g. a heading
  // appears, code fences open/close). React's DOM reconciliation can fail when
  // ReactMarkdown's parse tree shifts. We force a clean remount when the block
  // structure changes to avoid "insertBefore" errors.
  const structureKey = useMemo(() => {
    const fences = (content.match(/```/g) || []).length;
    const headings = (content.match(/^#{1,6}\s/gm) || []).length;
    return `${fences}-${headings}`;
  }, [content]);

  return (
    <MarkdownErrorBoundary fallbackKey={structureKey}>
    <div className={compact ? "prose-twix-sm" : "prose-twix"}>
      <ReactMarkdown
        key={structureKey}
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
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
          a({ href, children }) {
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
    </MarkdownErrorBoundary>
  );
}
