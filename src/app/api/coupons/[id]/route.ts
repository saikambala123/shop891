import { NextRequest, NextResponse } from "next/server";
import { Coupon, connectDB, oid } from "@/lib/db";
import {
  asString,
  authenticate,
  jsonError,
  readJson,
  serializeCoupon,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// ── PUT /api/coupons/[id] — update (ADMIN only) ───────────────
// The admin can change every attribute at any time (code, value,
// min order, cap, expiry, active toggle).
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await ctx.params;
    const couponOid = oid(id);
    if (!couponOid) return jsonError("Invalid coupon id", 400);

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    await connectDB();
    const coupon = await Coupon.findById(couponOid).lean();
    if (!coupon) return jsonError("Coupon not found", 404);

    const data: Record<string, unknown> = {};

    if ("code" in (body as any)) {
      const code = asString((body as any).code).trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) {
        return jsonError("Code must be 3-24 characters (A-Z, 0-9, -)", 400);
      }
      if (code !== coupon.code) {
        const clash = await Coupon.findOne({ code }).select("_id").lean();
        if (clash) {
          return jsonError("A coupon with this code already exists", 409);
        }
      }
      data.code = code;
    }
    if ("description" in (body as any)) {
      data.description = asString((body as any).description).trim();
    }
    if ("type" in (body as any)) {
      data.type = (body as any).type === "FIXED" ? "FIXED" : "PERCENT";
    }
    if ("value" in (body as any)) {
      const value = Number((body as any).value);
      if (!Number.isFinite(value) || value <= 0) {
        return jsonError("Value must be greater than 0", 400);
      }
      const type = (data.type as string) ?? coupon.type;
      if (type === "PERCENT" && value > 90) {
        return jsonError("Percent discount cannot exceed 90%", 400);
      }
      data.value = value;
    }
    if ("minOrderAmount" in (body as any)) {
      data.minOrderAmount = Math.max(0, Number((body as any).minOrderAmount) || 0);
    }
    if ("maxDiscountAmount" in (body as any)) {
      const raw = (body as any).maxDiscountAmount;
      if (raw === null || raw === undefined || raw === "") {
        data.maxDiscountAmount = null;
      } else {
        const cap = Number(raw);
        if (!Number.isFinite(cap) || cap <= 0) {
          return jsonError("Max discount must be greater than 0", 400);
        }
        data.maxDiscountAmount = cap;
      }
    }
    if ("expiresAt" in (body as any)) {
      const raw = (body as any).expiresAt;
      if (raw === null || raw === undefined || raw === "") {
        data.expiresAt = null;
      } else {
        const d = new Date(String(raw));
        if (Number.isNaN(d.getTime())) {
          return jsonError("Invalid expiry date", 400);
        }
        data.expiresAt = d;
      }
    }
    if ("isActive" in (body as any)) {
      data.isActive = Boolean((body as any).isActive);
    }
    if ("firstOrderOnly" in (body as any)) {
      data.firstOrderOnly = Boolean((body as any).firstOrderOnly);
    }

    const updated = await Coupon.findByIdAndUpdate(
      couponOid,
      { $set: data },
      { returnDocument: "after" }
    ).lean();

    return NextResponse.json({ coupon: serializeCoupon(updated) });
  } catch (err) {
    console.error("[api/coupons/[id] PUT]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── DELETE /api/coupons/[id] — remove (ADMIN only) ────────────
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await ctx.params;
    const couponOid = oid(id);
    if (!couponOid) return jsonError("Invalid coupon id", 400);

    await connectDB();
    const deleted = await Coupon.findByIdAndDelete(couponOid).lean();
    if (!deleted) return jsonError("Coupon not found", 404);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/coupons/[id] DELETE]", err);
    return jsonError("Internal server error", 500);
  }
}
