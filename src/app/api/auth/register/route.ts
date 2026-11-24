import { NextRequest, NextResponse } from "next/server";
import { User, connectDB } from "@/lib/db";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { asString, jsonError, readJson, serializeUser } from "@/lib/api-utils";
import { createNotification } from "@/lib/notify";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const name = asString((body as any).name).trim();
    const email = asString((body as any).email).trim().toLowerCase();
    const password = asString((body as any).password);
    // Public registration always creates a customer (USER) account.
    // Any `role` field in the body is ignored — ADMIN can never be
    // created through the public register endpoint.
    const role: Role = "USER";

    if (name.length < 2) {
      return jsonError("Name must be at least 2 characters", 400);
    }
    if (!EMAIL_RE.test(email)) {
      return jsonError("Invalid email address", 400);
    }
    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return jsonError("An account with this email already exists", 409);
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
    });

    // Welcome notification so a brand-new account already has a feed
    await createNotification({
      user: user._id,
      kind: "welcome",
      title: `Welcome to shop-891, ${name.split(" ")[0]}!`,
      body: "Your account is ready — browse deals, save wishlists and track orders in one place.",
      read: false,
    }).catch(() => undefined);

    const token = await signToken({
      userId: String(user._id),
      email: user.email,
      role: user.role as Role,
    });
    const res = NextResponse.json({ user: serializeUser(user) });
    return setAuthCookie(res, token);
  } catch (err) {
    console.error("[api/auth/register]", err);
    return jsonError("Internal server error", 500);
  }
}
