import { NextRequest, NextResponse } from "next/server";
import { Order, User, connectDB, idOf } from "@/lib/db";
import { authenticate, containsRegex, jsonError, round2, toIso } from "@/lib/api-utils";
import type { AdminUser } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/admin/users?search= — all users with order stats (ADMIN only)
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    const search = req.nextUrl.searchParams.get("search")?.trim() || "";

    await connectDB();
    const where = search
      ? { $or: [{ name: containsRegex(search) }, { email: containsRegex(search) }] }
      : {};
    const users = await User.find(where).sort({ createdAt: -1 }).lean();

    const orders = await Order.find({}).select("user total status").lean();
    const orderCountByUser = new Map<string, number>();
    const spentByUser = new Map<string, number>();
    for (const o of orders) {
      const key = idOf(o.user);
      orderCountByUser.set(key, (orderCountByUser.get(key) ?? 0) + 1);
      if (o.status !== "CANCELLED") {
        spentByUser.set(key, (spentByUser.get(key) ?? 0) + o.total);
      }
    }

    const payload: AdminUser[] = users.map((u: any) => ({
      id: idOf(u._id),
      name: u.name,
      email: u.email,
      role: u.role as AdminUser["role"],
      createdAt: toIso(u.createdAt),
      orderCount: orderCountByUser.get(idOf(u._id)) ?? 0,
      totalSpent: round2(spentByUser.get(idOf(u._id)) ?? 0),
    }));

    return NextResponse.json({ users: payload });
  } catch (err) {
    console.error("[api/admin/users GET]", err);
    return jsonError("Internal server error", 500);
  }
}
