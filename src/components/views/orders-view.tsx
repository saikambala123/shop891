// ──────────────────────────────────────────────────────────────
// ShopVerse — User orders view (history, tracking, status)
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Hourglass,
  MapPin,
  MessageSquareQuote,
  Package,
  PackageSearch,
  RotateCcw,
  Smartphone,
  Ticket,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { apiOrders } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { subscribeToNotifications } from "@/lib/realtime";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  RETURN_REASONS,
  RETURN_REASON_LABELS,
  type CancelInfoDTO,
  type OrderDTO,
  type OrderStatus,
  type RefundInfoDTO,
  type ReturnInfoDTO,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FadingScroller } from "@/components/shared/fading-scroller";
import { useBackClose } from "@/lib/nav-history";
import { cn } from "@/lib/utils";

/** sessionStorage key for the orders status filter — kept across
 * reloads so refreshing the page stays on the same filter tab. */
const ORDERS_FILTER_KEY = "shopverse_orders_filter";

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  PROCESSING: { label: "Processing", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  SHIPPED: { label: "Shipped", className: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  CANCELLED: { label: "Cancelled", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  RETURN_REQUESTED: { label: "Return requested", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  RETURNED: { label: "Returned · Refunded", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
};

const FLOW: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

function PaymentIcon({ method }: { method: string }) {
  if (method === "CARD") return <CreditCard size={13} />;
  if (method === "UPI") return <Smartphone size={13} />;
  return <Banknote size={13} />;
}

function StatusTimeline({ status, createdAt }: { status: OrderStatus; createdAt: string }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <XCircle size={15} /> Order cancelled on {formatDate(createdAt)}
      </div>
    );
  }
  // Return flow: delivered → return requested → refunded
  if (status === "RETURN_REQUESTED" || status === "RETURNED") {
    const done = status === "RETURNED";
    const steps = ["Delivered", "Return requested", done ? "Refunded" : "Awaiting review"];
    return (
      <div className="flex items-center gap-1.5 sm:gap-3">
        {steps.map((s, i) => {
          const active = i < 2 || done;
          return (
            <div key={s} className="flex items-center gap-1.5 sm:gap-3">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all",
                    active
                      ? "border-violet-500 bg-violet-500 text-white shadow-md"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {active ? <Check size={12} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "max-w-20 text-center text-[10px] font-semibold leading-tight",
                    active ? "text-foreground" : "text-muted-foreground/60"
                  )}
                >
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("mb-5 h-1 w-6 rounded-full sm:w-12", active ? "bg-violet-500" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  const currentIdx = FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {FLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all",
                i <= currentIdx
                  ? "border-primary bg-gradient-primary text-primary-foreground shadow-md"
                  : "border-muted-foreground/30 text-muted-foreground/50"
              )}
            >
              {i <= currentIdx ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold",
                i <= currentIdx ? "text-foreground" : "text-muted-foreground/60"
              )}
            >
              {s === "PENDING" ? "Ordered" : STATUS_META[s].label}
            </span>
          </div>
          {i < FLOW.length - 1 && (
            <div className={cn("mb-5 h-1 w-6 rounded-full sm:w-12", i < currentIdx ? "bg-primary" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReturnBanner({ info }: { info: ReturnInfoDTO }) {
  const approved = info.status === "APPROVED";
  const rejected = info.status === "REJECTED";
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        approved
          ? "border-rose-500/30 bg-rose-500/[0.06]"
          : rejected
            ? "border-amber-500/30 bg-amber-500/[0.06]"
            : "border-violet-500/30 bg-violet-500/[0.06]"
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Undo2 size={12} /> Return request
        <span
          className={cn(
            "rounded-full border px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal",
            approved
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : rejected
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          )}
        >
          {approved ? "Approved · Refunded" : rejected ? "Declined · Closed" : "Under review"}
        </span>
      </p>
      {rejected && (
        <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          Your return request was not approved, so this order is no longer eligible for return.
        </p>
      )}
      <p className="mt-1.5 text-sm font-semibold">
        {RETURN_REASON_LABELS[info.reason] ?? info.reason}
        <span className="ml-2 font-normal text-muted-foreground">
          · {formatCurrency(info.refundAmount)} refund
        </span>
      </p>
      {info.comment && (
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MessageSquareQuote size={13} className="mt-0.5 shrink-0" /> {info.comment}
        </p>
      )}
      {rejected && info.adminNote && (
        <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          Note from us: {info.adminNote}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Requested {formatDate(info.requestedAt)}
        {info.resolvedAt && ` · Resolved ${formatDate(info.resolvedAt)}`}
      </p>
    </div>
  );
}

function ReturnRequestDialog({
  order,
  onDone,
}: {
  order: OrderDTO;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Browser/mobile Back closes this dialog and returns to the exact
  // orders tab the user came from — never navigates away.
  useBackClose(open, () => setOpen(false));

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiOrders.requestReturn(order.id, {
        reason,
        comment: comment.trim() || undefined,
      });
      toast({
        title: "Return requested",
        description: `We'll review ${order.orderNumber} and refund ${formatCurrency(order.total)} once approved.`,
      });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request return");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setReason("");
          setComment("");
          setError("");
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full" disabled={busy}>
          <RotateCcw size={14} /> Return items
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="grid max-h-[min(90dvh,34rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0">
        <AlertDialogHeader className="px-4 pb-3 pt-4 text-left sm:px-6 sm:pt-5">
          <AlertDialogTitle className="flex items-start gap-2.5 text-left text-base sm:text-lg">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 sm:h-9 sm:w-9">
              <RotateCcw size={15} />
            </span>
            <span className="min-w-0">
              Return order{" "}
              <span className="break-all font-mono text-[12.5px] font-semibold text-muted-foreground sm:text-sm">
                {order.orderNumber}
              </span>
              ?
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-[13px] leading-relaxed">
            Tell us what went wrong. Once approved, {formatCurrency(order.total)} is
            refunded to your original payment method.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* scrollable body — the reason list never grows past the
            viewport, so the action buttons below stay reachable on
            every phone */}
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-1 sm:px-6">
          <div>
            <Label className="text-[13px] font-semibold sm:text-sm">Reason for return</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => {
                setReason(v);
                setError("");
              }}
              className="mt-2 gap-1.5 sm:gap-2"
            >
              {RETURN_REASONS.map((r) => (
                <Label
                  key={r.value}
                  htmlFor={`ret-${r.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-xl border p-2 text-left transition-all duration-200 sm:items-center sm:gap-2.5 sm:p-2.5",
                    reason === r.value
                      ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                      : "hover:border-primary/40"
                  )}
                >
                  <RadioGroupItem id={`ret-${r.value}`} value={r.value} className="mt-0.5 sm:mt-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug sm:text-sm">{r.label}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground sm:text-xs">{r.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor={`ret-comment-${order.id}`} className="text-[13px] font-semibold sm:text-sm">
              Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`ret-comment-${order.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. The pot arrived cracked…"
              rows={3}
              maxLength={400}
              className="mt-1.5 resize-none text-sm"
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* stacked full-width buttons on phones, side by side on sm+ */}
        <AlertDialogFooter className="flex-col gap-2 px-4 pb-4 pt-3 sm:flex-row sm:justify-end sm:px-6 sm:pb-5">
          <AlertDialogCancel className="mt-0 rounded-xl" disabled={busy}>
            Go back (keep order)
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 disabled:opacity-50"
            disabled={!reason || busy}
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open until the API settles
              submit();
            }}
          >
            {busy ? "Requesting…" : "Request return"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Cancelled-order banner: who cancelled it, why, and what is
 *  happening with the money (refund never processes on its own —
 *  it waits for approval, then lands or is declined with a note). */
function CancelledBanner({
  order,
}: {
  order: OrderDTO;
}) {
  const info = order.cancelInfo ?? null;
  const refund = order.refundInfo ?? null;
  const byAdmin = info?.by === "ADMIN";

  // Refund outcome — derived from paymentStatus so legacy orders
  // (cancelled before refund approval existed) still render right.
  let refundLine: { text: string; tone: "amber" | "green" | "red" } | null = null;
  if (order.paymentStatus === "REFUND_PENDING") {
    refundLine = {
      text: `Refund of ${formatCurrency(refund?.amount ?? order.total)} awaiting approval`,
      tone: "amber",
    };
  } else if (order.paymentStatus === "REFUNDED") {
    refundLine = {
      text: `${formatCurrency(refund?.amount ?? order.total)} refunded to your original payment method`,
      tone: "green",
    };
  } else if (refund?.status === "DECLINED") {
    refundLine = {
      text: "Refund request declined",
      tone: "red",
    };
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        byAdmin
          ? "border-red-500/30 bg-red-500/[0.06]"
          : "border-amber-500/30 bg-amber-500/[0.06]"
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <XCircle size={12} /> {byAdmin ? "Cancelled by shop-891" : "Cancelled by you"}
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal text-red-700 dark:text-red-300">
          {byAdmin ? "Store decision" : "Your request"}
        </span>
      </p>

      {info && (
        <>
          <p className="mt-1.5 text-sm font-semibold">
            {CANCEL_REASON_LABELS[info.reason] ?? info.reason}
            <span className="ml-2 font-normal text-muted-foreground">
              · {formatCurrency(order.total)}
            </span>
          </p>
          {byAdmin && (
            <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
              Our team cancelled this order with the reason above. If you have
              questions, reach out to support.
            </p>
          )}
          {info.comment && (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <MessageSquareQuote size={13} className="mt-0.5 shrink-0" /> {info.comment}
            </p>
          )}
        </>
      )}

      {/* refund status */}
      {refundLine && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold",
            refundLine.tone === "amber" &&
              "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            refundLine.tone === "green" &&
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            refundLine.tone === "red" &&
              "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          )}
        >
          {refundLine.tone === "amber" ? (
            <Hourglass size={13} className="shrink-0" />
          ) : refundLine.tone === "green" ? (
            <Check size={13} className="shrink-0" />
          ) : (
            <XCircle size={13} className="shrink-0" />
          )}
          {refundLine.text}
        </p>
      )}
      {refund?.status === "DECLINED" && refund.adminNote && (
        <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
          Note from us: {refund.adminNote}
        </p>
      )}
      {order.paymentStatus === "PENDING" && !refund && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          No payment was collected for this order.
        </p>
      )}
      {info && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Cancelled {formatDate(info.at)}
        </p>
      )}
    </div>
  );
}

/** Cancel flow — the customer must pick a reason (an optional note
 *  can be added). Paid orders create a refund request that an admin
 *  approves, never an instant auto-refund. */
function CancelRequestDialog({
  order,
  onDone,
}: {
  order: OrderDTO;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasPaid = order.paymentStatus === "PAID";
  // Browser/mobile Back closes this dialog and returns to the exact
  // orders tab the user came from — never navigates away.
  useBackClose(open, () => setOpen(false));

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiOrders.cancel(order.id, {
        reason,
        comment: comment.trim() || undefined,
      });
      toast({
        title: "Order cancelled",
        description: wasPaid
          ? `${order.orderNumber} is cancelled — your refund of ${formatCurrency(order.total)} will be processed once approved.`
          : `${order.orderNumber} has been cancelled.`,
      });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setReason("");
          setComment("");
          setError("");
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full text-red-600 hover:text-red-700 dark:text-red-400"
          disabled={busy}
        >
          <XCircle size={14} /> Cancel order
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="grid max-h-[min(90dvh,36rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0">
        <AlertDialogHeader className="px-4 pb-3 pt-4 text-left sm:px-6 sm:pt-5">
          <AlertDialogTitle className="flex items-start gap-2.5 text-left text-base sm:text-lg">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 sm:h-9 sm:w-9">
              <XCircle size={15} />
            </span>
            <span className="min-w-0">
              Cancel order{" "}
              <span className="break-all font-mono text-[12.5px] font-semibold text-muted-foreground sm:text-sm">
                {order.orderNumber}
              </span>
              ?
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-[13px] leading-relaxed">
            Please tell us why you&apos;re cancelling — it helps us improve.{" "}
            {wasPaid
              ? `Your refund of ${formatCurrency(order.total)} will be processed to your original payment method once it's approved.`
              : "No payment has been collected for this order."}{" "}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* scrollable body — the 7-reason list never grows past the
            viewport, so the action buttons below stay reachable on
            every phone */}
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-1 sm:px-6">
          <div>
            <Label className="text-[13px] font-semibold sm:text-sm">
              Reason for cancellation <span className="text-red-600 dark:text-red-400">*</span>
            </Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => {
                setReason(v);
                setError("");
              }}
              className="mt-2 gap-1.5 sm:gap-2"
            >
              {CANCEL_REASONS.map((r) => (
                <Label
                  key={r.value}
                  htmlFor={`can-${r.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-xl border p-2 text-left transition-all duration-200 sm:items-center sm:gap-2.5 sm:p-2.5",
                    reason === r.value
                      ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                      : "hover:border-primary/40"
                  )}
                >
                  <RadioGroupItem id={`can-${r.value}`} value={r.value} className="mt-0.5 sm:mt-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug sm:text-sm">{r.label}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground sm:text-xs">{r.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor={`can-comment-${order.id}`} className="text-[13px] font-semibold sm:text-sm">
              Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`can-comment-${order.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Ordered the wrong size…"
              rows={3}
              maxLength={400}
              className="mt-1.5 resize-none text-sm"
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* stacked full-width buttons on phones, side by side on sm+ */}
        <AlertDialogFooter className="flex-col gap-2 px-4 pb-4 pt-3 sm:flex-row sm:justify-end sm:px-6 sm:pb-5">
          <AlertDialogCancel className="mt-0 rounded-xl" disabled={busy}>
            Go back (keep order)
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 font-bold text-white shadow-pop-3d transition-all hover:bg-red-700 disabled:opacity-50"
            disabled={!reason || busy}
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open until the API settles
              submit();
            }}
          >
            {busy ? "Cancelling…" : "Yes, cancel order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OrderCard({ order, onCancelled }: { order: OrderDTO; onCancelled: () => void }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[order.status] ?? STATUS_META.PENDING;
  const canCancel = order.status === "PENDING" || order.status === "PROCESSING";
  // Returns: delivered orders can be returned — but once a return is
  // declined (REJECTED) the order is closed for further return requests,
  // so the "Return items" button stays hidden for good.
  const returnDeclined = order.returnInfo?.status === "REJECTED";
  const canReturn = order.status === "DELIVERED" && !returnDeclined;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-card-3d transition-all duration-300 hover:border-primary/25">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/5 to-transparent px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Order</p>
            <p className="font-mono font-semibold">{order.orderNumber}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Placed</p>
            <p className="font-medium">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="font-extrabold tracking-tight">{formatCurrency(order.total)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("gap-1 font-semibold", meta.className)}>
            {meta.label}
          </Badge>
          {returnDeclined && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-300"
            >
              <Undo2 size={12} /> Return declined
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 rounded-full font-medium">
            <PaymentIcon method={order.paymentMethod} />
            {order.paymentMethod}
            {order.paymentStatus === "PAID" && " · Paid"}
            {order.paymentStatus === "PENDING" && " · Unpaid"}
            {order.paymentStatus === "REFUND_PENDING" && " · Refund pending"}
            {order.paymentStatus === "REFUNDED" && " · Refunded"}
          </Badge>
        </div>
      </div>

      {/* body */}
      <div className="px-4 py-4 sm:px-5">
        {/* items preview */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-3">
            {order.items.slice(0, 4).map((i) => (
              <img
                key={i.id}
                src={i.image || PLACEHOLDER_IMAGE}
                alt=""
                className="h-12 w-12 rounded-xl border-2 border-card bg-muted object-cover shadow-sm"
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {order.items.length} {order.items.length === 1 ? "item" : "items"}
          </p>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="ml-auto flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            aria-expanded={open}
          >
            {open ? "Hide details" : "View details"}
            <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {/* timeline */}
        <div className="mt-4 overflow-x-auto pb-1">
          <StatusTimeline status={order.status} createdAt={order.createdAt} />
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* items */}
            <div className="space-y-2.5">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:border-primary/25">
                  <img
                    src={i.image || PLACEHOLDER_IMAGE}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(i.price)} × {i.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-bold tracking-tight">{formatCurrency(i.price * i.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* address */}
              {order.addressLine && (
                <div className="rounded-2xl border p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <MapPin size={12} /> Shipping address
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">
                    {order.shippingName}
                    <br />
                    <span className="text-muted-foreground">
                      {order.addressLine}
                      <br />
                      {order.city}, {order.state} {order.zipCode}
                      <br />
                      {order.country}
                    </span>
                  </p>
                </div>
              )}
              {/* totals + tracking */}
              <div className="space-y-3">
                {order.trackingNumber && (
                  <div className="rounded-2xl border p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <Truck size={12} /> Tracking number
                    </p>
                    <button
                      type="button"
                      onClick={() => copy(order.trackingNumber!)}
                      className="mt-1.5 flex items-center gap-1.5 font-mono text-sm font-semibold transition-colors hover:text-primary"
                    >
                      <Copy size={12} /> {order.trackingNumber}
                    </button>
                  </div>
                )}
                <div className="rounded-2xl border p-3.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="mt-1 flex justify-between text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <Ticket size={13} /> Coupon {order.couponCode}
                      </span>
                      <span>−{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span>{order.shippingFee === 0 ? "FREE" : formatCurrency(order.shippingFee)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between border-t pt-1.5 font-extrabold tracking-tight">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Return status — always visible (not just in expanded
            details) so a requested, approved or declined return is
            clear at a glance in the deliveries list. */}
        {order.returnInfo && (
          <div className="mt-4">
            <ReturnBanner info={order.returnInfo} />
          </div>
        )}

        {/* Cancelled status — who cancelled it, why, and the refund
            state (pending approval / refunded / declined). */}
        {order.status === "CANCELLED" && (
          <div className="mt-4">
            <CancelledBanner order={order} />
          </div>
        )}

        {/* return / cancel actions */}
        {(canReturn || canCancel) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            {canReturn && <ReturnRequestDialog order={order} onDone={onCancelled} />}
            {canCancel && <CancelRequestDialog order={order} onDone={onCancelled} />}
          </div>
        )}
      </div>
    </article>
  );
}

export function OrdersView() {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const openAuth = useAppStore((s) => s.openAuth);
  const navigate = useAppStore((s) => s.navigate);
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  // The active filter tab survives a page refresh (restored from
  // sessionStorage on mount), so reloading keeps the user on the
  // exact tab they were viewing instead of resetting to All.
  const [filter, setFilter] = useState<"ALL" | OrderStatus>(() => {
    if (typeof window === "undefined") return "ALL";
    try {
      const v = window.sessionStorage.getItem(ORDERS_FILTER_KEY);
      const valid = ["ALL", ...FLOW, "CANCELLED", "RETURN_REQUESTED", "RETURNED"];
      return v && valid.includes(v) ? (v as "ALL" | OrderStatus) : "ALL";
    } catch {
      return "ALL";
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(ORDERS_FILTER_KEY, filter);
    } catch {
      /* private mode / quota — ignore */
    }
  }, [filter]);

  const load = () => {
    apiOrders
      .mine()
      .then((r) => setOrders(r.orders))
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  // Live updates: every server-side notification (status change,
  // return approved/declined…) mirrors an order mutation, so any
  // push refreshes the list — the deliveries view reflects admin
  // actions immediately, without a manual page refresh.
  useEffect(() => {
    if (!authReady || !user) return;
    return subscribeToNotifications(() => {
      load();
    });
  }, [authReady, user]);

  if (!authReady) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-12 sm:px-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Package size={32} />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Track your orders</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sign in to see your order history and live status updates.
        </p>
        <Button
          size="lg"
          className="shine-host mt-6 rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
          onClick={() => openAuth("login", "Sign in to view your orders")}
        >
          Sign in
        </Button>
      </div>
    );
  }

  const counts = (orders ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const visible = (orders ?? []).filter((o) => filter === "ALL" || o.status === filter);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
        <Package size={13} /> Orders
      </p>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight sm:text-3xl">My Orders</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Track deliveries and manage your purchases.
      </p>

      {/* status filter — scrolls horizontally with soft edge fades
          (chips melt into the edge instead of truncating mid-word) */}
      <FadingScroller
        className="mb-6"
        contentClassName="flex gap-2 pb-1"
        fadeSize={22}
      >
        {(["ALL", ...FLOW, "CANCELLED", "RETURN_REQUESTED", "RETURNED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5",
              filter === s
                ? "border-primary bg-gradient-primary text-primary-foreground shadow-md hover:translate-y-0"
                : "bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
            )}
          >
            {s === "ALL" ? "All orders" : STATUS_META[s].label}
            {s !== "ALL" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </FadingScroller>

      {orders === null ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border bg-card px-6 py-16 text-center shadow-card-3d">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
            <PackageSearch size={28} />
          </span>
          <h2 className="mt-5 text-lg font-extrabold tracking-tight">
            {filter === "ALL" ? "No orders yet" : `No ${STATUS_META[filter].label.toLowerCase()} orders`}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            When you place an order, it shows up here with live status updates.
          </p>
          <Button
            className="shine-host mt-5 rounded-full bg-gradient-primary px-6 font-semibold shadow-md hover:brightness-110"
            onClick={() => navigate({ name: "catalog" })}
          >
            Start shopping <ArrowRight size={15} />
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} onCancelled={load} />
          ))}
        </div>
      )}
    </div>
  );
}
