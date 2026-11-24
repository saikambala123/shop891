import { NextRequest, NextResponse } from "next/server";
import { User, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError, readJson, serializeUser } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const ADDRESS_LABELS = ["Home", "Office", "Other"] as const;

type Ctx = { params: Promise<{ id: string }> };

/** Validate + normalize an address payload. */
function parseAddress(raw: unknown): {
  ok: true;
  value: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    label: string;
  };
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Address must be an object" };
  }
  const b = raw as Record<string, unknown>;
  const str = (v: unknown, max = 160) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const value = {
    fullName: str(b.fullName, 80),
    phone: str(b.phone, 24),
    street: str(b.street),
    city: str(b.city, 80),
    state: str(b.state, 80),
    zipCode: str(b.zipCode, 12),
    country: str(b.country, 80) || "India",
    label: ADDRESS_LABELS.includes(str(b.label, 24) as (typeof ADDRESS_LABELS)[number])
      ? str(b.label, 24)
      : "Home",
  };
  if (!value.fullName) return { ok: false, error: "Full name is required" };
  if (!/^[+\d][\d\s()-]{6,}$/.test(value.phone)) {
    return { ok: false, error: "Enter a valid phone number" };
  }
  if (!value.street) return { ok: false, error: "Street address is required" };
  if (!value.city) return { ok: false, error: "City is required" };
  if (!value.state) return { ok: false, error: "State is required" };
  if (!/^[0-9A-Za-z\s-]{3,10}$/.test(value.zipCode)) {
    return { ok: false, error: "Enter a valid PIN code" };
  }
  return { ok: true, value };
};

// ── PUT /api/addresses/[id] — update an address (and optionally
//    make it the default) ──────────────────────────────────────
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const { id } = await ctx.params;
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = parseAddress((body as any).address ?? body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const makeDefault =
      (body as any).isDefault === undefined
        ? false
        : Boolean((body as any).isDefault);

    await connectDB();
    const userId = oid(session.userId)!;
    const user = await User.findById(userId).lean();
    if (!user) return jsonError("Not authenticated", 401);

    const existing = ((user.addresses as any[]) ?? []).find(
      (a) => String(a._id) === id
    );
    if (!existing) return jsonError("Address not found", 404);

    const willBeDefault = makeDefault || Boolean(existing.isDefault);

    if (willBeDefault && !existing.isDefault) {
      // demote the current default(s), then promote this one
      await User.updateOne(
        { _id: userId, "addresses.isDefault": true },
        { $set: { "addresses.$[a].isDefault": false } },
        { arrayFilters: [{ "a.isDefault": true }] }
      );
    }

    const updated = await User.findOneAndUpdate(
      { _id: userId, "addresses._id": oid(id) },
      {
        $set: {
          "addresses.$.fullName": parsed.value.fullName,
          "addresses.$.phone": parsed.value.phone,
          "addresses.$.street": parsed.value.street,
          "addresses.$.city": parsed.value.city,
          "addresses.$.state": parsed.value.state,
          "addresses.$.zipCode": parsed.value.zipCode,
          "addresses.$.country": parsed.value.country,
          "addresses.$.label": parsed.value.label,
          "addresses.$.isDefault": willBeDefault,
        },
      },
      { returnDocument: "after" }
    ).lean();
    return NextResponse.json({ user: serializeUser(updated) });
  } catch (err) {
    console.error("[api/addresses/[id] PUT]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── PATCH /api/addresses/[id] — quick action: set as default ──
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const { id } = await ctx.params;
    await connectDB();
    const userId = oid(session.userId)!;
    const user = await User.findById(userId).lean();
    if (!user) return jsonError("Not authenticated", 401);

    const existing = ((user.addresses as any[]) ?? []).find(
      (a) => String(a._id) === id
    );
    if (!existing) return jsonError("Address not found", 404);

    // demote current default(s)
    await User.updateOne(
      { _id: userId, "addresses.isDefault": true },
      { $set: { "addresses.$[a].isDefault": false } },
      { arrayFilters: [{ "a.isDefault": true }] }
    );
    const updated = await User.findOneAndUpdate(
      { _id: userId, "addresses._id": oid(id) },
      { $set: { "addresses.$.isDefault": true } },
      { returnDocument: "after" }
    ).lean();
    return NextResponse.json({ user: serializeUser(updated) });
  } catch (err) {
    console.error("[api/addresses/[id] PATCH]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── DELETE /api/addresses/[id] — remove an address ────────────
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const { id } = await ctx.params;
    await connectDB();
    const userId = oid(session.userId)!;
    const user = await User.findById(userId).lean();
    if (!user) return jsonError("Not authenticated", 401);

    const existing = ((user.addresses as any[]) ?? []).find(
      (a) => String(a._id) === id
    );
    if (!existing) return jsonError("Address not found", 404);

    const wasDefault = Boolean(existing.isDefault);
    await User.updateOne(
      { _id: userId },
      { $pull: { addresses: { _id: oid(id) } } }
    );

    // If the removed address was the default, promote the first
    // remaining one (if any) so there is always a usable default.
    if (wasDefault) {
      const after = await User.findById(userId).lean();
      const remaining = (after?.addresses as any[]) ?? [];
      if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
        await User.updateOne(
          { _id: userId },
          { $set: { "addresses.0.isDefault": true } }
        );
      }
    }

    const updated = await User.findById(userId).lean();
    return NextResponse.json({ user: serializeUser(updated) });
  } catch (err) {
    console.error("[api/addresses/[id] DELETE]", err);
    return jsonError("Internal server error", 500);
  }
}
