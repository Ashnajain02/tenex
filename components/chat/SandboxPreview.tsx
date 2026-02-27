"use client";

import { useState, useCallback } from "react";

interface SandboxPreviewProps {
  url: string;
}

export function SandboxPreview({ url }: SandboxPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  return (
    <div
      className="my-3 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs"
        style={{
          background: "var(--color-bg-sidebar)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: "#16A34A" }}
          />
          <span
            className="truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {url}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="rounded p-1 transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-secondary)" }}
            title="Refresh preview"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-secondary)" }}
            title="Open in new tab"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Iframe */}
      <div className="relative" style={{ height: 500 }}>
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "var(--color-bg-base)" }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading preview...
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={url}
          title="Sandbox Preview"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
