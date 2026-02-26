"use client";

import { ConversationSidebar } from "@/components/layout/ConversationSidebar";
import { useUIStore } from "@/store/ui-store";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div className="flex h-screen" style={{ background: "var(--color-bg-base)" }}>
      <ConversationSidebar />

      {/* Floating toggle — only visible when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed left-3 top-3 z-40 flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
          style={{
            background: "var(--color-bg-sidebar)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#E8E4DD")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-sidebar)")}
          title="Open sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
