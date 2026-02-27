"use client";

import React, { Component, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./CodeBlock";
import { useUIStore } from "@/store/ui-store";

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
 * and interactive Python code blocks via E2B.
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

            // Interactive file explorer for sandbox directories — store path, user opens via button
            if (language === "filetree") {
              // Strip trailing backticks/whitespace that markdown parser may include
              const cleanPath = codeString.replace(/`+/g, "").trim();
              const store = useUIStore.getState();
              if (store.fileBrowserPath !== cleanPath) {
                store.setFileBrowserPath(cleanPath);
              }
              return (
                <button
                  onClick={() => {
                    useUIStore.getState().openDrawerTo("files");
                  }}
                  className="my-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:opacity-80"
                  style={{
                    background: "var(--color-bg-sidebar)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
                  </svg>
                  File browser available — click to open
                </button>
              );
            }

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
          // Detect E2B sandbox URLs — store preview URL, user opens via button
          a({ href, children }) {
            if (href && /\be2b[.-]/.test(href)) {
              const store = useUIStore.getState();
              if (store.previewUrl !== href) {
                store.setPreviewUrl(href);
              }
              return (
                <button
                  onClick={() => {
                    useUIStore.getState().openDrawerTo("preview");
                  }}
                  className="my-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:opacity-80"
                  style={{
                    background: "var(--color-bg-sidebar)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: "#16A34A" }}
                  />
                  Live preview available — click to open
                </button>
              );
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
    </MarkdownErrorBoundary>
  );
}
