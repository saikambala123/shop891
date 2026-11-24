// ──────────────────────────────────────────────────────────────
// shop-891 — Navbar popover primitives
// Radix dropdowns misplace when their trigger lives inside the
// sticky header (inline mode anchors to document coordinates,
// popper mode drifts by the scroll offset), so navbar flyouts use
// this tiny custom popover instead: a viewport-fixed panel placed
// from the trigger's live getBoundingClientRect().
//
// Flicker-hardened:
//  • setPlacement keeps the previous object when the numbers are
//    unchanged — mobile browsers fire `resize` in bursts (URL bar
//    show/hide, keyboard), and a fresh object every event used to
//    re-render the panel mid-animation (visible blinking).
//  • resize handling is coalesced into one rAF callback.
//  • panel enter/exit is a short tween, not a spring — springs
//    keep re-rendering while settling which reads as jitter on
//    low-end phones.
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBackClose } from "@/lib/nav-history";

export interface PopoverPlacement {
  top: number;
  left: number;
  width: number;
}

/**
 * Fixed-position popover state for navbar flyouts.
 * The component owns both refs and passes them in — this keeps the
 * React compiler happy (refs are never read off a returned object).
 * - desktop: panel right-aligns under the trigger
 * - mobile (<768px): optionally centers on the screen
 */
export function useNavbarPopover(options: {
  width: number;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  mobileCenter?: boolean;
  mobileDialog?: boolean;
  onOpen?: () => void;
}) {
  const { width, mobileCenter = false, mobileDialog = false, onOpen, triggerRef, panelRef } = options;
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  // Browser/mobile Back closes the popover instead of leaving the page.
  useBackClose(open, () => setOpen(false));
  // keep the latest callback without re-placing on identity changes
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(width, vw - 16);
    const next: PopoverPlacement = mobileDialog && vw < 768
      ? {
          // fully centered dialog card (x + y) — clearly separated
          // from the page content behind it
          top: Math.max(16, Math.round((vh - Math.min(vh - 48, 430)) / 2)),
          left: Math.round((vw - w) / 2),
          width: Math.round(w),
        }
      : {
          top: Math.round(rect.bottom + 10),
          left: Math.round(
            mobileCenter && vw < 768
              ? (vw - w) / 2
              : Math.max(8, rect.right - w)
          ),
          width: Math.round(w),
        };
    // identity-stable update: skip when nothing moved so bursts of
    // resize events never re-render (and never restart animations)
    setPlacement((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.width === next.width
        ? prev
        : next
    );
  }, [width, mobileCenter, mobileDialog, triggerRef]);

  // coalesce resize bursts (mobile URL bar / keyboard) into one
  // placement pass per frame
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [open, place]);

  // outside interaction / Escape closes
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, panelRef, triggerRef]);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    // measure + run the open callback before flipping open — both state
    // updates batch into the same render
    onOpenRef.current?.();
    place();
    setOpen(true);
  }, [open, place]);

  return { open, setOpen, toggle, placement };
}

/** Animated viewport-fixed panel rendered above the page (z-60). */
export function NavbarPopoverPanel({
  placement,
  panelRef,
  label,
  children,
  className,
  mobileDialog,
}: {
  placement: PopoverPlacement | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
  className?: string;
  /** Mobile dialog mode — solid card, modal-like separation. */
  mobileDialog?: boolean;
}) {
  return (
    <AnimatePresence>
      {placement && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: [0.3, 0.9, 0.4, 1] }}
          style={{
            position: "fixed",
            top: placement.top,
            left: placement.left,
            width: placement.width,
            zIndex: 60,
          }}
          className={
            className ??
            (mobileDialog
              ? "overflow-hidden rounded-3xl border-2 border-border bg-popover text-popover-foreground shadow-pop-3d ring-4 ring-primary/10 md:rounded-2xl md:border md:ring-0 md:backdrop-blur-xl"
              : "origin-top overflow-hidden rounded-2xl border border-border/70 bg-popover/95 text-popover-foreground shadow-pop-3d backdrop-blur-xl")
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
