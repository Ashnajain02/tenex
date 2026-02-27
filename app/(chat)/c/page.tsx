"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ChatHomePage() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 opacity-50" />
          <h1 className="text-xl font-medium tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            twix
          </h1>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
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
          className="mt-6 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
          style={{
            background: "transparent",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-accent-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          New conversation
        </button>
      </div>
    </div>
  );
}
