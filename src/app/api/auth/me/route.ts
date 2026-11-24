import { NextRequest, NextResponse } from "next/server";
import { User, connectDB, idOf } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { asString, jsonError, readJson, serializeUser } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// GET /api/auth/me — current session's user (fresh DB fetch)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return jsonError("Not authenticated", 401);
    }
    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user) {
      return jsonError("Not authenticated", 401);
    }
    return NextResponse.json({ user: serializeUser(user) });
  } catch (err) {
    console.error("[api/auth/me GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// PUT /api/auth/me — update profile (name, phone, savedAddress)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return jsonError("Not authenticated", 401);
    }

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const name = asString((body as any).name).trim();
    if (name.length < 2) {
      return jsonError("Name must be at least 2 characters", 400);
    }

    const data: {
      name: string;
      phone?: string | null;
      savedAddress?: Record<string, string> | null;
    } = { name };
    if ("phone" in (body as any)) {
      const phone = asString((body as any).phone).trim();
      data.phone = phone === "" ? null : phone;
    }

    // Optional saved shipping address — validated field by field so a
    // partial/garbage payload can never poison the checkout prefill.
    if ("savedAddress" in (body as any)) {
      const raw = (body as any).savedAddress;
      if (raw === null) {
        data.savedAddress = null;
      } else if (typeof raw === "object") {
        const field = (key: string, max = 160) =>
          typeof raw[key] === "string" ? (raw[key] as string).trim().slice(0, max) : "";
        const addr = {
          fullName: field("fullName"),
          phone: field("phone", 24),
          street: field("street"),
          city: field("city", 80),
          state: field("state", 80),
          zipCode: field("zipCode", 12),
          country: field("country", 80) || "India",
        };
        const filled =
          addr.fullName && addr.phone && addr.street && addr.city && addr.state && addr.zipCode;
        if (!filled) {
          return jsonError("Saved address is missing required fields", 400);
        }
        data.savedAddress = addr;
      } else {
        return jsonError("savedAddress must be an object or null", 400);
      }
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(
      idOf(session.userId),
      { $set: data },
      { returnDocument: "after" }
    ).lean();
    if (!user) {
      return jsonError("Not authenticated", 401);
    }
    return NextResponse.json({ user: serializeUser(user) });
  } catch (err) {
    console.error("[api/auth/me PUT]", err);
    return jsonError("Internal server error", 500);
  }
}
