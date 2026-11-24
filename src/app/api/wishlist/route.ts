import { NextRequest, NextResponse } from "next/server";
import { Product, WishlistItem, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { asString, jsonError, readJson, serializeProduct } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// ── GET /api/wishlist — wishlisted products, newest first ─────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const items = await WishlistItem.find({ user: oid(session.userId) })
      .sort({ createdAt: -1 })
      .populate("product")
      .lean();
    return NextResponse.json({
      products: items
        .filter((i: any) => i.product)
        .map((i: any) => serializeProduct(i.product)),
    });
  } catch (err) {
    console.error("[api/wishlist GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/wishlist — toggle { productId } ─────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const productId = asString((body as any).productId).trim();
    if (!productId) return jsonError("productId is required", 400);

    await connectDB();
    const productOid = oid(productId);
    const product = productOid
      ? await Product.findById(productOid).select("_id").lean()
      : null;
    if (!product) return jsonError("Product not found", 404);

    const userId = oid(session.userId)!;
    const existing = await WishlistItem.findOne({
      user: userId,
      product: product._id,
    }).lean();

    let added: boolean;
    if (existing) {
      await WishlistItem.deleteOne({ _id: existing._id });
      added = false;
    } else {
      await WishlistItem.create({ user: userId, product: product._id });
      added = true;
    }

    const all = await WishlistItem.find({ user: userId })
      .select("product")
      .lean();
    return NextResponse.json({
      added,
      productIds: all.map((w) => String(w.product)),
    });
  } catch (err) {
    console.error("[api/wishlist POST]", err);
    return jsonError("Internal server error", 500);
  }
}
