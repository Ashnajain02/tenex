"use client";

export interface ExecutionResultData {
  stdout: string;
  stderr: string;
  textResults: string;
  images: Array<{ format: "png" | "jpeg" | "svg"; data: string }>;
  error: { name: string; message: string; traceback: string } | null;
}

interface CodeExecutionResultProps {
  result: ExecutionResultData;
  compact?: boolean;
}

export function CodeExecutionResult({
  result,
  compact,
}: CodeExecutionResultProps) {
  const output = result.textResults || result.stdout;
  const hasOutput = !!output;
  const hasWarning = result.stderr && !result.error;

  return (
    <div
      className={compact ? "mt-1.5 text-xs" : "mt-2 text-sm"}
      style={{
        borderTop: "1px solid var(--color-border)",
        paddingTop: compact ? "6px" : "8px",
      }}
    >
      {/* Success output */}
      {hasOutput && (
        <pre
          className="overflow-x-auto rounded-md p-2.5 whitespace-pre-wrap break-words"
          style={{
            background: "var(--color-bg-sidebar)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: compact ? "0.78em" : "0.85em",
            lineHeight: 1.5,
          }}
        >
          {output}
        </pre>
      )}

      {/* Stderr warnings (non-fatal) */}
      {hasWarning && (
        <pre
          className="overflow-x-auto rounded-md p-2.5 mt-1.5 whitespace-pre-wrap"
          style={{
            background: "#FFFBEB",
            color: "#92400E",
            fontFamily: "var(--font-mono), monospace",
            fontSize: compact ? "0.75em" : "0.8em",
          }}
        >
          {result.stderr}
        </pre>
      )}

      {/* Error */}
      {result.error && (
        <pre
          className="overflow-x-auto rounded-md p-2.5 mt-1.5 whitespace-pre-wrap"
          style={{
            background: "#FEF2F2",
            color: "#991B1B",
            fontFamily: "var(--font-mono), monospace",
            fontSize: compact ? "0.75em" : "0.8em",
          }}
        >
          {result.error.name}: {result.error.message}
          {result.error.traceback ? `\n\n${result.error.traceback}` : ""}
        </pre>
      )}

      {/* Images (matplotlib charts, etc.) */}
      {result.images.map((img, idx) => (
        <div key={idx} className="mt-2">
          {img.format === "svg" ? (
            <div
              className="rounded-md overflow-hidden"
              dangerouslySetInnerHTML={{ __html: img.data }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/${img.format};base64,${img.data}`}
              alt={`Output ${idx + 1}`}
              className="rounded-md max-w-full"
              style={{ maxHeight: compact ? "200px" : "400px" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
