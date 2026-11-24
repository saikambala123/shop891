// ──────────────────────────────────────────────────────────────
// shop-891 — Browser-history integration for the SPA router
//
// The storefront routes purely through the Zustand store (no URL
// changes), so out of the box the mobile/browser Back button would
// leave the site instead of returning to the previous screen.
// This module wires the store router into window.history:
//
//   • every in-app view change pushes a real history entry
//     (svRoute) so Back walks back through the views the user
//     actually visited — "return to where you were";
//   • each entry remembers the scroll position (svScroll) and it
//     is restored when the user comes back;
//   • overlays (mobile search, menu sheet, notification panel,
//     auth dialog…) push a lightweight overlay entry (svOverlay)
//     so Back closes the topmost overlay first instead of
//     navigating away.
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef } from "react";

export interface HistoryState {
  svRoute?: unknown;
  svScroll?: number;
  svOverlay?: string | null;
}

/** Read the current entry's state (null-safe). */
function currentState(): HistoryState {
  const st = window.history.state;
  return st && typeof st === "object" ? (st as HistoryState) : {};
}

/** True once the history router has booted (first entry marked). */
function historyRoutingActive(): boolean {
  return typeof window !== "undefined" && !!currentState().svRoute;
}

// ── Route entries ─────────────────────────────────────────────

/**
 * Push (or collapse into) a history entry for an in-app view
 * change. Called by the store's `navigate` on every view switch.
 *
 * - Saves the scroll position on the entry being left.
 * - If an overlay entry is currently on top, it is collapsed into
 *   the new route (Back from the new view returns to the page the
 *   overlay was opened on — never to a ghost, closed overlay).
 */
export function pushRouteEntry(route: unknown): void {
  if (typeof window === "undefined") return;
  const cur = currentState();
  if (!cur.svRoute) {
    // History routing hasn't booted yet — adopt this entry.
    window.history.replaceState(
      { svRoute: route, svScroll: 0, svOverlay: null },
      "",
      window.location.href
    );
    return;
  }
  // Remember where the user was scrolled on the view they leave.
  window.history.replaceState(
    { ...cur, svScroll: window.scrollY },
    "",
    window.location.href
  );
  if (cur.svOverlay) {
    window.history.replaceState(
      { svRoute: route, svScroll: 0, svOverlay: null },
      "",
      window.location.href
    );
  } else {
    window.history.pushState(
      { svRoute: route, svScroll: 0, svOverlay: null },
      "",
      window.location.href
    );
  }
}

// ── Boot / popstate ───────────────────────────────────────────

let booted = false;

/**
 * One-time setup, called from the app shell on mount.
 *
 * @param onPopRoute called when Back/Forward lands on an app entry
 *                   (receives the entry's route + saved scroll)
 * @param initialRoute the route the app booted with
 */
export function initHistoryRouting(
  onPopRoute: (route: unknown, scroll: number) => void,
  initialRoute: unknown
): void {
  if (typeof window === "undefined" || booted) return;
  booted = true;

  // Mark the boot entry so popping back to it keeps the app coherent.
  const cur = currentState();
  if (!cur.svRoute) {
    window.history.replaceState(
      { ...cur, svRoute: initialRoute, svScroll: window.scrollY, svOverlay: null },
      "",
      window.location.href
    );
  }

  window.addEventListener("popstate", () => {
    const s = currentState();
    if (s.svRoute) onPopRoute(s.svRoute, s.svScroll ?? 0);
    // Entries without svRoute predate the app — the browser handles
    // them (leaves the page / does nothing).
  });
}

// ── Overlay entries (Back closes the topmost overlay) ─────────

/**
 * While `open`, the component owns a history entry; pressing the
 * browser/mobile Back button closes the overlay instead of
 * navigating away. Closing the overlay via the UI consumes the
 * entry so Back afterwards still returns to the previous view.
 */
export function useBackClose(open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    if (!open || !historyRoutingActive()) return;

    const key = `sv-ovl-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    window.history.pushState(
      { ...currentState(), svOverlay: key },
      "",
      window.location.href
    );

    let closedByBack = false;
    const onPop = () => {
      if (currentState().svOverlay !== key) {
        closedByBack = true;
        closeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByBack && currentState().svOverlay === key) {
        // Closed through the UI — consume our entry quietly.
        window.history.back();
      }
    };
  }, [open]);
}
