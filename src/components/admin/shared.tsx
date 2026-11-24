// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard shared pieces (badges, states)
// ──────────────────────────────────────────────────────────────
"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus, Role } from "@/lib/types";

// ── Order status meta (PENDING amber / PROCESSING orange / SHIPPED
//    teal / DELIVERED emerald / CANCELLED red / RETURN_* violet-rose)
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  PROCESSING: {
    label: "Processing",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  SHIPPED: {
    label: "Shipped",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  DELIVERED: {
    label: "Delivered",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
  },
  RETURN_REQUESTED: {
    label: "Return requested",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  RETURNED: {
    label: "Returned",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        meta.badge,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

// ── Payment status ────────────────────────────────────────────
const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Unpaid",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  REFUND_PENDING: {
    label: "Refund pending",
    className:
      "bg-orange-100 text-orange-700 ring-1 ring-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800",
  },
  REFUNDED: {
    label: "Refunded",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

export function PaymentMethodBadge({ method }: { method: string }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {method}
    </span>
  );
}

// ── Role badge (ADMIN red / USER neutral) ─────────────────────
export function RoleBadge({ role }: { role: Role }) {
  if (role === "ADMIN") {
    return (
      <span className="inline-flex w-fit items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      Customer
    </span>
  );
}

// ── Error state with retry ────────────────────────────────────
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message ?? "Please try again in a moment."}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="mt-2">
            <RotateCw /> Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
