import { NextRequest, NextResponse } from "next/server";
import { User, connectDB } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { asString, jsonError, readJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// POST /api/auth/reset-password — verify code, set a fresh password
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const email = asString((body as any).email).trim().toLowerCase();
    const code = asString((body as any).code).trim();
    const newPassword = asString((body as any).newPassword);

    if (!email || !/^\d{6}$/.test(code)) {
      return jsonError("Email and 6-digit code are required", 400);
    }
    if (newPassword.length < 8) {
      return jsonError("New password must be at least 8 characters", 400);
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return jsonError("No account exists with this email", 404);
    }

    const resetOtpHash = (user as { resetOtpHash?: string | null }).resetOtpHash;
    const resetOtpExpires = (user as { resetOtpExpires?: Date | null }).resetOtpExpires;

    if (!resetOtpHash || !resetOtpExpires) {
      return jsonError("No reset code was requested. Start again.", 400);
    }
    if (new Date(resetOtpExpires).getTime() < Date.now()) {
      return jsonError("Reset code expired — request a new one", 400);
    }

    const valid = await verifyPassword(code, resetOtpHash);
    if (!valid) {
      return jsonError("Incorrect verification code", 400);
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: await hashPassword(newPassword) },
        $unset: { resetOtpHash: "", resetOtpExpires: "" },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/reset-password]", err);
    return jsonError("Internal server error", 500);
  }
}
