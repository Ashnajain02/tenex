"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MainThread } from "./MainThread";
import { TangentPanel } from "./TangentPanel";
import { useTangentStore } from "@/store/tangent-store";
import { useConversationStore } from "@/store/conversation-store";
import { reconstructTangentState } from "@/lib/tangent-utils";
import type { MergeEvent, TangentWindowState } from "@/types";

interface ChatPageProps {
  conversationId: string;
  mainThreadId: string;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  initialTangents?: TangentWindowState[];
}

export function ChatPage({
  conversationId,
  mainThreadId,
  initialMessages,
  initialTangents,
}: ChatPageProps) {
  const router = useRouter();

  const openTangents = useTangentStore((s) => s.openTangents);
  const activeChildByParent = useTangentStore((s) => s.activeChildByParent);
  const viewParentId = useTangentStore((s) => s.viewParentId);
  const storeConversationId = useTangentStore((s) => s.conversationId);
  const hydrate = useTangentStore((s) => s.hydrate);
  const openTangentAction = useTangentStore((s) => s.openTangent);
  const closeTangent = useTangentStore((s) => s.closeTangent);
  const navigateTo = useTangentStore((s) => s.navigateTo);
  const setActiveChild = useTangentStore((s) => s.setActiveChild);

  const { addConversation } = useConversationStore();

  // Hydrate tangent store from server data on mount or conversation switch.
  // First hydrate from server-provided props (fast SSR path), then fetch
  // fresh data from the API to handle stale RSC payloads from Next.js
  // Router Cache (e.g. navigating back to a conversation after branching).
  useEffect(() => {
    if (storeConversationId !== conversationId) {
      hydrate(conversationId, initialTangents ?? []);
    }

    // Client-side fetch ensures we always have the latest tangent state
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.threads) return;
        const main = data.threads.find(
          (t: { parentThreadId: string | null }) => !t.parentThreadId
        );
        if (!main) return;
        const fresh = reconstructTangentState(data.threads, main.id);
        // Only re-hydrate if the tangent set actually changed
        const currentIds = useTangentStore
          .getState()
          .openTangents.map((t) => t.threadId)
          .sort()
          .join(",");
        const freshIds = fresh
          .map((t) => t.threadId)
          .sort()
          .join(",");
        if (currentIds !== freshIds) {
          hydrate(conversationId, fresh);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Main-thread state
  const [mergeEvents, setMergeEvents] = useState<MergeEvent[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Per-tangent state — keyed by threadId
  const [threadMergeEvents, setThreadMergeEvents] = useState<
    Record<string, MergeEvent[]>
  >({});
  const [threadRefreshTriggers, setThreadRefreshTriggers] = useState<
    Record<string, number>
  >({});

  // Fetch merge events for any thread (main or tangent)
  const fetchThreadMergeEvents = useCallback(
    async (threadId: string, isMain: boolean) => {
      try {
        const res = await fetch(`/api/threads/${threadId}`);
        if (!res.ok) return;
        const data = await res.json();
        const events: MergeEvent[] = data.mergesAsTarget || [];
        if (isMain) {
          setMergeEvents(events);
        } else {
          setThreadMergeEvents((prev) => ({ ...prev, [threadId]: events }));
        }
      } catch {
        // silently fail
      }
    },
    []
  );

  useEffect(() => {
    fetchThreadMergeEvents(mainThreadId, true);
  }, [mainThreadId, fetchThreadMergeEvents]);

  // Handle opening a tangent thread
  const handleOpenTangent = useCallback(
    async (
      threadId: string,
      messageId: string,
      selectedText: string,
      _rect: DOMRect
    ) => {
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/threads`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parentThreadId: threadId,
              highlightedText: selectedText,
            }),
          }
        );

        if (!res.ok) return;

        const tangentThread = await res.json();

        openTangentAction({
          threadId: tangentThread.id,
          // Normalize: if the parent is the main thread, use "main" so that
          // viewParentId === "main" checks work correctly in ChatPage.
          parentThreadId: threadId === mainThreadId ? "main" : threadId,
          parentMessageId: messageId,
          highlightedText: selectedText,
          depth: tangentThread.depth,
        });
      } catch {
        // silently fail
      }
    },
    [conversationId, mainThreadId, openTangentAction]
  );

  // Handle merging a tangent
  const handleMerge = useCallback(
    async (threadId: string) => {
      try {
        const res = await fetch(`/api/threads/${threadId}/merge`, {
          method: "POST",
        });

        if (!res.ok) return;

        // Read parent BEFORE closing (store mutation happens in closeTangent)
        const currentTangents = useTangentStore.getState().openTangents;
        const merged = currentTangents.find((t) => t.threadId === threadId);
        const targetThreadId = merged?.parentThreadId ?? null;

        closeTangent(threadId);

        if (!targetThreadId || targetThreadId === "main" || targetThreadId === mainThreadId) {
          fetchThreadMergeEvents(mainThreadId, true);
          setRefreshTrigger((n) => n + 1);
        } else {
          fetchThreadMergeEvents(targetThreadId, false);
          setThreadRefreshTriggers((prev) => ({
            ...prev,
            [targetThreadId]: (prev[targetThreadId] ?? 0) + 1,
          }));
        }
      } catch {
        // silently fail
      }
    },
    [closeTangent, mainThreadId, fetchThreadMergeEvents]
  );

  // Handle branching a tangent into its own standalone conversation
  const handleBranch = useCallback(
    async (threadId: string) => {
      try {
        const res = await fetch(`/api/threads/${threadId}/branch`, {
          method: "POST",
        });

        if (!res.ok) return;

        const { conversation } = await res.json();

        // Archive the thread in DB so it doesn't reappear as an open tangent
        await fetch(`/api/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ARCHIVED" }),
        }).catch(() => {});

        addConversation(conversation);
        closeTangent(threadId);
        router.push(`/c/${conversation.id}`);
      } catch {
        // silently fail
      }
    },
    [closeTangent, addConversation, router]
  );

  // Handle explicitly closing a tangent (X button) — archives in DB + removes from store
  const handleClose = useCallback(
    async (threadId: string) => {
      try {
        await fetch(`/api/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ARCHIVED" }),
        });
      } catch {
        // If API fails, still close locally. Thread reappears on next load (fail-open).
      }
      closeTangent(threadId);
    },
    [closeTangent]
  );

  // ── Panel computation ──────────────────────────────────────────────────────
  const tangentMap = new Map(openTangents.map((t) => [t.threadId, t]));

  // Right panel: the active child of the left panel
  const activeChildId = activeChildByParent[viewParentId];
  const rightTangent = activeChildId ? tangentMap.get(activeChildId) : undefined;

  // Sibling tabs for the right panel (all children of the left panel)
  const rightSiblings = openTangents.filter(
    (t) => t.parentThreadId === viewParentId
  );

  // activeChildMessageId for the right panel connector (shown in the LEFT panel)
  const leftActiveChildMessageId = rightTangent?.parentMessageId;

  // activeChildMessageId for the main thread — always track its active child
  // so the connector is ready when Main comes back into view
  const mainActiveChildTangent = tangentMap.get(
    activeChildByParent["main"] ?? ""
  );
  const mainActiveChildMessageId = mainActiveChildTangent?.parentMessageId;
  const mainActiveChildHighlightedText = mainActiveChildTangent?.highlightedText;
  const leftActiveChildHighlightedText = rightTangent?.highlightedText;

  // ── Breadcrumb computation ─────────────────────────────────────────────────
  // 1. Walk UP from viewParentId → "main" to build the left-side path.
  // 2. Then walk DOWN the activeChildByParent chain to show the full depth.
  // This ensures ALL open tangents (not just the visible pair) appear in the
  // breadcrumb and are navigable even after clicking "back".
  const breadcrumbPath: Array<{
    id: string;
    parentId: string | null;
    label: string;
  }> = (() => {
    const pathIds: string[] = [];

    // Walk up from viewParentId to "main"
    let cur = viewParentId;
    const upVisited = new Set<string>();
    while (cur !== "main" && !upVisited.has(cur)) {
      upVisited.add(cur);
      if (!tangentMap.has(cur)) break; // guard against stale viewParentId
      pathIds.unshift(cur);
      const node = tangentMap.get(cur);
      cur = node?.parentThreadId ?? "main";
    }
    pathIds.unshift("main");

    // Walk DOWN the activeChildByParent chain from the deepest visible node
    // This reveals tangents deeper than the current view (e.g. t1a when viewing [main|t1])
    const lastVisible = pathIds[pathIds.length - 1]; // "main" or the deepest upstream node
    let deepCur = activeChildByParent[lastVisible];
    const downVisited = new Set<string>(upVisited);
    while (deepCur && tangentMap.has(deepCur) && !downVisited.has(deepCur)) {
      downVisited.add(deepCur);
      pathIds.push(deepCur);
      deepCur = activeChildByParent[deepCur];
    }

    return pathIds.map((id, idx) => {
      const parentId = idx === 0 ? null : pathIds[idx - 1];
      const tangent = tangentMap.get(id);
      const label =
        id === "main"
          ? "Main"
          : `"${tangent!.highlightedText.slice(0, 24)}${
              tangent!.highlightedText.length > 24 ? "…" : ""
            }"`;
      return { id, parentId, label };
    });
  })();

  const handleBreadcrumbClick = useCallback(
    (item: { id: string; parentId: string | null }) => {
      if (item.id === "main") {
        navigateTo("main");
      } else {
        // If this tangent has an active child (i.e. there are deeper tangents),
        // zoom in so it becomes the left panel.
        // If it has no children, do nothing — it's already visible as the right panel.
        const activeChildId = activeChildByParent[item.id];
        const hasActiveChild =
          !!activeChildId &&
          openTangents.some((t) => t.threadId === activeChildId);
        if (hasActiveChild) {
          navigateTo(item.id);
        }
      }
    },
    [navigateTo, activeChildByParent, openTangents]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb — only when tangents are open */}
      {openTangents.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-1 px-4 py-2 overflow-x-auto"
          style={{
            background: "var(--color-bg-sidebar)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {breadcrumbPath.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-1 flex-shrink-0"
            >
              {idx > 0 && (
                <svg
                  className="h-3 w-3 flex-shrink-0"
                  style={{ color: "var(--color-text-secondary)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              <button
                onClick={() => handleBreadcrumbClick(item)}
                className="rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
                style={{
                  color:
                    idx === breadcrumbPath.length - 1
                      ? "var(--color-accent)"
                      : "var(--color-text-secondary)",
                  background:
                    idx === breadcrumbPath.length - 1
                      ? "rgba(249,115,22,0.1)"
                      : "transparent",
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Panel area — all panels are always mounted; only 2 are visible at a time.
          Using CSS display:none instead of conditional rendering preserves useChat
          state (messages, streaming status) when a panel shifts out of view. */}
      <div className="flex flex-1 min-h-0">
        {/* Main thread — always mounted */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "column",
            height: "100%",
            display: viewParentId === "main" ? "flex" : "none",
          }}
        >
          <MainThread
            threadId={mainThreadId}
            conversationId={conversationId}
            mergeEvents={mergeEvents}
            activeChildMessageId={mainActiveChildMessageId}
            activeHighlightedText={mainActiveChildHighlightedText}
            onOpenTangent={handleOpenTangent}
            initialMessages={initialMessages}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Tangent panels — each mounted once when added to openTangents */}
        {openTangents.map((tangent) => {
          const isLeft = tangent.threadId === viewParentId;
          const isRight = tangent.threadId === rightTangent?.threadId;
          const isVisible = isLeft || isRight;

          return (
            <div
              key={tangent.threadId}
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: "column",
                height: "100%",
                display: isVisible ? "flex" : "none",
              }}
            >
              <TangentPanel
                tangent={tangent}
                conversationId={conversationId}
                activeChildMessageId={isLeft ? leftActiveChildMessageId : undefined}
                activeHighlightedText={isLeft ? leftActiveChildHighlightedText : undefined}
                siblings={isRight ? rightSiblings : undefined}
                onSelectSibling={
                  isRight
                    ? (id) => setActiveChild(viewParentId, id)
                    : undefined
                }
                refreshTrigger={threadRefreshTriggers[tangent.threadId]}
                mergeEvents={threadMergeEvents[tangent.threadId]}
                onOpenTangent={handleOpenTangent}
                onMerge={handleMerge}
                onBranch={handleBranch}
                onClose={handleClose}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
