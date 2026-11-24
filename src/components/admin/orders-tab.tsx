// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard / Orders tab
// Status filter tabs + search, expandable order cards with items,
// license keys, shipping/tracking info and status updates.
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  ShoppingCart,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiOrders } from "@/lib/api";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
import { useBackClose } from "@/lib/nav-history";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ADMIN_CANCEL_REASONS,
  ADMIN_CANCEL_REASON_LABELS,
  CANCEL_REASON_LABELS,
  ORDER_STATUSES,
  RETURN_REASON_LABELS,
  type OrderDTO,
  type OrderStatus,
} from "@/lib/types";
import { EmptyState, ErrorState, ORDER_STATUS_META, OrderStatusBadge, PaymentMethodBadge, PaymentStatusBadge } from "./shared";

type StatusFilter = "ALL" | OrderStatus;

/** sessionStorage key for the admin orders status filter — kept
 * across reloads so refreshing stays on the same status tab. */
const ADMIN_STATUS_KEY = "shopverse_admin_orders_status";

export function OrdersTab() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The active status tab survives a page refresh (restored from
  // sessionStorage), so reloading keeps the admin on the exact tab.
  const [status, setStatus] = useState<StatusFilter>(() => {
    if (typeof window === "undefined") return "ALL";
    try {
      const v = window.sessionStorage.getItem(ADMIN_STATUS_KEY);
      return v && (v === "ALL" || (ORDER_STATUSES as string[]).includes(v))
        ? (v as StatusFilter)
        : "ALL";
    } catch {
      return "ALL";
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(ADMIN_STATUS_KEY, status);
    } catch {
      /* ignore */
    }
  }, [status]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shipPrompt, setShipPrompt] = useState<{ orderId: string; tracking: string } | null>(
    null
  );
  // Admin cancels must carry a reason — the customer is notified
  // with it and it shows on their order card.
  const [cancelPrompt, setCancelPrompt] = useState<{
    orderId: string;
    reason: string;
    comment: string;
  } | null>(null);

  // Browser/mobile Back closes the ship / cancel prompts and returns
  // to the orders tab the admin was on — never navigates away.
  useBackClose(!!shipPrompt, () => setShipPrompt(null));
  useBackClose(!!cancelPrompt, () => setCancelPrompt(null));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiOrders.all();
      setOrders(res.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    for (const s of ORDER_STATUSES) c[s] = 0;
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "ALL" && o.status !== status) return false;
      if (!q) return true;
      return [o.orderNumber, o.userName ?? "", o.userEmail ?? ""].some((v) =>
        v.toLowerCase().includes(q)
      );
    });
  }, [orders, status, search]);

  const copyText = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title });
    } catch {
      toast({ title: "Could not copy to clipboard", variant: "destructive" });
    }
  };

  const updateStatus = async (
    order: OrderDTO,
    next: OrderStatus,
    trackingNumber?: string,
    reason?: string,
    comment?: string
  ) => {
    if (updatingId) return;
    setUpdatingId(order.id);
    try {
      await apiOrders.updateStatus(order.id, next, trackingNumber, reason, comment);
      toast({
        title: `Order ${order.orderNumber} marked ${ORDER_STATUS_META[next].label.toLowerCase()}`,
        description: trackingNumber
          ? `Tracking: ${trackingNumber}`
          : next === "CANCELLED"
            ? `${order.userName ?? "Customer"} has been notified with the reason.`
            : undefined,
      });
      setShipPrompt(null);
      setCancelPrompt(null);
      await load();
    } catch (err) {
      toast({
        title: "Could not update order",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusSelect = (order: OrderDTO, value: string) => {
    const next = value as OrderStatus;
    if (next === order.status) return;
    // Setting SHIPPED first asks for an optional tracking number
    if (next === "SHIPPED") {
      setShipPrompt({ orderId: order.id, tracking: order.trackingNumber ?? "" });
      return;
    }
    // Cancelling asks for a mandatory reason first — it is sent to
    // the customer and shown on their order.
    if (next === "CANCELLED") {
      setCancelPrompt({ orderId: order.id, reason: "", comment: "" });
      return;
    }
    updateStatus(order, next);
  };

  // ── Return request resolution (approve → refund, decline → back to delivered)
  const [declineNote, setDeclineNote] = useState<{ orderId: string; note: string } | null>(null);

  const resolveReturn = async (order: OrderDTO, approve: boolean, note?: string) => {
    if (updatingId) return;
    setUpdatingId(order.id);
    try {
      await apiOrders.resolveReturn(order.id, approve, note);
      toast({
        title: approve
          ? `Return approved — ${formatCurrency(order.total)} refunded`
          : "Return declined",
        description: approve
          ? `${order.orderNumber} marked returned; items restocked. ${order.userName ?? "Customer"} has been notified.`
          : `${order.orderNumber} is back to delivered. ${order.userName ?? "Customer"} has been notified.`,
      });
      setDeclineNote(null);
      await load();
    } catch (err) {
      toast({
        title: "Could not resolve return",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Refund resolution — cancellation refunds are never automatic:
  //  a paid cancelled order sits in REFUND_PENDING until an admin
  //  approves (money back) or declines it (with a note to the customer).
  const [refundDeclineNote, setRefundDeclineNote] = useState<{
    orderId: string;
    note: string;
  } | null>(null);

  const resolveRefund = async (order: OrderDTO, approve: boolean, note?: string) => {
    if (updatingId) return;
    setUpdatingId(order.id);
    try {
      const refundAmount = order.refundInfo?.amount ?? order.total;
      await apiOrders.resolveRefund(order.id, approve, note);
      toast({
        title: approve
          ? `Refund approved — ${formatCurrency(refundAmount)}`
          : "Refund declined",
        description: approve
          ? `${refundAmount} for ${order.orderNumber} is marked refunded. ${order.userName ?? "Customer"} has been notified.`
          : `The refund for ${order.orderNumber} was declined. ${order.userName ?? "Customer"} has been notified.`,
      });
      setRefundDeclineNote(null);
      await load();
    } catch (err) {
      toast({
        title: "Could not resolve refund",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Orders</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${orders.length} order${orders.length === 1 ? "" : "s"} received`}
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, email"
            aria-label="Search orders"
            className="w-full pl-8"
          />
        </div>
      </div>

      {/* refunds / returns waiting on the admin — never miss one */}
      {!loading &&
        (() => {
          const pendingRefunds = orders.filter(
            (o) => o.paymentStatus === "REFUND_PENDING"
          );
          const pendingReturns = orders.filter(
            (o) => o.status === "RETURN_REQUESTED"
          );
          if (pendingRefunds.length + pendingReturns.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-sm dark:border-orange-900 dark:bg-orange-950/40">
              <BadgeIndianRupee className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
              <span className="font-medium text-orange-800 dark:text-orange-300">
                {[
                  pendingRefunds.length > 0 &&
                    `${pendingRefunds.length} refund${pendingRefunds.length === 1 ? "" : "s"} awaiting approval`,
                  pendingReturns.length > 0 &&
                    `${pendingReturns.length} return request${pendingReturns.length === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="text-muted-foreground">
                — expand an order below to approve or decline.
              </span>
            </div>
          );
        })()}

      {/* ── status filter ──────────────────────────────────── */}
      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 sm:w-full">
            <TabsTrigger value="ALL" className="gap-1.5 px-3 py-1.5">
              All
              <CountChip value={counts.ALL} />
            </TabsTrigger>
            {ORDER_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className="gap-1.5 px-3 py-1.5">
                {ORDER_STATUS_META[s].label}
                <CountChip value={counts[s] ?? 0} />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* ── order cards ────────────────────────────────────── */}
      {loading ? (
        <OrdersSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="When customers check out, their orders will show up here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching orders"
          description="Try a different order number, customer name or email."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const expanded = expandedId === order.id;
            const updating = updatingId === order.id;
            const hasAddress = !!order.addressLine;
            return (
              <Collapsible
                key={order.id}
                open={expanded}
                onOpenChange={(open) => setExpandedId(open ? order.id : null)}
              >
                <div
                  className={cn(
                    "overflow-hidden rounded-xl border bg-card transition-opacity",
                    updating && "pointer-events-none opacity-60"
                  )}
                >
                  {/* ── card header ── */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full min-w-0 cursor-pointer items-center gap-3 text-left sm:w-auto sm:flex-1"
                        aria-label={expanded ? "Collapse order details" : "Expand order details"}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180"
                          )}
                        />
                        {/* product thumbnails — every order previews its
                            items right beside the order id (first 3
                            images + a "+N" chip for the rest), mobile
                            and desktop alike */}
                        <span className="flex shrink-0 items-center -space-x-1.5 sm:-space-x-2" aria-hidden>
                          {order.items.slice(0, 3).map((it, i) => (
                            <img
                              key={it.id ?? i}
                              src={it.image || PLACEHOLDER_IMAGE}
                              alt=""
                              loading="lazy"
                              className="h-8 w-8 rounded-lg border-2 border-card bg-muted object-cover shadow-sm sm:h-9 sm:w-9"
                            />
                          ))}
                          {order.items.length > 3 && (
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground sm:h-9 sm:w-9">
                              +{order.items.length - 3}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <span className="whitespace-nowrap font-mono text-sm font-semibold">
                            {order.orderNumber}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {order.userName ?? "Customer"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.userEmail ?? "—"}
                      </p>
                    </div>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      <PaymentMethodBadge method={order.paymentMethod} />
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.items.length} item{order.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  {/* ── expanded details ── */}
                  <CollapsibleContent>
                    <div className="space-y-4 border-t bg-muted/20 p-4">
                      {/* payment badges on small screens */}
                      <div className="flex items-center gap-1.5 sm:hidden">
                        <PaymentMethodBadge method={order.paymentMethod} />
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </div>

                      {/* items */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Items
                        </h4>
                        <ul className="mt-2 space-y-2">
                          {order.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-2.5"
                            >
                              <img
                                src={item.image || PLACEHOLDER_IMAGE}
                                alt={item.name}
                                loading="lazy"
                                className="h-10 w-10 shrink-0 rounded-md border object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium">{item.name}</p>
                                  {item.isDigital && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                                      <Download className="size-3" /> Digital
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {item.quantity} × {formatCurrency(item.price)}
                                </p>
                                {item.isDigital && item.licenseKey && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                      License:
                                    </span>
                                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                                      {item.licenseKey}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-muted-foreground hover:text-foreground"
                                      onClick={() =>
                                        copyText(item.licenseKey ?? "", "License key copied")
                                      }
                                      aria-label="Copy license key"
                                    >
                                      <Copy className="size-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-semibold tabular-nums">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* shipping & tracking */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {hasAddress && (
                          <div className="rounded-lg border bg-card p-3">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <MapPin className="size-3.5" /> Shipping address
                            </h4>
                            <p className="mt-1.5 text-sm font-medium">
                              {order.shippingName ?? "—"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {[
                                order.addressLine,
                                order.city,
                                order.state,
                                order.zipCode,
                                order.country,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {order.shippingPhone && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {order.shippingPhone}
                              </p>
                            )}
                          </div>
                        )}
                        {order.trackingNumber && (
                          <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                              <Truck className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Tracking number
                              </h4>
                              <code className="font-mono text-sm">
                                {order.trackingNumber}
                              </code>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                copyText(order.trackingNumber ?? "", "Tracking number copied")
                              }
                              aria-label="Copy tracking number"
                            >
                              <Copy className="size-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* pending return request — approve (refund) or decline */}
                      {order.status === "RETURN_REQUESTED" && order.returnInfo && (
                        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/40">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                            <div className="min-w-0">
                              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                <RotateCcw className="size-3.5" /> Return requested
                                <span className="font-normal normal-case tracking-normal text-muted-foreground">
                                  {formatDateTime(order.returnInfo.requestedAt)}
                                </span>
                              </h4>
                              <p className="mt-1 text-sm font-semibold">
                                {RETURN_REASON_LABELS[order.returnInfo.reason] ??
                                  order.returnInfo.reason}
                                <span className="ml-2 font-normal text-muted-foreground">
                                  · refund {formatCurrency(order.returnInfo.refundAmount)}
                                </span>
                              </p>
                              {order.returnInfo.comment && (
                                <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                                  “{order.returnInfo.comment}”
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updating}
                                onClick={() =>
                                  declineNote?.orderId === order.id
                                    ? setDeclineNote(null)
                                    : setDeclineNote({ orderId: order.id, note: "" })
                                }
                              >
                                {declineNote?.orderId === order.id ? (
                                  <>
                                    <X className="size-3.5" /> Cancel
                                  </>
                                ) : (
                                  "Decline"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                disabled={updating}
                                onClick={() => resolveReturn(order, true)}
                              >
                                {updating ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Check className="size-3.5" />
                                )}
                                Approve &amp; refund
                              </Button>
                            </div>
                          </div>
                          {declineNote?.orderId === order.id && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={declineNote.note}
                                onChange={(e) =>
                                  setDeclineNote((prev) =>
                                    prev ? { ...prev, note: e.target.value } : prev
                                  )
                                }
                                placeholder="Reason for declining (shown to the customer)"
                                aria-label="Decline note"
                                className="bg-card sm:flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    resolveReturn(order, false, declineNote.note.trim() || undefined);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                disabled={updating}
                                onClick={() =>
                                  resolveReturn(order, false, declineNote.note.trim() || undefined)
                                }
                              >
                                Confirm decline
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* resolved return summary */}
                      {order.returnInfo &&
                        order.returnInfo.status !== "REQUESTED" &&
                        order.status !== "RETURN_REQUESTED" && (
                          <div className="rounded-lg border bg-card p-3">
                            <h4 className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <RotateCcw className="size-3.5" /> Return ·{" "}
                              {order.returnInfo.status === "APPROVED"
                                ? `refunded ${formatCurrency(order.returnInfo.refundAmount)}`
                                : "declined"}
                              <span className="font-normal normal-case tracking-normal">
                                {order.returnInfo.resolvedAt
                                  ? formatDateTime(order.returnInfo.resolvedAt)
                                  : ""}
                              </span>
                            </h4>
                            {order.returnInfo.adminNote && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Note: {order.returnInfo.adminNote}
                              </p>
                            )}
                          </div>
                        )}

                      {/* cancellation details — who cancelled and why */}
                      {order.cancelInfo && (
                        <div
                          className={cn(
                            "rounded-lg border p-3",
                            order.cancelInfo.by === "ADMIN"
                              ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40"
                              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                          )}
                        >
                          <h4 className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <XCircle className="size-3.5" /> Cancelled by{" "}
                            {order.cancelInfo.by === "ADMIN" ? "you (admin)" : "customer"}
                            <span className="font-normal normal-case tracking-normal">
                              {formatDateTime(order.cancelInfo.at)}
                            </span>
                          </h4>
                          <p className="mt-1 text-sm font-semibold">
                            {order.cancelInfo.by === "ADMIN"
                              ? (ADMIN_CANCEL_REASON_LABELS[order.cancelInfo.reason] ??
                                order.cancelInfo.reason)
                              : (CANCEL_REASON_LABELS[order.cancelInfo.reason] ??
                                order.cancelInfo.reason)}
                          </p>
                          {order.cancelInfo.comment && (
                            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                              “{order.cancelInfo.comment}”
                            </p>
                          )}
                        </div>
                      )}

                      {/* pending cancellation refund — approve or decline
                          (refunds are never automatic) */}
                      {order.paymentStatus === "REFUND_PENDING" && (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/40">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                            <div className="min-w-0">
                              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                                <BadgeIndianRupee className="size-3.5" /> Refund awaiting
                                your approval
                                <span className="font-normal normal-case tracking-normal text-muted-foreground">
                                  {order.refundInfo?.requestedAt
                                    ? formatDateTime(order.refundInfo.requestedAt)
                                    : ""}
                                </span>
                              </h4>
                              <p className="mt-1 text-sm font-semibold">
                                {formatCurrency(order.refundInfo?.amount ?? order.total)} to{" "}
                                {order.userName ?? "customer"}
                                <span className="ml-2 font-normal text-muted-foreground">
                                  · {order.paymentMethod} payment
                                </span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Refunds never process automatically — approve to send the
                                money back, or decline with a note.
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updating}
                                onClick={() =>
                                  refundDeclineNote?.orderId === order.id
                                    ? setRefundDeclineNote(null)
                                    : setRefundDeclineNote({ orderId: order.id, note: "" })
                                }
                              >
                                {refundDeclineNote?.orderId === order.id ? (
                                  <>
                                    <X className="size-3.5" /> Cancel
                                  </>
                                ) : (
                                  "Decline"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                disabled={updating}
                                onClick={() => resolveRefund(order, true)}
                              >
                                {updating ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Check className="size-3.5" />
                                )}
                                Approve refund
                              </Button>
                            </div>
                          </div>
                          {refundDeclineNote?.orderId === order.id && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={refundDeclineNote.note}
                                onChange={(e) =>
                                  setRefundDeclineNote((prev) =>
                                    prev ? { ...prev, note: e.target.value } : prev
                                  )
                                }
                                placeholder="Reason for declining (shown to the customer)"
                                aria-label="Refund decline note"
                                className="bg-card sm:flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    resolveRefund(
                                      order,
                                      false,
                                      refundDeclineNote.note.trim() || undefined
                                    );
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                disabled={updating}
                                onClick={() =>
                                  resolveRefund(
                                    order,
                                    false,
                                    refundDeclineNote.note.trim() || undefined
                                  )
                                }
                              >
                                Confirm decline
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* resolved refund summary (declined refunds only —
                          approved ones show as REFUNDED in the badges) */}
                      {order.refundInfo?.status === "DECLINED" && (
                        <div className="rounded-lg border bg-card p-3">
                          <h4 className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <BadgeIndianRupee className="size-3.5" /> Refund · declined
                            <span className="font-normal normal-case tracking-normal">
                              {order.refundInfo.resolvedAt
                                ? formatDateTime(order.refundInfo.resolvedAt)
                                : ""}
                            </span>
                          </h4>
                          {order.refundInfo.adminNote && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Note: {order.refundInfo.adminNote}
                            </p>
                          )}
                        </div>
                      )}

                      {/* status update */}
                      <div className="space-y-3 border-t pt-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span className="text-sm font-medium">Update status</span>
                          <Select
                            value={order.status}
                            onValueChange={(v) => handleStatusSelect(order, v)}
                            disabled={updating}
                          >
                            <SelectTrigger className="w-full sm:w-44" aria-label="Order status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {ORDER_STATUS_META[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {updating && (
                            <Loader2 className="size-4 animate-spin text-orange-600" />
                          )}
                        </div>

                        {shipPrompt?.orderId === order.id && (
                          <div className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/40 sm:flex-row sm:items-center">
                            <Input
                              value={shipPrompt.tracking}
                              onChange={(e) =>
                                setShipPrompt((prev) =>
                                  prev ? { ...prev, tracking: e.target.value } : prev
                                )
                              }
                              placeholder="Tracking number (optional)"
                              aria-label="Tracking number"
                              className="bg-card sm:flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  updateStatus(
                                    order,
                                    "SHIPPED",
                                    shipPrompt.tracking.trim() || undefined
                                  );
                                }
                              }}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShipPrompt(null)}
                                disabled={updating}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="bg-orange-600 text-white hover:bg-orange-700"
                                disabled={updating}
                                onClick={() =>
                                  updateStatus(
                                    order,
                                    "SHIPPED",
                                    shipPrompt.tracking.trim() || undefined
                                  )
                                }
                              >
                                {updating ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <Truck />
                                )}
                                Confirm shipment
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* cancel-with-reason prompt — the reason is
                            required and the customer sees it */}
                        {cancelPrompt?.orderId === order.id && (
                          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                            <div>
                              <p className="text-sm font-semibold">
                                Why is this order being cancelled?
                                <span className="ml-1 text-red-600 dark:text-red-400">*</span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                The reason is sent to {order.userName ?? "the customer"} as a
                                notification and shows on their order.
                              </p>
                            </div>
                            <Select
                              value={cancelPrompt.reason || undefined}
                              onValueChange={(v) =>
                                setCancelPrompt((prev) =>
                                  prev ? { ...prev, reason: v } : prev
                                )
                              }
                              disabled={updating}
                            >
                              <SelectTrigger
                                className="w-full bg-card"
                                aria-label="Cancellation reason"
                              >
                                <SelectValue placeholder="Choose a reason…" />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_CANCEL_REASONS.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Textarea
                              value={cancelPrompt.comment}
                              onChange={(e) =>
                                setCancelPrompt((prev) =>
                                  prev ? { ...prev, comment: e.target.value } : prev
                                )
                              }
                              placeholder="Note for the customer (optional)"
                              aria-label="Cancellation note"
                              rows={2}
                              maxLength={400}
                              className="resize-none bg-card"
                            />
                            {order.paymentStatus === "PAID" && (
                              <p className="rounded-md border border-amber-300/60 bg-amber-100/60 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                This order was paid — after cancelling, the refund of{" "}
                                {formatCurrency(order.total)} will wait for your approval in
                                the refund panel below.
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCancelPrompt(null)}
                                disabled={updating}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-600 text-white hover:bg-red-700"
                                disabled={updating || !cancelPrompt.reason}
                                onClick={() =>
                                  updateStatus(
                                    order,
                                    "CANCELLED",
                                    undefined,
                                    cancelPrompt.reason,
                                    cancelPrompt.comment.trim() || undefined
                                  )
                                }
                              >
                                {updating ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="size-3.5" />
                                )}
                                Cancel order
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CountChip({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-semibold tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

// ── Loading skeleton ──────────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading orders">
      <Skeleton className="h-9 w-full max-w-xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-5 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
