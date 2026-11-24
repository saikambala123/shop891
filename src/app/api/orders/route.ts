import { NextRequest, NextResponse } from "next/server";
import { CartItem, Coupon, Order, Product, connectDB, idOf, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import {
  HttpError,
  asString,
  firstImage,
  generateLicenseKey,
  generateOrderNumber,
  jsonError,
  readJson,
  rollbackDecrement,
  round2,
  serializeOrder,
  validateCouponForCheckout,
} from "@/lib/api-utils";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS: PaymentMethod[] = ["CARD", "UPI"];

// Server-side money constants (₹ INR) — mirrors src/lib/api.ts.
const SHIPPING_FEE = 49;
const FREE_SHIPPING_THRESHOLD = 499;

const ADDRESS_FIELDS = [
  "fullName",
  "phone",
  "street",
  "city",
  "state",
  "zipCode",
  "country",
] as const;

// ── GET /api/orders — the current user's orders ───────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const orders = await Order.find({ user: oid(session.userId) })
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .lean();
    return NextResponse.json({ orders: orders.map(serializeOrder) });
  } catch (err) {
    console.error("[api/orders GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/orders — checkout ───────────────────────────────
// Uses atomic per-item stock decrements with rollback on failure
// (works on standalone MongoDB and Atlas shared tiers — no
// multi-document transactions required).

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const paymentMethod = asString((body as any).paymentMethod) as PaymentMethod;
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return jsonError("Invalid payment method", 400);
    }

    const rawAddress = (body as any).address;
    const address =
      rawAddress && typeof rawAddress === "object"
        ? (rawAddress as Record<string, unknown>)
        : null;

    // Optional "Buy Now" item — when present the order is built from
    // this single product and the user's cart is left untouched.
    const rawDirect = (body as any).directItem;
    let directItem: { productId: string; quantity: number } | null = null;
    if (rawDirect && typeof rawDirect === "object") {
      const pid = asString((rawDirect as any).productId);
      const qty = Number((rawDirect as any).quantity);
      if (!pid || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        return jsonError("Invalid buy-now item", 400);
      }
      directItem = { productId: pid, quantity: qty };
    }

    await connectDB();
    const userId = oid(session.userId)!;

    // 1. Build the order lines — either the single "Buy Now" product
    //    or the user's full cart (with products).
    let lines: any[];
    if (directItem) {
      const product = await Product.findById(oid(directItem.productId)).lean();
      if (!product) return jsonError("Product not found", 404);
      lines = [{ product, quantity: directItem.quantity }];
    } else {
      const cartItems = await CartItem.find({ user: userId })
        .sort({ createdAt: 1 })
        .populate("product")
        .lean();
      lines = cartItems.filter((ci: any) => ci.product);
    }
    if (lines.length === 0) {
      return jsonError("Your cart is empty", 400);
    }

    // 2. Stock validation for physical goods
    const outOfStock = lines.filter(
      (ci: any) => !ci.product.isDigital && ci.product.stock < ci.quantity
    );
    if (outOfStock.length > 0) {
      return jsonError(
        directItem
          ? `${lines[0].product.name} is out of stock`
          : `Some items in your cart are out of stock: ${outOfStock
              .map((ci: any) => ci.product.name)
              .join(", ")}`,
        400
      );
    }

    const hasPhysical = lines.some((ci: any) => !ci.product.isDigital);

    // 4. Address required for physical shipments
    if (hasPhysical) {
      if (!address) {
        return jsonError("Shipping address is required", 400);
      }
      for (const field of ADDRESS_FIELDS) {
        if (!asString(address[field]).trim()) {
          return jsonError("Shipping address is incomplete", 400);
        }
      }
    }

    // 5. Totals (₹ INR) — an optional coupon is validated against
    //    the subtotal. GST removed — prices are final.
    const subtotal = round2(
      lines.reduce((s: number, ci: any) => s + ci.product.price * ci.quantity, 0)
    );

    let discount = 0;
    let couponCode: string | null = null;
    let couponDoc: any = null;
    if (asString((body as any).couponCode).trim()) {
      try {
        const applied = await validateCouponForCheckout(
          (body as any).couponCode,
          subtotal,
          session.userId // first-order-only coupons are enforced here
        );
        if (applied) {
          discount = applied.discount;
          couponCode = applied.coupon.code;
          couponDoc = applied.coupon;
        }
      } catch (err) {
        if (err instanceof HttpError) return jsonError(err.message, err.status);
        throw err;
      }
    }

    const discountedSubtotal = round2(subtotal - discount);
    const shippingFee =
      !hasPhysical || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const tax = 0; // GST removed
    const total = round2(discountedSubtotal + shippingFee + tax);
    const paymentStatus = "PAID" as const;

    // 6. Atomically decrement stock / bump sold counters (with rollback)
    const decremented: { productId: string; quantity: number; isPhysical: boolean }[] = [];
    try {
      for (const ci of lines as any[]) {
        const productOid = ci.product._id;
        if (ci.product.isDigital) {
          const r = await Product.updateOne(
            { _id: productOid },
            { $inc: { soldCount: ci.quantity } }
          );
          if (r.matchedCount === 0) {
            throw new HttpError(`${ci.product.name} is no longer available`, 400);
          }
          decremented.push({
            productId: idOf(productOid),
            quantity: ci.quantity,
            isPhysical: false,
          });
        } else {
          const r = await Product.updateOne(
            { _id: productOid, stock: { $gte: ci.quantity } },
            { $inc: { stock: -ci.quantity, soldCount: ci.quantity } }
          );
          if (r.matchedCount === 0) {
            throw new HttpError(
              `${ci.product.name} just went out of stock. Please update your cart.`,
              400
            );
          }
          decremented.push({
            productId: idOf(productOid),
            quantity: ci.quantity,
            isPhysical: true,
          });
        }
      }

      // 7. Unique order number
      let orderNumber = generateOrderNumber();
      while (await Order.findOne({ orderNumber }).select("_id").lean()) {
        orderNumber = generateOrderNumber();
      }

      // 8. Create order with item snapshots
      const order = await Order.create({
        orderNumber,
        user: userId,
        status: "PENDING",
        paymentMethod,
        paymentStatus,
        subtotal,
        shippingFee,
        tax,
        discount,
        couponCode,
        total,
        shippingName: asString(address?.fullName).trim() || null,
        shippingPhone: asString(address?.phone).trim() || null,
        addressLine: asString(address?.street).trim() || null,
        city: asString(address?.city).trim() || null,
        state: asString(address?.state).trim() || null,
        zipCode: asString(address?.zipCode).trim() || null,
        country: asString(address?.country).trim() || null,
        items: (lines as any[]).map((ci) => ({
          product: ci.product._id,
          name: ci.product.name,
          image: firstImage(ci.product),
          price: ci.product.price,
          quantity: ci.quantity,
          isDigital: ci.product.isDigital,
          licenseKey: ci.product.isDigital ? generateLicenseKey() : null,
        })),
      });

      // 9. Count the coupon redemption
      if (couponDoc) {
        await Coupon.updateOne(
          { _id: couponDoc._id },
          { $inc: { usageCount: 1 } }
        );
      }

      // 10. Clear the cart — only for cart checkouts; a direct
      //     "Buy Now" order leaves the cart untouched.
      if (!directItem) {
        await CartItem.deleteMany({ user: userId });
      }

      // 11. "Order placed" notification (+ real-time push)
      await createNotification({
        user: userId,
        kind: "placed",
        title: "Order placed",
        body: `Order ${orderNumber} is confirmed`,
        amount: total,
        orderNumber,
        read: false,
      }).catch(() => undefined);

      const populated = await Order.findById(order._id)
        .populate("user", "name email")
        .lean();
      return NextResponse.json({ order: serializeOrder(populated) }, { status: 201 });
    } catch (err) {
      // Compensating rollback for any successful decrements
      if (decremented.length > 0) {
        await rollbackDecrement(decremented).catch(() => undefined);
      }
      if (err instanceof HttpError) return jsonError(err.message, err.status);
      throw err;
    }
  } catch (err) {
    console.error("[api/orders POST]", err);
    return jsonError("Internal server error", 500);
  }
}
