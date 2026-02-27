"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CodeEditor } from "./CodeEditor";

interface FileEntry {
  name: string;
  type: string;
}

interface FileExplorerProps {
  rootPath: string;
  conversationId: string;
  compact?: boolean;
  drawer?: boolean;
}

// ── Module-level cache ──────────────────────────────────────────────
// Survives component remounts caused by ReactMarkdown re-rendering
// during streaming. Keyed by "conversationId:path".
const globalDirCache = new Map<string, FileEntry[]>();
const globalInFlight = new Set<string>();

function cacheKey(conversationId: string, path: string) {
  return `${conversationId}:${path}`;
}

// Infer language from file extension for syntax highlighting
function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    rs: "rust",
    go: "go",
    java: "java",
    rb: "ruby",
    php: "php",
    c: "c",
    cpp: "cpp",
    h: "c",
    toml: "toml",
    xml: "xml",
    svg: "xml",
  };
  return map[ext] || "";
}

// File icon color based on extension (VS Code-like)
function getFileColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const colors: Record<string, string> = {
    ts: "#3178C6",
    tsx: "#3178C6",
    js: "#F7DF1E",
    jsx: "#F7DF1E",
    py: "#3776AB",
    json: "#A8B065",
    md: "#519ABA",
    css: "#563D7C",
    scss: "#CF649A",
    html: "#E34F26",
    yml: "#CB171E",
    yaml: "#CB171E",
    sh: "#89E051",
    bash: "#89E051",
    sql: "#E38C00",
    rs: "#DEA584",
    go: "#00ADD8",
    java: "#B07219",
    rb: "#CC342D",
    php: "#777BB4",
    c: "#555555",
    cpp: "#F34B7D",
    h: "#555555",
    toml: "#9C4121",
    xml: "#E34F26",
    svg: "#FFB13B",
    lock: "#6B6B5F",
    env: "#ECD53F",
    gitignore: "#F05032",
  };
  return colors[ext] || "#8B8B7A";
}

export function FileExplorer({
  rootPath,
  conversationId,
  compact,
  drawer,
}: FileExplorerProps) {
  // Local render state — initialized from global cache
  const [dirCache, setDirCache] = useState<Map<string, FileEntry[]>>(() => {
    // Hydrate from global cache on mount
    const initial = new Map<string, FileEntry[]>();
    for (const [key, entries] of globalDirCache) {
      if (key.startsWith(conversationId + ":")) {
        const path = key.slice(conversationId.length + 1);
        initial.set(path, entries);
      }
    }
    return initial;
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    content: string;
  } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanRoot = rootPath.trim();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch directory contents — uses global cache to prevent duplicate requests
  const fetchDir = useCallback(
    async (path: string) => {
      const key = cacheKey(conversationId, path);

      // Already cached or in-flight — skip
      if (globalDirCache.has(key) || globalInFlight.has(key)) {
        // If cached but not in local state, sync it
        if (globalDirCache.has(key) && !dirCache.has(path)) {
          setDirCache((prev) =>
            new Map(prev).set(path, globalDirCache.get(key)!)
          );
        }
        return;
      }

      globalInFlight.add(key);
      setLoading((prev) => new Set(prev).add(path));

      try {
        const res = await fetch(
          `/api/sandbox/${conversationId}/files?path=${encodeURIComponent(path)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.type === "directory") {
          globalDirCache.set(key, data.entries);
          if (mountedRef.current) {
            setDirCache((prev) => new Map(prev).set(path, data.entries));
          }
        }
      } catch (err) {
        if (mountedRef.current && path === cleanRoot) {
          setError(
            err instanceof Error ? err.message : "Failed to load directory"
          );
        }
      } finally {
        globalInFlight.delete(key);
        if (mountedRef.current) {
          setLoading((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, cleanRoot]
  );

  // Fetch root directory on mount
  useEffect(() => {
    const key = cacheKey(conversationId, cleanRoot);
    if (!globalDirCache.has(key)) {
      fetchDir(cleanRoot);
    }
  }, [cleanRoot, conversationId, fetchDir]);

  // Toggle directory expansion
  const toggleDir = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          fetchDir(path);
        }
        return next;
      });
    },
    [fetchDir]
  );

  // Open a file
  const openFile = useCallback(
    async (path: string) => {
      setFileLoading(true);
      try {
        const res = await fetch(
          `/api/sandbox/${conversationId}/files?path=${encodeURIComponent(path)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.type === "file") {
          setSelectedFile({ path, content: data.content });
        }
      } catch {
        setSelectedFile({ path, content: "(Failed to load file)" });
      } finally {
        setFileLoading(false);
      }
    },
    [conversationId]
  );

  const handleCopy = useCallback(async () => {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedFile]);

  // Render a single tree node
  const renderEntry = (
    entry: FileEntry,
    parentPath: string,
    depth: number
  ) => {
    const fullPath =
      parentPath === "/" ? `/${entry.name}` : `${parentPath}/${entry.name}`;
    const isDir = entry.type === "dir" || entry.type === "directory";
    const isExpanded = expanded.has(fullPath);
    const isLoading = loading.has(fullPath);
    const isSelected = selectedFile?.path === fullPath;

    return (
      <div key={fullPath}>
        <button
          onClick={() => (isDir ? toggleDir(fullPath) : openFile(fullPath))}
          className="flex w-full items-center gap-1 text-left text-[13px] leading-6 transition-colors hover:bg-white/[0.06]"
          style={{
            paddingLeft: `${depth * 18 + 8}px`,
            paddingRight: 8,
            background: isSelected ? "rgba(255,255,255,0.08)" : undefined,
          }}
        >
          {/* Chevron for directories */}
          <span
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 16, height: 16 }}
          >
            {isDir ? (
              isLoading ? (
                <svg
                  className="h-3 w-3 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: "#8B8B7A" }}
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style={{
                    color: "#8B8B7A",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            ) : null}
          </span>

          {/* Icon */}
          <span
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 18, height: 18 }}
          >
            {isDir ? (
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill={isExpanded ? "#E8A854" : "#C4A46C"}
              >
                {isExpanded ? (
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H8.5a2.5 2.5 0 00-2.4 1.8L4 16V6z" />
                ) : (
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                )}
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill={getFileColor(entry.name)}
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </span>

          {/* Name */}
          <span
            className="truncate ml-1"
            style={{
              color: isSelected
                ? "#E8E4DE"
                : isDir
                  ? "#D5D0C8"
                  : "#B0ACA4",
            }}
          >
            {entry.name}
          </span>
        </button>

        {/* Render children if expanded */}
        {isDir && isExpanded && dirCache.has(fullPath) && (
          <div>
            {dirCache.get(fullPath)!.map((child) =>
              renderEntry(child, fullPath, depth + 1)
            )}
            {dirCache.get(fullPath)!.length === 0 && (
              <div
                className="text-xs italic leading-6"
                style={{
                  paddingLeft: `${(depth + 1) * 18 + 44}px`,
                  color: "#6B6B5F",
                }}
              >
                (empty)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootEntries = dirCache.get(cleanRoot);
  const rootName = cleanRoot.split("/").filter(Boolean).pop() || cleanRoot;

  return (
    <div
      className={drawer ? "flex flex-col h-full" : "my-3 overflow-hidden rounded-lg border"}
      style={drawer ? {} : { borderColor: "var(--color-border)" }}
    >
      {/* Header bar — only in inline mode (drawer has its own header) */}
      {!drawer && (
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{ background: "#2A2926", color: "#A8A29E" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className="h-3.5 w-3.5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
            </svg>
            <span className="text-xs font-medium truncate">{rootName}</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded px-2 py-0.5 text-xs transition-colors hover:text-white"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      )}

      {/* Tree area */}
      {!collapsed && (
        <div
          className={drawer ? "flex-1 overflow-y-auto py-1" : "overflow-y-auto py-1"}
          style={drawer
            ? { background: "#1E1D1A" }
            : { background: "#1E1D1A", maxHeight: compact ? "250px" : "400px" }
          }
        >
          {error && (
            <div className="px-3 py-2 text-xs" style={{ color: "#EF4444" }}>
              {error}
            </div>
          )}

          {!rootEntries && !error && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs"
              style={{ color: "#A8A29E" }}
            >
              <svg
                className="h-3.5 w-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading...
            </div>
          )}

          {rootEntries &&
            rootEntries.map((entry) => renderEntry(entry, cleanRoot, 0))}
        </div>
      )}

      {/* File content viewer */}
      {selectedFile && !collapsed && (
        <div
          className={drawer ? "flex-shrink-0" : ""}
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ background: "#2A2926", color: "#A8A29E" }}
          >
            <span className="text-xs font-medium truncate">
              {selectedFile.path.split("/").pop()}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="rounded px-2 py-0.5 text-xs transition-colors hover:text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setSelectedFile(null)}
                className="rounded px-2 py-0.5 text-xs transition-colors hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
          {fileLoading ? (
            <div
              className="flex items-center justify-center py-8"
              style={{ background: "#1E1D1A" }}
            >
              <span className="text-xs" style={{ color: "#A8A29E" }}>
                Loading file...
              </span>
            </div>
          ) : (
            <div className="overflow-hidden">
              <CodeEditor
                value={selectedFile.content}
                readOnly
                language={getLanguage(selectedFile.path)}
                minHeight="60px"
                maxHeight={drawer ? "350px" : compact ? "200px" : "350px"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
