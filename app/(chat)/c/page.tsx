"use client";

import { useRouter } from "next/navigation";

export default function ChatHomePage() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Tenex
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Start a new conversation from the sidebar, or select an existing one.
        </p>
        <button
          onClick={async () => {
            const res = await fetch("/api/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            if (res.ok) {
              const { conversation } = await res.json();
              router.push(`/c/${conversation.id}`);
            }
          }}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: "var(--color-accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-accent)")}
        >
          New conversation
        </button>
      </div>
    </div>
  );
}
