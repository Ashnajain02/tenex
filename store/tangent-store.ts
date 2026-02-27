import { create } from "zustand";
import type { TangentWindowState } from "@/types";

interface TangentState {
  /** Which conversation the tangent state is scoped to. */
  conversationId: string | null;

  /**
   * Flat list of ALL currently open tangents (the tree nodes).
   * Grows until a tangent is explicitly Closed or Merged.
   */
  openTangents: TangentWindowState[];

  /**
   * Maps parentId ("main" or a threadId) → the threadId of the
   * currently-selected child in the right panel for that parent.
   */
  activeChildByParent: Record<string, string>;

  /**
   * The thread shown in the LEFT panel.
   * "main" = the main thread; otherwise a tangent threadId.
   */
  viewParentId: string;

  /**
   * Replace store state with server-provided tangent data.
   * Called on page load and conversation switch.
   */
  hydrate: (conversationId: string, tangents: TangentWindowState[]) => void;

  /** Clear all tangent state back to defaults. */
  reset: () => void;

  /**
   * Add a new tangent. It immediately becomes the active child of its
   * parent and is shown in the right panel.
   */
  openTangent: (tangent: TangentWindowState) => void;

  /**
   * Permanently close this tangent AND all of its descendants.
   * Adjusts viewParentId and activeChildByParent as needed.
   */
  closeTangent: (threadId: string) => void;

  /**
   * Navigate to a parent panel (view-only — no data is destroyed).
   * Pass "main" to return to the main-thread view.
   */
  navigateTo: (parentId: string) => void;

  /**
   * Switch the active child tab for a given parent.
   * Also sets viewParentId = parentId so the switch is visible.
   */
  setActiveChild: (parentId: string, childId: string) => void;
}

export const useTangentStore = create<TangentState>((set) => ({
  conversationId: null,
  openTangents: [],
  activeChildByParent: {},
  viewParentId: "main",

  hydrate: (conversationId, tangents) =>
    set(() => {
      // Compute activeChildByParent: last entry per parent wins (server sorts by createdAt ASC)
      const activeChildByParent: Record<string, string> = {};
      for (const t of tangents) {
        activeChildByParent[t.parentThreadId] = t.threadId;
      }
      return {
        conversationId,
        openTangents: tangents,
        activeChildByParent,
        viewParentId: "main",
      };
    }),

  reset: () =>
    set({
      conversationId: null,
      openTangents: [],
      activeChildByParent: {},
      viewParentId: "main",
    }),

  openTangent: (tangent) =>
    set((state) => ({
      // Deduplicate: remove any stale entry with this threadId, then append
      openTangents: [
        ...state.openTangents.filter((t) => t.threadId !== tangent.threadId),
        tangent,
      ],
      activeChildByParent: {
        ...state.activeChildByParent,
        [tangent.parentThreadId]: tangent.threadId,
      },
      // Show the new tangent in the right panel immediately
      viewParentId: tangent.parentThreadId,
    })),

  closeTangent: (threadId) =>
    set((state) => {
      // BFS to collect this tangent and all its descendants
      const toRemove = new Set<string>();
      const queue = [threadId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        toRemove.add(id);
        state.openTangents
          .filter((t) => t.parentThreadId === id)
          .forEach((t) => queue.push(t.threadId));
      }

      const newTangents = state.openTangents.filter(
        (t) => !toRemove.has(t.threadId)
      );

      // Rebuild activeChildByParent, fixing up any entries that pointed to removed nodes
      const newActive: Record<string, string> = {};
      for (const [parentId, childId] of Object.entries(
        state.activeChildByParent
      )) {
        if (toRemove.has(parentId)) continue; // parent is gone
        if (toRemove.has(childId)) {
          // Active child is gone — pick any remaining sibling
          const sibling = newTangents.find(
            (t) => t.parentThreadId === parentId
          );
          if (sibling) newActive[parentId] = sibling.threadId;
          // else: no siblings left, leave this parent without an active child
        } else {
          newActive[parentId] = childId;
        }
      }

      // If the current view parent was removed, walk up to the nearest survivor
      let newView = state.viewParentId;
      if (toRemove.has(newView)) {
        let current = newView;
        while (current !== "main" && toRemove.has(current)) {
          const node = state.openTangents.find((t) => t.threadId === current);
          current = node?.parentThreadId ?? "main";
        }
        newView = current;
      }

      // If the view parent survived but now has no active child (we just closed
      // the right-panel tangent), navigate up one level so the layout collapses
      // gracefully (e.g. [T1 | T1a] → close T1a → [Main | T1]).
      if (newView !== "main" && !newActive[newView]) {
        const node = newTangents.find((t) => t.threadId === newView);
        newView = node?.parentThreadId ?? "main";
      }

      return {
        openTangents: newTangents,
        activeChildByParent: newActive,
        viewParentId: newView,
      };
    }),

  navigateTo: (parentId) => set({ viewParentId: parentId }),

  setActiveChild: (parentId, childId) =>
    set((state) => ({
      activeChildByParent: {
        ...state.activeChildByParent,
        [parentId]: childId,
      },
      viewParentId: parentId,
    })),
}));
