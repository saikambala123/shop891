import { NextRequest, NextResponse } from "next/server";
import { User, connectDB } from "@/lib/db";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { asString, jsonError, readJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// PUT /api/auth/password — change password
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

    const currentPassword = asString((body as any).currentPassword);
    const newPassword = asString((body as any).newPassword);
    if (!currentPassword || !newPassword) {
      return jsonError("Current and new password are required", 400);
    }

    await connectDB();
    const user = await User.findById(session.userId).lean();
    if (!user) {
      return jsonError("Not authenticated", 401);
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return jsonError("Current password is incorrect", 400);
    }
    if (newPassword.length < 8) {
      return jsonError("New password must be at least 8 characters", 400);
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(newPassword) } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/password]", err);
    return jsonError("Internal server error", 500);
  }
}
