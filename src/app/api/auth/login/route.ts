import { NextRequest, NextResponse } from "next/server";
import { User, connectDB } from "@/lib/db";
import { setAuthCookie, signToken, verifyPassword } from "@/lib/auth";
import { asString, jsonError, readJson, serializeUser } from "@/lib/api-utils";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const email = asString((body as any).email).trim().toLowerCase();
    const password = asString((body as any).password);
    if (!email || !password) {
      return jsonError("Invalid email or password", 401);
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return jsonError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid email or password", 401);
    }

    const token = await signToken({
      userId: String(user._id),
      email: user.email,
      role: user.role as Role,
    });
    const res = NextResponse.json({ user: serializeUser(user) });
    return setAuthCookie(res, token);
  } catch (err) {
    console.error("[api/auth/login]", err);
    return jsonError("Internal server error", 500);
  }
}
