// ──────────────────────────────────────────────────────────────
// shop-891 — FadingScroller
// A horizontal scroller with scroll-aware edge fades: content that
// runs past an edge melts into a soft gradient instead of being
// chopped mid-word — and the fade only appears on the side where
// more content actually exists, which doubles as the "scroll for
// more" affordance.
//
// • Mobile: native momentum swipe scrolling.
// • Desktop: a vertical wheel/two-finger swipe scrolls the row
//   horizontally (without this, hovering the row and scrolling
//   does nothing, which reads as broken).
// ──────────────────────────────────────────────────────────────
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface FadingScrollerProps {
  /** Classes for the outer wrapper (e.g. max-width, margins). */
  className?: string;
  /** Classes for the scrolling row itself (flex, gap, padding…). */
  contentClassName?: string;
  children: ReactNode;
  /** Width of each edge fade in px. Default 28. */
  fadeSize?: number;
}

export function FadingScroller({
  className,
  contentClassName,
  children,
  fadeSize = 28,
}: FadingScrollerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  // Desktop: map vertical wheel to horizontal scroll. The page
  // keeps scrolling normally once the row reaches either end, and
  // horizontal trackpad input (deltaX) is left untouched.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.deltaY === 0) return;
      const before = el.scrollLeft;
      el.scrollLeft = before + e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  const mask =
    canLeft || canRight
      ? `linear-gradient(to right, ${
          canLeft ? "transparent" : "black"
        } 0px, black ${fadeSize}px, black calc(100% - ${fadeSize}px), ${
          canRight ? "transparent" : "black"
        } 100%)`
      : undefined;

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={ref}
        className={cn("scrollbar-none overflow-x-auto", contentClassName)}
        style={
          mask
            ? {
                maskImage: mask,
                WebkitMaskImage: mask,
                overscrollBehaviorX: "contain",
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
