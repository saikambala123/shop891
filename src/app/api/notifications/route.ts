import { NextRequest, NextResponse } from "next/server";
import { Notification, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

function serialize(n: any) {
  return {
    id: String(n._id),
    kind: n.kind,
    title: n.title,
    body: n.body,
    amount: n.amount ?? null,
    orderNumber: n.orderNumber ?? null,
    read: Boolean(n.read),
    createdAt: (n.createdAt ?? new Date()).toISOString(),
  };
}

// ── GET /api/notifications — the user's feed + unread count ──

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const userId = oid(session.userId)!;
    const [docs, unreadCount] = await Promise.all([
      Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
      Notification.countDocuments({ user: userId, read: false }),
    ]);
    return NextResponse.json({
      notifications: docs.map(serialize),
      unreadCount,
    });
  } catch (err) {
    console.error("[api/notifications GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/notifications — mark all as read ────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const userId = oid(session.userId)!;
    await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/notifications POST]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── DELETE /api/notifications — clear the whole feed ──────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const userId = oid(session.userId)!;
    await Notification.deleteMany({ user: userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/notifications DELETE]", err);
    return jsonError("Internal server error", 500);
  }
}
