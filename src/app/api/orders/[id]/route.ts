import { NextRequest, NextResponse } from "next/server";
import { Order, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import {
  generateTrackingNumber,
  jsonError,
  readJson,
  restockItems,
  serializeOrder,
} from "@/lib/api-utils";
import {
  ADMIN_CANCEL_REASON_LABELS,
  CANCEL_REASON_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUS_NOTIFICATION: Record<
  string,
  { kind: string; title: string; body: (n: string) => string }
> = {
  PROCESSING: {
    kind: "processing",
    title: "Order processing",
    body: (n) => `We're preparing ${n} for dispatch`,
  },
  SHIPPED: {
    kind: "shipped",
    title: "Order shipped",
    body: (n) => `${n} is on its way`,
  },
  DELIVERED: {
    kind: "delivered",
    title: "Order delivered",
    body: (n) => `${n} was delivered — enjoy!`,
  },
  CANCELLED: {
    kind: "cancelled",
    title: "Order cancelled",
    body: (n) => `${n} was cancelled`,
  },
  RETURN_REQUESTED: {
    kind: "return",
    title: "Return requested",
    body: (n) => `We received your return request for ${n}`,
  },
  RETURNED: {
    kind: "return",
    title: "Return approved",
    body: (n) => `Return for ${n} is approved — refund on its way`,
  },
};

async function notifyStatus(order: any, status: string) {
  const meta = STATUS_NOTIFICATION[status];
  if (!meta) return;
  await createNotification({
    user: order.user?._id ?? order.user,
    kind: meta.kind,
    title: meta.title,
    body: meta.body(order.orderNumber),
    amount: order.total,
    orderNumber: order.orderNumber,
    read: false,
  }).catch(() => undefined);
}

/** Human label for a cancel reason code (falls back to raw text). */
function cancelReasonLabel(reason: string): string {
  return (
    CANCEL_REASON_LABELS[reason] ??
    ADMIN_CANCEL_REASON_LABELS[reason] ??
    reason
  );
}

// ── GET /api/orders/[id] — owner or admin

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const orderOid = oid(id);
    const order = orderOid
      ? await Order.findById(orderOid).populate("user", "name email").lean()
      : null;
    if (!order) return jsonError("Order not found", 404);

    const isOwner = String(order.user?._id ?? order.user) === session.userId;
    const isAdmin = session.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json({ order: serializeOrder(order) });
  } catch (err) {
    console.error("[api/orders/[id] GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── PATCH /api/orders/[id] ────────────────────────────────────
//  { action: "cancel", reason, comment? }    → order owner cancels (reason required)
//  { action: "return-request", reason, comment? } → owner requests a return (DELIVERED orders)
//  { action: "return-resolve", approve, note? }   → admin approves/declines a return
//  { action: "refund-resolve", approve, note? }   → admin approves/declines a pending refund
//  { status, reason?, comment?, trackingNumber? } → admin updates status
//    (status CANCELLED requires `reason` — the customer is notified with it)

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    await connectDB();
    const orderOid = oid(id);
    const order = orderOid
      ? await Order.findById(orderOid).populate("user", "name email").lean()
      : null;
    if (!order) return jsonError("Order not found", 404);

    // ── Mode 1: customer cancel (a reason is required) ──
    if ((body as any).action === "cancel") {
      if (String(order.user?._id ?? order.user) !== session.userId) {
        return jsonError("Forbidden", 403);
      }
      if (order.status !== "PENDING" && order.status !== "PROCESSING") {
        return jsonError("This order can no longer be cancelled", 400);
      }

      const reason = asStringTrim((body as any).reason);
      if (!reason) {
        return jsonError("Please choose a reason for cancelling this order", 400);
      }
      const comment = asStringTrim((body as any).comment) || null;
      const wasPaid = order.paymentStatus === "PAID";
      const now = new Date();

      // Refunds never process automatically: a paid order that gets
      // cancelled moves to REFUND_PENDING and an admin must approve
      // (or decline) the refund from the console.
      const updated = await Order.findOneAndUpdate(
        {
          _id: order._id,
          user: oid(session.userId),
          status: { $in: ["PENDING", "PROCESSING"] },
        },
        {
          $set: {
            status: "CANCELLED",
            ...(wasPaid ? { paymentStatus: "REFUND_PENDING" } : {}),
            cancelInfo: { reason, comment, by: "USER", at: now },
            ...(wasPaid
              ? {
                  refundInfo: {
                    amount: order.total,
                    origin: "USER_CANCEL",
                    status: "PENDING",
                    requestedAt: now,
                    resolvedAt: null,
                    adminNote: null,
                  },
                }
              : {}),
          },
        },
        { returnDocument: "after" }
      )
        .populate("user", "name email")
        .lean();
      if (!updated) {
        return jsonError("This order can no longer be cancelled", 400);
      }

      await restockItems(
        order.items.map((i: any) => ({
          product: i.product ? String(i.product) : null,
          quantity: i.quantity,
          isDigital: i.isDigital,
        }))
      );

      // Tell the customer what happens to their money next.
      await createNotification({
        user: updated.user?._id ?? updated.user,
        kind: "cancelled",
        title: "Order cancelled",
        body: wasPaid
          ? `${updated.orderNumber} was cancelled — your refund of ₹${updated.total} is awaiting approval`
          : `${updated.orderNumber} was cancelled`,
        amount: updated.total,
        orderNumber: updated.orderNumber,
        read: false,
      }).catch(() => undefined);
      return NextResponse.json({ order: serializeOrder(updated) });
    }

    // ── Mode 1b: customer requests a return (delivered orders) ──
    if ((body as any).action === "return-request") {
      if (String(order.user?._id ?? order.user) !== session.userId) {
        return jsonError("Forbidden", 403);
      }
      if (order.status !== "DELIVERED") {
        return jsonError("Only delivered orders can be returned", 400);
      }

      const reason = asStringTrim((body as any).reason);
      if (!reason) return jsonError("Please choose a return reason", 400);
      const comment = asStringTrim((body as any).comment) || null;

      // Conditional update guards against concurrent status changes
      const updated = await Order.findOneAndUpdate(
        {
          _id: order._id,
          user: oid(session.userId),
          status: "DELIVERED",
        },
        {
          $set: {
            status: "RETURN_REQUESTED",
            returnInfo: {
              reason,
              comment,
              status: "REQUESTED",
              refundAmount: order.total,
              requestedAt: new Date(),
              resolvedAt: null,
              adminNote: null,
            },
          },
        },
        { returnDocument: "after" }
      )
        .populate("user", "name email")
        .lean();
      if (!updated) {
        return jsonError("Only delivered orders can be returned", 400);
      }

      await notifyStatus(updated, "RETURN_REQUESTED");
      return NextResponse.json({ order: serializeOrder(updated) });
    }

    // ── Mode 1c: admin approves / declines a return ──
    if ((body as any).action === "return-resolve") {
      if (session.role !== "ADMIN") {
        return jsonError("Forbidden", 403);
      }
      if (order.status !== "RETURN_REQUESTED" || !order.returnInfo) {
        return jsonError("No pending return request on this order", 400);
      }

      const approve = Boolean((body as any).approve);
      const note = asStringTrim((body as any).note) || null;

      if (approve) {
        // Approve: mark returned, refund the payment, restock items.
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, status: "RETURN_REQUESTED" },
          {
            $set: {
              status: "RETURNED",
              paymentStatus:
                order.paymentStatus === "PAID" ? "REFUNDED" : order.paymentStatus,
              "returnInfo.status": "APPROVED",
              "returnInfo.resolvedAt": new Date(),
              "returnInfo.adminNote": note,
            },
          },
          { returnDocument: "after" }
        )
          .populate("user", "name email")
          .lean();
        if (!updated) {
          return jsonError("No pending return request on this order", 400);
        }
        await restockItems(
          order.items.map((i: any) => ({
            product: i.product ? String(i.product) : null,
            quantity: i.quantity,
            isDigital: i.isDigital,
          }))
        );
        await notifyStatus(updated, "RETURNED");
        return NextResponse.json({ order: serializeOrder(updated) });
      }

      // Decline: order goes back to delivered, reason recorded.
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: "RETURN_REQUESTED" },
        {
          $set: {
            status: "DELIVERED",
            "returnInfo.status": "REJECTED",
            "returnInfo.resolvedAt": new Date(),
            "returnInfo.adminNote": note,
          },
        },
        { returnDocument: "after" }
      )
        .populate("user", "name email")
        .lean();
      if (!updated) {
        return jsonError("No pending return request on this order", 400);
      }
      await createNotification({
        user: updated.user?._id ?? updated.user,
        kind: "return",
        title: "Return declined",
        body: `We couldn't approve the return for ${updated.orderNumber}${note ? ` — ${note}` : ""}`,
        amount: updated.total,
        orderNumber: updated.orderNumber,
        read: false,
      }).catch(() => undefined);
      return NextResponse.json({ order: serializeOrder(updated) });
    }

    // ── Mode 1d: admin approves / declines a pending refund ──
    // Cancellation refunds are never automatic — the customer's
    // cancel moves a paid order to REFUND_PENDING and the admin
    // decides here whether the money actually goes back.
    if ((body as any).action === "refund-resolve") {
      if (session.role !== "ADMIN") {
        return jsonError("Forbidden", 403);
      }
      if (order.paymentStatus !== "REFUND_PENDING") {
        return jsonError("No pending refund on this order", 400);
      }

      const approve = Boolean((body as any).approve);
      const note = asStringTrim((body as any).note) || null;
      const refundAmount = order.refundInfo?.amount ?? order.total;

      if (approve) {
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, paymentStatus: "REFUND_PENDING" },
          {
            $set: {
              paymentStatus: "REFUNDED",
              "refundInfo.status": "APPROVED",
              "refundInfo.resolvedAt": new Date(),
              "refundInfo.adminNote": note,
            },
          },
          { returnDocument: "after" }
        )
          .populate("user", "name email")
          .lean();
        if (!updated) {
          return jsonError("No pending refund on this order", 400);
        }
        await createNotification({
          user: updated.user?._id ?? updated.user,
          kind: "refund",
          title: "Refund approved",
          body: `Your refund of ₹${refundAmount} for ${updated.orderNumber} has been approved — it will reach your original payment method in 3–5 business days.`,
          amount: refundAmount,
          orderNumber: updated.orderNumber,
          read: false,
        }).catch(() => undefined);
        return NextResponse.json({ order: serializeOrder(updated) });
      }

      // Decline: the cancellation stands but the payment is kept.
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: "REFUND_PENDING" },
        {
          $set: {
            paymentStatus: "PAID",
            "refundInfo.status": "DECLINED",
            "refundInfo.resolvedAt": new Date(),
            "refundInfo.adminNote": note,
          },
        },
        { returnDocument: "after" }
      )
        .populate("user", "name email")
        .lean();
      if (!updated) {
        return jsonError("No pending refund on this order", 400);
      }
      await createNotification({
        user: updated.user?._id ?? updated.user,
        kind: "refund",
        title: "Refund declined",
        body: `We couldn't approve the refund for ${updated.orderNumber}${note ? ` — ${note}` : ""}. Contact support if you believe this is a mistake.`,
        amount: refundAmount,
        orderNumber: updated.orderNumber,
        read: false,
      }).catch(() => undefined);
      return NextResponse.json({ order: serializeOrder(updated) });
    }

    // ── Mode 2: admin status update ──
    if (session.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const status = (body as any).status as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) {
      return jsonError("Invalid status", 400);
    }

    const providedTracking = asStringTrim((body as any).trackingNumber);
    let trackingNumber: string | undefined = providedTracking || undefined;
    if (status === "SHIPPED" && !trackingNumber) {
      trackingNumber = generateTrackingNumber();
    }

    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      // Admin cancels must carry a reason — the customer is
      // notified with it and it shows on their order.
      const reason = asStringTrim((body as any).reason);
      if (!reason) {
        return jsonError(
          "Please choose a reason — the customer is notified with it",
          400
        );
      }
      const comment = asStringTrim((body as any).comment) || null;
      const wasPaid = order.paymentStatus === "PAID";
      const now = new Date();

      const updated = await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            status,
            ...(trackingNumber !== undefined ? { trackingNumber } : {}),
            ...(wasPaid ? { paymentStatus: "REFUND_PENDING" } : {}),
            cancelInfo: { reason, comment, by: "ADMIN", at: now },
            ...(wasPaid
              ? {
                  refundInfo: {
                    amount: order.total,
                    origin: "ADMIN_CANCEL",
                    status: "PENDING",
                    requestedAt: now,
                    resolvedAt: null,
                    adminNote: null,
                  },
                }
              : {}),
          },
        },
        { returnDocument: "after" }
      )
        .populate("user", "name email")
        .lean();
      if (!updated) {
        return jsonError("Order not found", 404);
      }
      await restockItems(
        order.items.map((i: any) => ({
          product: i.product ? String(i.product) : null,
          quantity: i.quantity,
          isDigital: i.isDigital,
        }))
      );
      const reasonLabel = cancelReasonLabel(reason);
      await createNotification({
        user: updated.user?._id ?? updated.user,
        kind: "cancelled",
        title: "Order cancelled by the store",
        body: `${updated.orderNumber} was cancelled by us — ${reasonLabel}${comment ? `: ${comment}` : ""}${wasPaid ? `. Your refund of ₹${updated.total} is awaiting approval` : ""}`,
        amount: updated.total,
        orderNumber: updated.orderNumber,
        read: false,
      }).catch(() => undefined);
      return NextResponse.json({ order: serializeOrder(updated) });
    }

    const updated = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          status,
          ...(trackingNumber !== undefined ? { trackingNumber } : {}),
        },
      },
      { returnDocument: "after" }
    )
      .populate("user", "name email")
      .lean();
    await notifyStatus(updated, status);
    return NextResponse.json({ order: serializeOrder(updated) });
  } catch (err) {
    console.error("[api/orders/[id] PATCH]", err);
    return jsonError("Internal server error", 500);
  }
}

function asStringTrim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
