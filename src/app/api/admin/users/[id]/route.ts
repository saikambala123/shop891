import { NextRequest, NextResponse } from "next/server";
import { Order, User, connectDB, idOf, oid } from "@/lib/db";
import { authenticate, jsonError, readJson, round2, toIso } from "@/lib/api-utils";
import { ROLES, type AdminUser, type Role } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function buildAdminUser(id: string): Promise<AdminUser | null> {
  const user = await User.findById(id).lean();
  if (!user) return null;
  const orders = await Order.find({ user: (user as any)._id })
    .select("total status")
    .lean();
  return {
    id: idOf((user as any)._id),
    name: (user as any).name,
    email: (user as any).email,
    role: (user as any).role as Role,
    createdAt: toIso((user as any).createdAt),
    orderCount: orders.length,
    totalSpent: round2(
      orders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((s, o) => s + o.total, 0)
    ),
  };
}

// PUT /api/admin/users/[id] — change a user's role (ADMIN only)
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await ctx.params;

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const role = body.role as Role;
    if (!ROLES.includes(role)) {
      return jsonError("Invalid role", 400);
    }
    if (id === session.userId) {
      return jsonError("You cannot change your own role", 400);
    }

    await connectDB();
    const targetOid = oid(id);
    const target = targetOid ? await User.findById(targetOid).lean() : null;
    if (!target) return jsonError("User not found", 404);

    await User.updateOne({ _id: (target as any)._id }, { $set: { role } });

    const user = await buildAdminUser(String((target as any)._id));
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[api/admin/users/[id] PUT]", err);
    return jsonError("Internal server error", 500);
  }
}
