"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SelectionState {
  selectedText: string;
  selectionRect: DOMRect | null;
}

export function useTextSelection() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SelectionState>({
    selectedText: "",
    selectionRect: null,
  });

  // Keep a ref to avoid stale-closure issues in document event listeners
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Set selection state when mouseup fires inside the bubble
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !ref.current) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    setState({ selectedText: text, selectionRect: rect });
  }, []);

  // Clear selection state when mousedown fires OUTSIDE this bubble.
  // TextSelectionMenu is rendered as a DOM child of the bubble's ref, so
  // clicking "Open tangent" correctly counts as "inside" and won't clear.
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (
      stateRef.current.selectedText &&
      ref.current &&
      !ref.current.contains(e.target as Node)
    ) {
      setState({ selectedText: "", selectionRect: null });
    }
  }, []);

  // Clear when the selection collapses (user clicks away, presses Escape, etc.)
  const handleSelectionChange = useCallback(() => {
    if (!stateRef.current.selectedText) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setState({ selectedText: "", selectionRect: null });
    }
  }, []);

  const clearSelection = useCallback(() => {
    setState({ selectedText: "", selectionRect: null });
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleMouseUp, handleMouseDown, handleSelectionChange]);

  return { ref, ...state, clearSelection };
}
