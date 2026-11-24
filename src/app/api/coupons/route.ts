import { NextRequest, NextResponse } from "next/server";
import { Coupon, connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  asString,
  authenticate,
  countCustomerOrders,
  isCouponLive,
  jsonError,
  readJson,
  serializeCoupon,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// ── GET /api/coupons ──────────────────────────────────────────
// ADMIN: full coupon list for management.
// ?public=1 : public-safe projection of live coupons (storefront
// hints shown at checkout). No auth required. First-order-only
// coupons (e.g. WELCOME10) are hidden once the signed-in customer
// has any order — pending, processing or delivered alike — so the
// code is never teased on a second order.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;

    if (sp.get("public") === "1") {
      const live = await Coupon.find({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();

      // Signed-in customers who already placed an order must not
      // see first-order-only coupons anymore.
      let hasOrders = false;
      const session = await getSession(req).catch(() => null);
      if (session?.userId) {
        hasOrders = (await countCustomerOrders(session.userId)) > 0;
      }

      return NextResponse.json({
        coupons: live
          .filter((c: any) => !(hasOrders && c.firstOrderOnly))
          .map((c: any) => ({
            code: c.code,
            description: c.description ?? "",
            type: c.type,
            value: c.value,
            minOrderAmount: c.minOrderAmount ?? 0,
            firstOrderOnly: Boolean(c.firstOrderOnly),
          })),
      });
    }

    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ coupons: coupons.map(serializeCoupon) });
  } catch (err) {
    console.error("[api/coupons GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/coupons — create (ADMIN only) ──────────────────

function parseCouponBody(body: Record<string, unknown>) {
  const code = asString(body.code).trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) {
    return { error: "Code must be 3-24 characters (A-Z, 0-9, -)" as const };
  }
  const type = body.type === "FIXED" ? "FIXED" : "PERCENT";
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Value must be greater than 0" as const };
  }
  if (type === "PERCENT" && value > 90) {
    return { error: "Percent discount cannot exceed 90%" as const };
  }
  const minOrderAmount = Math.max(0, Number(body.minOrderAmount) || 0);
  let maxDiscountAmount: number | null = null;
  if (body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== null && body.maxDiscountAmount !== "") {
    const cap = Number(body.maxDiscountAmount);
    if (!Number.isFinite(cap) || cap <= 0) {
      return { error: "Max discount must be greater than 0" as const };
    }
    maxDiscountAmount = cap;
  }
  let expiresAt: Date | null = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
    const d = new Date(String(body.expiresAt));
    if (Number.isNaN(d.getTime())) {
      return { error: "Invalid expiry date" as const };
    }
    expiresAt = d;
  }
  const description = asString(body.description).trim();
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  const firstOrderOnly = body.firstOrderOnly === undefined ? false : Boolean(body.firstOrderOnly);

  return {
    data: {
      code,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      expiresAt,
      isActive,
      firstOrderOnly,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = parseCouponBody(body as Record<string, unknown>);
    if ("error" in parsed && parsed.error) return jsonError(parsed.error, 400);
    if (!("data" in parsed) || !parsed.data) return jsonError("Invalid coupon", 400);

    await connectDB();

    const existing = await Coupon.findOne({ code: parsed.data.code })
      .select("_id")
      .lean();
    if (existing) {
      return jsonError("A coupon with this code already exists", 409);
    }

    const created = await Coupon.create(parsed.data);
    return NextResponse.json(
      { coupon: serializeCoupon(created) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/coupons POST]", err);
    return jsonError("Internal server error", 500);
  }
}
