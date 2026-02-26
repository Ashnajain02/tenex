"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./CodeEditor";
import {
  CodeExecutionResult,
  type ExecutionResultData,
} from "./CodeExecutionResult";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  compact?: boolean;
  placeholder?: string;
  conversationId?: string;
}

export function ChatInput({
  onSend,
  isLoading,
  compact,
  placeholder,
  conversationId,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [codeResult, setCodeResult] = useState<ExecutionResultData | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput("");
    setCodeResult(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Only used in chat mode (textarea)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleInput() {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
    }
  }

  const handleRunCode = useCallback(async () => {
    if (isRunning || !conversationId || !input.trim()) return;
    setIsRunning(true);
    setCodeResult(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, code: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeResult({
          stdout: "",
          stderr: "",
          textResults: "",
          images: [],
          error: {
            name: "ExecutionError",
            message: data.error || `HTTP ${res.status}`,
            traceback: "",
          },
        });
      } else {
        setCodeResult(data);
      }
    } catch {
      setCodeResult({
        stdout: "",
        stderr: "",
        textResults: "",
        images: [],
        error: {
          name: "Error",
          message: "Execution failed",
          traceback: "",
        },
      });
    } finally {
      setIsRunning(false);
    }
  }, [conversationId, input, isRunning]);

  // -- Compact variant (tangent panels) --
  if (compact) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 px-3 py-2"
        style={{
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-bg-base)",
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Reply…"}
            rows={1}
            className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              border: "1px solid var(--color-border)",
              background: "white",
              color: "var(--color-text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "white" }}
            onMouseEnter={(e) => {
              if (!isLoading && input.trim())
                e.currentTarget.style.background =
                  "var(--color-accent-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-accent)";
            }}
          >
            {isLoading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
    );
  }

  // -- Standard variant --
  return (
    <div
      className="flex-shrink-0 py-4"
      style={{
        background: "var(--color-bg-base)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div className="mx-auto w-full max-w-2xl px-4">
        {isCodeMode ? (
          /* ── IDE Code Mode ── */
          <div>
            <div
              className="overflow-hidden rounded-xl"
              style={{
                border: "1px solid var(--color-accent)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {/* IDE Toolbar */}
              <div
                className="flex items-center justify-between px-3 py-1.5"
                style={{ background: "#2A2926", color: "#A8A29E" }}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCodeMode(false);
                      setCodeResult(null);
                    }}
                    className="rounded p-1 transition-colors hover:text-white"
                    title="Switch to chat"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 18l6-6-6-6M8 6l-6 6 6 6"
                      />
                    </svg>
                  </button>
                  <span className="text-xs font-medium">Python</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRunCode}
                    disabled={isRunning || !input.trim()}
                    className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-white transition-colors disabled:opacity-40"
                    style={{ background: "#16A34A" }}
                  >
                    {isRunning ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg
                        className="h-3 w-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                    {isRunning ? "Running" : "Run"}
                  </button>
                </div>
              </div>

              {/* CodeMirror Editor */}
              <CodeEditor
                value={input}
                onChange={setInput}
                language="python"
                minHeight="100px"
                maxHeight="300px"
                onRun={handleRunCode}
                autoFocus
              />

              {/* Execution result inside IDE container */}
              {codeResult && (
                <div style={{ borderTop: "1px solid #2A2926" }}>
                  <CodeExecutionResult result={codeResult} />
                </div>
              )}
            </div>

            <p
              className="mt-1.5 text-center text-[11px]"
              style={{ color: "var(--color-text-muted, #9B9B9B)" }}
            >
              Cmd+Enter to run
            </p>
          </div>
        ) : (
          /* ── Chat Mode ── */
          <form onSubmit={handleSubmit}>
            <div
              className="flex items-end gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "white",
                border: "1px solid var(--color-border)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {/* Code mode toggle */}
              {conversationId && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCodeMode(true);
                    setCodeResult(null);
                  }}
                  className={cn("code-mode-toggle")}
                  title="Switch to code"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 18l6-6-6-6M8 6l-6 6 6 6"
                    />
                  </svg>
                </button>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  handleInput();
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || "Message Tenex…"}
                rows={1}
                className="flex-1 resize-none bg-transparent text-[0.9375rem] leading-relaxed outline-none placeholder:text-gray-400"
                style={{
                  color: "var(--color-text-primary)",
                  maxHeight: "180px",
                }}
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40"
                style={{
                  background: "var(--color-accent)",
                  color: "white",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && input.trim())
                    e.currentTarget.style.background =
                      "var(--color-accent-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--color-accent)";
                }}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            </div>

            <p
              className="mt-1.5 text-center text-[11px]"
              style={{ color: "var(--color-text-muted, #9B9B9B)" }}
            >
              Enter to send · Shift+Enter for new line
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
