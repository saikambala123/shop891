import { NextRequest, NextResponse } from "next/server";
import { User, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { jsonError, readJson, serializeUser } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const ADDRESS_LABELS = ["Home", "Office", "Other"] as const;

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
}

// ── GET /api/addresses — list the signed-in user's address book ─
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const user = await User.findById(oid(session.userId)).lean();
    if (!user) return jsonError("Not authenticated", 401);

    return NextResponse.json({ user: serializeUser(user) });
  } catch (err) {
    console.error("[api/addresses GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/addresses — add a new saved address ─────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

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

    const current = (user.addresses as any[]) ?? [];
    if (current.length >= 6) {
      return jsonError(
        "You can save up to 6 addresses — remove one first",
        400
      );
    }

    // First address (or an explicit default) always becomes the default.
    const willBeDefault = makeDefault || current.length === 0;

    // demote the existing default(s) first
    if (willBeDefault && current.length > 0) {
      await User.updateOne(
        { _id: userId, "addresses.isDefault": true },
        { $set: { "addresses.$[a].isDefault": false } },
        { arrayFilters: [{ "a.isDefault": true }] }
      );
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          addresses: { ...parsed.value, isDefault: willBeDefault },
        },
      },
      { returnDocument: "after" }
    ).lean();
    return NextResponse.json({ user: serializeUser(updated) }, { status: 201 });
  } catch (err) {
    console.error("[api/addresses POST]", err);
    return jsonError("Internal server error", 500);
  }
}
