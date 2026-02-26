"use client";

import { useState, useEffect, useCallback } from "react";

interface SandboxStatusProps {
  conversationId: string;
}

export function SandboxStatus({ conversationId }: SandboxStatusProps) {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const checkSandbox = useCallback(async () => {
    try {
      const res = await fetch(`/api/sandbox/${conversationId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.active && data.sandboxId) {
        setSandboxId(data.sandboxId);
      } else {
        setSandboxId(null);
      }
    } catch {
      // ignore
    }
  }, [conversationId]);

  useEffect(() => {
    checkSandbox();
    const interval = setInterval(checkSandbox, 15_000);
    return () => clearInterval(interval);
  }, [checkSandbox]);

  if (!sandboxId) return null;

  const vsCodeLink = `vscode://bhavaniravi.e2b-sandbox-explorer/connect?sandboxId=${sandboxId}`;

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 text-xs"
      style={{
        background: "var(--color-bg-sidebar)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ background: "#16A34A" }}
        />
        <span style={{ color: "var(--color-text-secondary)" }}>
          Sandbox active
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(sandboxId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded px-2 py-0.5 transition-colors hover:opacity-80"
          style={{
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border)",
          }}
        >
          {copied ? "Copied!" : "Copy ID"}
        </button>

        <a
          href={vsCodeLink}
          className="flex items-center gap-1 rounded px-2 py-0.5 font-medium text-white transition-colors hover:opacity-90"
          style={{ background: "#007ACC" }}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.583 2.603L12.2 7.575 7.637 4.3 2 6.788v10.424l5.637 2.488 4.563-3.275 5.383 4.972L24 18.203V5.797l-6.417-3.194zM7.637 14.738L4.5 12l3.137-2.738v5.476zm9.946 2.476L12.2 12l5.383-5.214v10.428z" />
          </svg>
          Open in VS Code
        </a>
      </div>
    </div>
  );
}
