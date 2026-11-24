// ──────────────────────────────────────────────────────────────
// shop-891 — Notification bell (order updates + store alerts)
// Server-backed feed stored in MongoDB per user: notifications are
// created on signup (welcome), checkout (order placed) and every
// order status change, so the bell always has real content — no
// localStorage-derived state that could vanish or desync.
//
// Flicker-hardened: the feed is fetched once per session (and
// quietly refreshed on open only when stale), marking-as-read is a
// local state flip, and the panel itself never re-mounts while it
// is open. Icon-only trigger with a numeric badge; the portaled
// panel stays centered on mobile and glued to the bell on desktop.
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeIndianRupee,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Package,
  RotateCcw,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  XCircle,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { apiNotifications } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { subscribeToNotifications } from "@/lib/realtime";
import type { AppNotificationDTO } from "@/lib/types";
import {
  NavbarPopoverPanel,
  useNavbarPopover,
} from "@/components/shared/navbar-popover";
import { cn } from "@/lib/utils";

/** Re-fetch the feed when it is older than this while opening. */
const STALE_MS = 45_000;

const KIND_META: Record<
  AppNotificationDTO["kind"],
  { icon: typeof Package; iconClass: string }
> = {
  placed: {
    icon: ShoppingCart,
    iconClass: "bg-primary/15 text-primary ring-primary/25",
  },
  processing: {
    icon: Zap,
    iconClass: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  },
  shipped: {
    icon: Truck,
    iconClass: "bg-cyan-500/15 text-cyan-600 ring-cyan-500/25 dark:text-cyan-400",
  },
  delivered: {
    icon: Check,
    iconClass: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
  },
  cancelled: {
    icon: XCircle,
    iconClass: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-400",
  },
  welcome: {
    icon: Sparkles,
    iconClass: "bg-primary/15 text-primary ring-primary/25",
  },
  return: {
    icon: RotateCcw,
    iconClass:
      "bg-violet-500/15 text-violet-600 ring-violet-500/25 dark:text-violet-400",
  },
  refund: {
    icon: BadgeIndianRupee,
    iconClass:
      "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-400",
  },
};

/** Human friendly relative time. */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationsBell() {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const navigate = useAppStore((s) => s.navigate);
  const openAuth = useAppStore((s) => s.openAuth);

  const [items, setItems] = useState<AppNotificationDTO[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fetchedAtRef = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const { notifications, unreadCount } = await apiNotifications.list();
      // No-op guard: when the feed is unchanged (same items, same
      // read flags, same count) keep the previous state objects so
      // the 2-second poller never triggers a pointless re-render.
      setItems((prev) => {
        if (
          prev &&
          prev.length === notifications.length &&
          (notifications.length === 0 ||
            (prev[0]?.id === notifications[0]?.id &&
              prev.every((n, i) => n.read === notifications[i].read && n.id === notifications[i].id)))
        ) {
          return prev;
        }
        return notifications;
      });
      setUnread((prev) => (prev === unreadCount ? prev : unreadCount));
      fetchedAtRef.current = Date.now();
    } catch {
      setItems((prev) => prev ?? []);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  // initial fetch once auth resolves (and reset on sign-out)
  useEffect(() => {
    if (!authReady) return;
    if (user) {
      void load();
    } else {
      setItems(null);
      setUnread(0);
      fetchedAtRef.current = 0;
    }
  }, [authReady, user, load]);

  // live push — new notifications land here the moment the server
  // writes them (order placed, status change, return resolved…), so
  // the badge count and the feed update without any page refresh.
  // The pushed DTO is prepended locally; no refetch round-trip.
  useEffect(() => {
    if (!authReady || !user) return;
    return subscribeToNotifications((n) => {
      setItems((prev) => (prev ? [n, ...prev].slice(0, 20) : [n]));
      setUnread((u) => u + 1);
      fetchedAtRef.current = Date.now();
    });
  }, [authReady, user]);

  const markAllRead = useCallback(() => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) =>
      prev ? prev.map((n) => ({ ...n, read: true })) : prev
    );
    // fire-and-forget — the local flip already cleared the badge
    apiNotifications.markAllRead().catch(() => undefined);
  }, [unread]);

  const clearAll = useCallback(async () => {
    setClearing(true);
    setItems([]);
    setUnread(0);
    try {
      await apiNotifications.clearAll();
    } catch {
      /* keep the optimistic clear — refetch on next open */
    } finally {
      window.setTimeout(() => setClearing(false), 220);
    }
  }, []);

  const popover = useNavbarPopover({
    width: 384,
    triggerRef,
    panelRef,
    mobileDialog: true, // centered dialog card on phones — never merges with content
    onOpen: () => {
      markAllRead();
      // silent refresh — only when the feed is stale, so the open
      // panel never swaps content mid-display
      if (Date.now() - fetchedAtRef.current > STALE_MS) void load();
    },
  });

  // ── 2-second heartbeat ──
  // The bell refreshes itself every two seconds, so any change —
  // an order placed, a cancellation, a refund approved — lands in
  // the badge and feed within 2s everywhere in the app, with no
  // dashboard refresh and no reliance on the push socket. Skipped
  // while the panel is open (a poll must never swap the list the
  // user is reading; the first tick after closing re-syncs) and
  // while the tab is hidden (the first visible tick catches up).
  useEffect(() => {
    if (!authReady || !user) return;
    const id = window.setInterval(() => {
      if (popover.open) return;
      if (document.visibilityState === "hidden") return;
      void load({ silent: true });
    }, 2_000);
    return () => window.clearInterval(id);
  }, [authReady, user, load, popover.open]);

  const list = items ?? [];

  return (
    <>
      {/* icon-only trigger — no round plate, just the bell + numeric badge */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Notifications${unread > 0 ? `, ${unread} new` : ""}`}
        aria-expanded={popover.open}
        aria-haspopup="dialog"
        onClick={popover.toggle}
        className={cn(
          "relative flex shrink-0 items-center justify-center p-2 text-muted-foreground transition-colors hover:text-primary active:scale-90",
          popover.open && "text-primary"
        )}
      >
        <Bell size={19} strokeWidth={2.1} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-[3px] text-[9.5px] font-extrabold leading-none text-white shadow-[0_2px_8px_rgb(225_29_72/0.55)] ring-2 ring-card">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* The scrim + panel portal straight to <body>. The bell trigger
          lives inside the header's backdrop-blur bar, and a backdrop-filter
          turns that bar into the containing block for fixed-position
          children — un-portaled, the scrim would only cover the header
          strip and the panel would flicker as the header layer repaints
          (marquee animation + page scroll behind the glass bar). */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
      {/* dim backdrop (mobile only) — dark scrim so the dialog card
          pops clearly; click closes; no blur for max speed */}
      <AnimatePresence>
        {popover.open && (
          <motion.div
            key="bell-backdrop"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={() => popover.setOpen(false)}
            className="fixed inset-0 z-40 bg-black/55 md:pointer-events-none md:bg-transparent"
            style={{ touchAction: "none" }}
          />
        )}
      </AnimatePresence>

      {/* notification panel */}
      <NavbarPopoverPanel
        placement={popover.open ? popover.placement : null}
        panelRef={panelRef}
        label="Notifications"
        mobileDialog
      >
        {/* header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <Bell size={15} className="text-primary" />
            Notifications
            {unread > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                {unread}
              </span>
            )}
          </span>
          {list.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-all hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 disabled:opacity-50 dark:hover:text-rose-400"
            >
              <Trash2 size={12} />
              Clear all
            </button>
          ) : (
            <button
              type="button"
              onClick={() => popover.setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted md:hidden"
              aria-label="Close notifications"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>

        {/* body */}
        {!user ? (
          <div className="px-4 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <ShieldAlert size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold">Stay in the loop</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Sign in to see order updates, shipping alerts and offers.
            </p>
            <button
              type="button"
              onClick={() => {
                popover.setOpen(false);
                openAuth("login");
              }}
              className="shine-host mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-primary px-4 text-xs font-bold text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-95"
            >
              Sign in
            </button>
          </div>
        ) : loading && items === null ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading notifications…
          </div>
        ) : list.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
              <CheckCheck size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Order updates and offers will appear here.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin]">
            {list.map((n) => {
              // Defensive lookup — an unknown kind falls back to the
              // generic "placed" style instead of crashing the bell.
              const meta = KIND_META[n.kind] ?? KIND_META.placed;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    popover.setOpen(false);
                    navigate({ name: "orders" });
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 border-b border-border/40 px-3.5 py-3 text-left transition-colors last:border-0 hover:bg-primary/[0.06]",
                    !n.read && "bg-primary/[0.06]"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
                      meta.iconClass
                    )}
                  >
                    <meta.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[13px] font-bold", !n.read && "text-primary")}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(new Date(n.createdAt).getTime())}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>
                    {n.amount != null && (
                      <span className="mt-1 block text-xs font-bold tracking-tight">
                        {formatCurrency(n.amount)}
                      </span>
                    )}
                  </span>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* footer link */}
        {user && list.length > 0 && (
          <button
            type="button"
            onClick={() => {
              popover.setOpen(false);
              navigate({ name: "orders" });
            }}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 bg-muted/40 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
          >
            <Package size={13} /> View all orders
          </button>
        )}
          </NavbarPopoverPanel>
          </>,
          document.body
        )}
    </>
  );
}
