import { NextRequest, NextResponse } from "next/server";
import { CartItem, Product, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  asString,
  getCartPayload,
  jsonError,
  readJson,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const CART_401 = () => jsonError("Sign in to use your cart", 401);

/** Cap a quantity at the product stock for physical goods. */
function capQuantity(quantity: number, product: { isDigital: boolean; stock: number }) {
  if (product.isDigital) return quantity;
  return Math.max(0, Math.min(quantity, product.stock));
}

// ── GET /api/cart ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return CART_401();
    await connectDB();
    const payload = await getCartPayload(session.userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/cart GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/cart — add { productId, quantity } ──────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return CART_401();

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const productId = asString((body as any).productId).trim();
    if (!productId) return jsonError("productId is required", 400);

    const rawQty = Math.trunc(Number((body as any).quantity ?? 1));
    const quantity = Number.isFinite(rawQty) && rawQty >= 1 ? rawQty : 1;

    await connectDB();
    const productOid = oid(productId);
    const product = productOid
      ? await Product.findById(productOid).lean()
      : null;
    if (!product || !product.isActive) {
      return jsonError("Product not found", 404);
    }
    if (!product.isDigital && product.stock <= 0) {
      return jsonError("Product is out of stock", 400);
    }

    const filter = { user: oid(session.userId)!, product: product._id };
    const existing = await CartItem.findOne(filter).lean();

    if (existing) {
      await CartItem.updateOne(
        { _id: existing._id },
        { $set: { quantity: capQuantity(existing.quantity + quantity, product) } }
      );
    } else {
      await CartItem.create({
        user: filter.user,
        product: product._id,
        quantity: Math.max(1, capQuantity(quantity, product)),
      });
    }

    const payload = await getCartPayload(session.userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/cart POST]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── PUT /api/cart — set quantity { productId, quantity } ──────

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return CART_401();

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const productId = asString((body as any).productId).trim();
    if (!productId) return jsonError("productId is required", 400);

    const quantity = Math.trunc(Number((body as any).quantity));
    if (!Number.isFinite(quantity)) {
      return jsonError("Invalid quantity", 400);
    }

    await connectDB();
    const productOid = oid(productId);
    const filter = { user: oid(session.userId)!, product: productOid };
    const existing = await CartItem.findOne(filter).lean();

    if (quantity <= 0) {
      if (existing) {
        await CartItem.deleteOne({ _id: existing._id });
      }
    } else {
      const product = productOid
        ? await Product.findById(productOid).lean()
        : null;
      if (!product || !product.isActive) {
        return jsonError("Product not found", 404);
      }
      if (!product.isDigital && product.stock <= 0) {
        return jsonError("Product is out of stock", 400);
      }
      const capped = capQuantity(quantity, product);
      if (capped <= 0) {
        if (existing) {
          await CartItem.deleteOne({ _id: existing._id });
        }
      } else if (existing) {
        await CartItem.updateOne(
          { _id: existing._id },
          { $set: { quantity: capped } }
        );
      } else {
        await CartItem.create({
          user: filter.user,
          product: product._id,
          quantity: capped,
        });
      }
    }

    const payload = await getCartPayload(session.userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/cart PUT]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── DELETE /api/cart?productId=... ────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return CART_401();

    const productId = req.nextUrl.searchParams.get("productId")?.trim();
    if (!productId) return jsonError("productId is required", 400);

    await connectDB();
    const productOid = oid(productId);
    if (productOid) {
      await CartItem.deleteMany({ user: oid(session.userId), product: productOid });
    }

    const payload = await getCartPayload(session.userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/cart DELETE]", err);
    return jsonError("Internal server error", 500);
  }
}
