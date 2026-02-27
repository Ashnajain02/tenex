"use client";

import { useEffect } from "react";

const HIGHLIGHT_CLASS = "tangent-highlight";

/**
 * Remove all existing highlight spans from the container,
 * unwrapping them back to plain text nodes.
 */
function clearHighlights(container: HTMLElement) {
  const marks = container.querySelectorAll(`span.${HIGHLIGHT_CLASS}`);
  marks.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(span.textContent || ""), span);
    parent.normalize();
  });
}

/**
 * Walk text nodes in the container and wrap the first occurrence
 * of `text` in <span class="tangent-highlight"> elements.
 * Handles text spanning across multiple DOM text nodes.
 */
function applyHighlight(container: HTMLElement, text: string) {
  if (!text.trim()) return;

  // Collect all text nodes in document order
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  if (textNodes.length === 0) return;

  // Build concatenated string with offset mapping
  const segments: Array<{ node: Text; start: number; text: string }> = [];
  let totalText = "";
  for (const tn of textNodes) {
    const nodeText = tn.textContent || "";
    segments.push({ node: tn, start: totalText.length, text: nodeText });
    totalText += nodeText;
  }

  // Try to find the highlighted text (with fallbacks)
  let matchIndex = totalText.indexOf(text);
  if (matchIndex === -1) {
    matchIndex = totalText.toLowerCase().indexOf(text.toLowerCase());
  }
  if (matchIndex === -1) {
    const normalizedTotal = totalText.replace(/\s+/g, " ");
    const normalizedText = text.replace(/\s+/g, " ");
    matchIndex = normalizedTotal.indexOf(normalizedText);
    if (matchIndex === -1) {
      matchIndex = normalizedTotal.toLowerCase().indexOf(normalizedText.toLowerCase());
    }
  }
  if (matchIndex === -1) return;

  const matchEnd = matchIndex + text.length;

  // Find overlapping text nodes and wrap matching portions in <mark>
  for (const seg of segments) {
    const segEnd = seg.start + seg.text.length;
    if (segEnd <= matchIndex || seg.start >= matchEnd) continue;

    const overlapStart = Math.max(0, matchIndex - seg.start);
    const overlapEnd = Math.min(seg.text.length, matchEnd - seg.start);

    const textNode = seg.node;
    const parent = textNode.parentNode;
    if (!parent) continue;

    const before = textNode.textContent!.substring(0, overlapStart);
    const highlighted = textNode.textContent!.substring(overlapStart, overlapEnd);
    const after = textNode.textContent!.substring(overlapEnd);

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));

    const span = document.createElement("span");
    span.className = HIGHLIGHT_CLASS;
    span.textContent = highlighted;
    frag.appendChild(span);

    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, textNode);
  }
}

/**
 * Hook that highlights a specific text substring within a container element.
 * Uses DOM TreeWalker for robust cross-element text matching.
 */
export function useTextHighlight(
  ref: React.RefObject<HTMLElement | null>,
  highlightedText: string | undefined,
  contentVersion?: string
) {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    clearHighlights(container);

    if (highlightedText) {
      const raf = requestAnimationFrame(() => {
        if (ref.current) {
          applyHighlight(ref.current, highlightedText);
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [ref, highlightedText, contentVersion]);
}
