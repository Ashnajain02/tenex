"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls the returned ref element to the bottom whenever `messageCount`
 * increases. Using a number (not the array reference) prevents spurious
 * scrolls that would otherwise fire whenever the parent re-renders and
 * produces a new array reference without actually adding a message.
 */
export function useAutoScroll(messageCount: number) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && messageCount > 0) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [messageCount]);

  return ref;
}
