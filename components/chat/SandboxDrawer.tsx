"use client";

import { useState, useCallback } from "react";
import { useUIStore } from "@/store/ui-store";
import { FileExplorer } from "./FileExplorer";

interface SandboxDrawerProps {
  conversationId: string;
}

export function SandboxDrawer({ conversationId }: SandboxDrawerProps) {
  const drawerTab = useUIStore((s) => s.drawerTab);
  const setDrawerOpen = useUIStore((s) => s.setDrawerOpen);
  const fileBrowserPath = useUIStore((s) => s.fileBrowserPath);
  const previewUrl = useUIStore((s) => s.previewUrl);

  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  }, []);

  const hasFiles = !!fileBrowserPath;
  const hasPreview = !!previewUrl;
  const showingFiles = drawerTab === "files" && hasFiles;
  const showingPreview = drawerTab === "preview" && hasPreview;

  const title = showingFiles
    ? fileBrowserPath!.split("/").filter(Boolean).pop() || "Files"
    : "Preview";

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--color-code-bg)" }}
    >
      {/* Header — title + actions + close */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 py-2"
        style={{
          background: "var(--color-bg-sidebar)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {showingFiles && (
            <svg
              className="h-3.5 w-3.5 flex-shrink-0"
              style={{ color: "var(--color-text-muted)" }}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          )}
          {showingPreview && (
            <div
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: "var(--color-success)" }}
            />
          )}
          <span
            className="text-xs font-medium truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {showingPreview && (
            <>
              <button
                onClick={handleRefresh}
                className="rounded p-1 transition-colors hover:opacity-80"
                style={{ color: "var(--color-text-secondary)" }}
                title="Refresh"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <a
                href={previewUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 transition-colors hover:opacity-80"
                style={{ color: "var(--color-text-secondary)" }}
                title="Open in new tab"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </>
          )}
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded p-1 transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-secondary)" }}
            title="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {/* URL bar for preview */}
      {showingPreview && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1 text-xs"
          style={{
            background: "var(--color-bg-sidebar)",
            borderBottom: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: "var(--color-success)" }}
          />
          <span className="truncate">{previewUrl}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showingFiles && (
          <FileExplorer
            rootPath={fileBrowserPath!}
            conversationId={conversationId}
            drawer
          />
        )}

        {showingPreview && (
          <div className="relative h-full">
            {isLoading && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "var(--color-code-bg)" }}
              >
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
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
              src={previewUrl!}
              title="Sandbox Preview"
              className="h-full w-full border-0"
              style={{ background: "#fff" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
