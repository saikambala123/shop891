import { NextRequest, NextResponse } from "next/server";
import { CartItem, Product, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { asString, getCartPayload, jsonError, readJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// POST /api/cart/merge — merge a guest cart after login.
// Invalid / out-of-stock products are skipped gracefully.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Sign in to use your cart", 401);

    const body = await readJson(req);
    if (!body || typeof body !== "object" || !Array.isArray((body as any).items)) {
      return jsonError("Invalid JSON body", 400);
    }

    await connectDB();
    const userId = oid(session.userId)!;

    for (const raw of (body as any).items as unknown[]) {
      const productId =
        typeof raw === "object" && raw !== null
          ? asString((raw as any).productId).trim()
          : "";
      if (!productId) continue;
      const parsedQty =
        typeof raw === "object" && raw !== null
          ? Math.trunc(Number((raw as any).quantity ?? 1))
          : 1;
      const quantity = Number.isFinite(parsedQty) && parsedQty >= 1 ? parsedQty : 1;

      const productOid = oid(productId);
      const product = productOid
        ? await Product.findById(productOid).lean()
        : null;
      if (!product || !product.isActive) continue;
      if (!product.isDigital && product.stock <= 0) continue;

      const cap = (q: number) =>
        product.isDigital ? q : Math.max(0, Math.min(q, product.stock));

      const existing = await CartItem.findOne({ user: userId, product: product._id }).lean();
      if (existing) {
        await CartItem.updateOne(
          { _id: existing._id },
          { $set: { quantity: cap(existing.quantity + quantity) } }
        );
      } else {
        await CartItem.create({
          user: userId,
          product: product._id,
          quantity: Math.max(1, cap(quantity)),
        });
      }
    }

    const payload = await getCartPayload(session.userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/cart/merge]", err);
    return jsonError("Internal server error", 500);
  }
}
