import { NextRequest, NextResponse } from "next/server";
import { Order, connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError, serializeOrder } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// GET /api/orders/all — ADMIN only: every order in the store.
// Optional: ?status=PENDING&search=...
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);
    if (session.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status")?.trim() || undefined;
    const search = (sp.get("search") || "").trim().toLowerCase();

    await connectDB();

    const where: Record<string, unknown> = status ? { status } : {};
    let orders: any[] = await Order.find(where)
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .lean();

    if (search) {
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search) ||
          (o.user?.name ?? "").toLowerCase().includes(search) ||
          (o.user?.email ?? "").toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ orders: orders.map(serializeOrder) });
  } catch (err) {
    console.error("[api/orders/all]", err);
    return jsonError("Internal server error", 500);
  }
}
