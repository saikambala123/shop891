import { NextRequest, NextResponse } from "next/server";
import { Coupon, connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  HttpError,
  asString,
  assertCouponEligibility,
  computeCouponDiscount,
  jsonError,
  readJson,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// ── POST /api/coupons/validate — quote a coupon for a subtotal ─
// Public endpoint used by the checkout summary. Returns the exact
// discount the coupon yields so the UI and the server always agree.
// First-order-only coupons (e.g. WELCOME10) are rejected for any
// customer who already placed an order.
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const code = asString((body as any).code).trim().toUpperCase();
    if (!code) return jsonError("Enter a coupon code", 400);

    const subtotal = Number((body as any).subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return jsonError("Invalid subtotal", 400);
    }

    // Session is optional at quote time, but required for
    // first-order-only coupons (checkout is sign-in gated anyway).
    const session = await getSession(req);

    await connectDB();
    const coupon = await Coupon.findOne({ code }).lean();
    if (!coupon) {
      return jsonError("This coupon code doesn't exist", 404);
    }
    try {
      await assertCouponEligibility(coupon, subtotal, session?.userId);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.message, err.status);
      throw err;
    }

    const discount = computeCouponDiscount(coupon, subtotal);
    if (discount <= 0) {
      return jsonError("This coupon gives no discount on this order", 400);
    }

    return NextResponse.json({
      quote: {
        code: coupon.code,
        description: coupon.description ?? "",
        type: coupon.type,
        value: coupon.value,
        discount,
        firstOrderOnly: Boolean(coupon.firstOrderOnly),
      },
    });
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.message, err.status);
    console.error("[api/coupons/validate]", err);
    return jsonError("Internal server error", 500);
  }
}
