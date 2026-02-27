"use client";

import { useState, useCallback, useEffect } from "react";
import { CodeEditor } from "./CodeEditor";
import {
  CodeExecutionResult,
  type ExecutionResultData,
} from "./CodeExecutionResult";

interface CodeBlockProps {
  code: string;
  language: string;
  conversationId: string;
  compact?: boolean;
}

export function CodeBlock({
  code,
  language,
  conversationId,
  compact,
}: CodeBlockProps) {
  const [editedCode, setEditedCode] = useState(code);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [result, setResult] = useState<ExecutionResultData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPython = language === "python" || language === "py";
  const isEdited = editedCode !== code;

  // Sync from prop during AI streaming (until user edits)
  useEffect(() => {
    if (!hasUserEdited) {
      setEditedCode(code);
    }
  }, [code, hasUserEdited]);

  const handleChange = useCallback((val: string) => {
    setEditedCode(val);
    setHasUserEdited(true);
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning || !conversationId) return;
    setIsRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, code: editedCode }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setResult({
          stdout: "",
          stderr: "",
          textResults: "",
          images: [],
          error: {
            name: "ExecutionError",
            message: errData.error || `HTTP ${res.status}`,
            traceback: "",
          },
        });
        return;
      }

      setResult(await res.json());
    } catch (err: unknown) {
      setResult({
        stdout: "",
        stderr: "",
        textResults: "",
        images: [],
        error: {
          name: "NetworkError",
          message:
            err instanceof Error ? err.message : "Failed to execute code",
          traceback: "",
        },
      });
    } finally {
      setIsRunning(false);
    }
  }, [conversationId, editedCode, isRunning]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(editedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedCode]);

  const handleReset = useCallback(() => {
    setEditedCode(code);
    setHasUserEdited(false);
    setResult(null);
  }, [code]);

  return (
    <div style={{ margin: compact ? "0.5em 0" : "0.75em 0" }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between rounded-t-lg px-3 py-2"
        style={{ background: "var(--color-code-toolbar)", color: "var(--color-code-muted)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{language || "code"}</span>
          {isEdited && (
            <span
              className="text-xs"
              style={{ color: "var(--color-accent)" }}
            >
              (edited)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isEdited && (
            <button
              onClick={handleReset}
              className="rounded-md px-2.5 py-1 text-xs transition-colors hover:text-white"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded-md px-2.5 py-1 text-xs transition-colors hover:text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>

          {isPython && conversationId && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--color-success)", color: "white" }}
            >
              {isRunning ? "Running..." : "Run"}
            </button>
          )}
        </div>
      </div>

      {/* Editable code editor */}
      <div className="overflow-hidden rounded-b-lg">
        <CodeEditor
          value={editedCode}
          onChange={handleChange}
          language={language}
          minHeight={compact ? "60px" : "80px"}
          maxHeight={compact ? "200px" : "400px"}
          onRun={isPython && conversationId ? handleRun : undefined}
        />
      </div>

      {/* Execution result */}
      {result && <CodeExecutionResult result={result} compact={compact} />}
    </div>
  );
}
