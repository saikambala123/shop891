import { NextRequest, NextResponse } from "next/server";
import { User, connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { asString, jsonError, readJson } from "@/lib/api-utils";
import { isMailConfigured, resetCodeEmail, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60_000; // one code request per email per minute

// Simple in-memory rate limiter (email → last request time).
// Survives hot reloads via globalThis; per-email cooldown keeps
// the real mail account from being abused for spam.
const globalForRate = globalThis as unknown as {
  _shopverseResetLimiter?: Map<string, number>;
};
const limiter: Map<string, number> =
  globalForRate._shopverseResetLimiter ?? new Map();
globalForRate._shopverseResetLimiter = limiter;

// POST /api/auth/forgot-password — request a reset code.
// A real 6-digit one-time code (valid 10 minutes) is generated
// and EMAILD to the account via SMTP. The code is never included
// in the API response.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const email = asString((body as any).email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return jsonError("Enter a valid email address", 400);
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return jsonError("No account exists with this email", 404);
    }

    // Rate limit — one request per email per minute.
    const last = limiter.get(email) ?? 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
      return jsonError(
        `A code was recently sent. Please wait ${wait}s before requesting another.`,
        429
      );
    }

    // A real SMTP account must be wired up before codes can be emailed.
    if (!isMailConfigured()) {
      console.warn(
        "[forgot-password] SMTP not configured — set SMTP_USER / SMTP_PASS in the environment to enable reset emails. See EMAIL-SETUP.md"
      );
      return jsonError(
        "We couldn't send a reset code right now — email delivery isn't set up on the server. Please try again later.",
        503
      );
    }

    // 6-digit code, stored hashed, valid for 10 minutes.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    const mail = resetCodeEmail(code, CODE_TTL_MINUTES);
    try {
      await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      if (reason === "EMAIL_SEND_FAILED") {
        return jsonError(
          "We couldn't send the email right now. Please try again in a moment.",
          502
        );
      }
      return jsonError("Email delivery failed. Please try again.", 502);
    }

    // Email is on its way — persist the (hashed) code for verification.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetOtpHash: await hashPassword(code),
          resetOtpExpires: expires,
        },
      }
    );
    limiter.set(email, Date.now());

    return NextResponse.json({
      success: true,
      message: `Reset code emailed to ${email}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    });
  } catch (err) {
    console.error("[api/auth/forgot-password]", err);
    return jsonError("Internal server error", 500);
  }
}
