import { describe, it, expect, beforeEach } from "vitest";
import { useTangentStore } from "../tangent-store";
import type { TangentWindowState } from "@/types";

function makeTangent(overrides: Partial<TangentWindowState> = {}): TangentWindowState {
  return {
    threadId: "t1",
    parentThreadId: "main",
    parentMessageId: "msg1",
    highlightedText: "some text",
    depth: 1,
    ...overrides,
  };
}

describe("tangent-store", () => {
  beforeEach(() => {
    useTangentStore.getState().reset();
  });

  // ── hydrate ──────────────────────────────────────────────────────
  describe("hydrate", () => {
    it("sets conversationId, tangents, and defaults viewParentId to main", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t1a = makeTangent({ threadId: "t1a", parentThreadId: "t1", depth: 2 });

      useTangentStore.getState().hydrate("conv1", [t1, t1a]);
      const state = useTangentStore.getState();

      expect(state.conversationId).toBe("conv1");
      expect(state.openTangents).toEqual([t1, t1a]);
      expect(state.viewParentId).toBe("main");
      expect(state.activeChildByParent).toEqual({ main: "t1", t1: "t1a" });
    });

    it("picks the most recent child per parent (last in array wins)", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t2 = makeTangent({ threadId: "t2", parentThreadId: "main" });

      useTangentStore.getState().hydrate("conv1", [t1, t2]);
      const state = useTangentStore.getState();

      // t2 is later in the array (server sorts by createdAt ASC), so it's active
      expect(state.activeChildByParent["main"]).toBe("t2");
    });

    it("handles empty tangents", () => {
      useTangentStore.getState().hydrate("conv1", []);
      const state = useTangentStore.getState();

      expect(state.conversationId).toBe("conv1");
      expect(state.openTangents).toEqual([]);
      expect(state.activeChildByParent).toEqual({});
      expect(state.viewParentId).toBe("main");
    });
  });

  // ── reset ────────────────────────────────────────────────────────
  describe("reset", () => {
    it("clears all state to defaults", () => {
      useTangentStore.getState().hydrate("conv1", [makeTangent()]);
      useTangentStore.getState().reset();
      const state = useTangentStore.getState();

      expect(state.conversationId).toBeNull();
      expect(state.openTangents).toEqual([]);
      expect(state.activeChildByParent).toEqual({});
      expect(state.viewParentId).toBe("main");
    });
  });

  // ── openTangent ──────────────────────────────────────────────────
  describe("openTangent", () => {
    it("adds a tangent and sets it as active child of its parent", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      useTangentStore.getState().openTangent(t1);
      const state = useTangentStore.getState();

      expect(state.openTangents).toEqual([t1]);
      expect(state.activeChildByParent["main"]).toBe("t1");
      expect(state.viewParentId).toBe("main");
    });

    it("deduplicates if the same threadId is opened again", () => {
      const t1 = makeTangent({ threadId: "t1" });
      useTangentStore.getState().openTangent(t1);
      useTangentStore.getState().openTangent({ ...t1, highlightedText: "updated" });
      const state = useTangentStore.getState();

      expect(state.openTangents).toHaveLength(1);
      expect(state.openTangents[0].highlightedText).toBe("updated");
    });

    it("sets viewParentId to the new tangent's parent", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      useTangentStore.getState().openTangent(t1);

      const t1a = makeTangent({ threadId: "t1a", parentThreadId: "t1", depth: 2 });
      useTangentStore.getState().openTangent(t1a);

      expect(useTangentStore.getState().viewParentId).toBe("t1");
    });
  });

  // ── closeTangent ─────────────────────────────────────────────────
  describe("closeTangent", () => {
    it("removes a single tangent with no children", () => {
      const t1 = makeTangent({ threadId: "t1" });
      useTangentStore.getState().openTangent(t1);
      useTangentStore.getState().closeTangent("t1");

      expect(useTangentStore.getState().openTangents).toEqual([]);
    });

    it("cascades to descendants via BFS", () => {
      // Main → T1 → T1a → T1b
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t1a = makeTangent({ threadId: "t1a", parentThreadId: "t1", depth: 2 });
      const t1b = makeTangent({ threadId: "t1b", parentThreadId: "t1a", depth: 3 });

      useTangentStore.getState().hydrate("conv1", [t1, t1a, t1b]);
      useTangentStore.getState().closeTangent("t1");

      expect(useTangentStore.getState().openTangents).toEqual([]);
    });

    it("only removes the subtree, preserving siblings", () => {
      // Main → T1, Main → T2
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t2 = makeTangent({ threadId: "t2", parentThreadId: "main" });

      useTangentStore.getState().hydrate("conv1", [t1, t2]);
      useTangentStore.getState().closeTangent("t1");

      const state = useTangentStore.getState();
      expect(state.openTangents).toEqual([t2]);
      expect(state.activeChildByParent["main"]).toBe("t2");
    });

    it("picks sibling when active child is removed", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t2 = makeTangent({ threadId: "t2", parentThreadId: "main" });

      useTangentStore.getState().hydrate("conv1", [t1, t2]);
      // t2 is active (last in array). Close t2 → t1 should become active.
      useTangentStore.getState().closeTangent("t2");

      expect(useTangentStore.getState().activeChildByParent["main"]).toBe("t1");
    });

    it("walks viewParentId up when current view is removed", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t1a = makeTangent({ threadId: "t1a", parentThreadId: "t1", depth: 2 });

      useTangentStore.getState().hydrate("conv1", [t1, t1a]);
      // Navigate into t1 so viewParentId = t1
      useTangentStore.getState().navigateTo("t1");
      expect(useTangentStore.getState().viewParentId).toBe("t1");

      // Close t1 (which is the view parent) — should walk up to "main"
      useTangentStore.getState().closeTangent("t1");
      expect(useTangentStore.getState().viewParentId).toBe("main");
    });

    it("collapses view up when right panel is closed and no siblings remain", () => {
      // Main → T1 → T1a, viewing [T1 | T1a], close T1a → should show [Main | T1]
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t1a = makeTangent({ threadId: "t1a", parentThreadId: "t1", depth: 2 });

      useTangentStore.getState().hydrate("conv1", [t1, t1a]);
      useTangentStore.getState().navigateTo("t1");
      useTangentStore.getState().closeTangent("t1a");

      const state = useTangentStore.getState();
      expect(state.openTangents).toEqual([t1]);
      // viewParentId should collapse from "t1" (no children) to "main"
      expect(state.viewParentId).toBe("main");
    });

    it("branch scenario: close T1b from [T1, T1a, T1b] leaves [T1, T1a]", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t1a = makeTangent({ threadId: "t1a", parentThreadId: "t1", depth: 2 });
      const t1b = makeTangent({ threadId: "t1b", parentThreadId: "t1a", depth: 3 });

      useTangentStore.getState().hydrate("conv1", [t1, t1a, t1b]);
      // Currently viewing [T1a | T1b]
      useTangentStore.getState().navigateTo("t1a");
      useTangentStore.getState().closeTangent("t1b");

      const state = useTangentStore.getState();
      expect(state.openTangents.map((t) => t.threadId)).toEqual(["t1", "t1a"]);
      // T1a has no children now, should collapse up to T1's parent
      expect(state.viewParentId).toBe("t1");
      expect(state.activeChildByParent["main"]).toBe("t1");
      expect(state.activeChildByParent["t1"]).toBe("t1a");
    });
  });

  // ── navigateTo ───────────────────────────────────────────────────
  describe("navigateTo", () => {
    it("changes viewParentId without modifying tangents", () => {
      const t1 = makeTangent({ threadId: "t1" });
      useTangentStore.getState().openTangent(t1);
      useTangentStore.getState().navigateTo("t1");

      const state = useTangentStore.getState();
      expect(state.viewParentId).toBe("t1");
      expect(state.openTangents).toHaveLength(1);
    });
  });

  // ── setActiveChild ───────────────────────────────────────────────
  describe("setActiveChild", () => {
    it("switches active child and sets viewParentId", () => {
      const t1 = makeTangent({ threadId: "t1", parentThreadId: "main" });
      const t2 = makeTangent({ threadId: "t2", parentThreadId: "main" });

      useTangentStore.getState().hydrate("conv1", [t1, t2]);
      useTangentStore.getState().setActiveChild("main", "t1");

      const state = useTangentStore.getState();
      expect(state.activeChildByParent["main"]).toBe("t1");
      expect(state.viewParentId).toBe("main");
    });
  });
});
