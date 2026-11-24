// ──────────────────────────────────────────────────────────────
// shop-891 — Real email delivery (SMTP via nodemailer)
// Sends transactional email (password-reset codes, etc.)
// through a real SMTP account configured in .env — Gmail by
// default (smtp.gmail.com:465 + App Password).
//
// .env:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=<16-char Gmail App Password>
//   SMTP_FROM=shop-891 <you@gmail.com>   (optional)
// ──────────────────────────────────────────────────────────────
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = (process.env.SMTP_USER || "").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "").trim();
const SMTP_FROM =
  (process.env.SMTP_FROM || "").trim() ||
  (SMTP_USER ? `shop-891 <${SMTP_USER}>` : "");

/** True only when a real SMTP account (user + password) is set. */
export function isMailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

// ── Transporter (cached across requests / hot reloads) ───────

type TransporterCache = { transporter: nodemailer.Transporter | null };
const globalForMail = globalThis as unknown as {
  _shopverseMailer?: TransporterCache;
};
const cached: TransporterCache =
  globalForMail._shopverseMailer ?? { transporter: null };
globalForMail._shopverseMailer = cached;

function getTransporter(): nodemailer.Transporter {
  if (!cached.transporter) {
    cached.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for 587 (STARTTLS)
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });
  }
  return cached.transporter;
}

// ── Public API ────────────────────────────────────────────────

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a real email through SMTP. Throws when delivery fails so
 * callers can surface an honest error to the user.
 */
export async function sendMail(opts: MailOptions): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP_NOT_CONFIGURED: set SMTP_USER and SMTP_PASS in .env to enable real email delivery."
    );
  }
  try {
    await getTransporter().sendMail({
      from: SMTP_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  } catch (err) {
    console.error("[mailer] send failed:", err);
    throw new Error("EMAIL_SEND_FAILED");
  }
}

// ── Branded email templates ───────────────────────────────────

const BRAND = {
  name: "shop-891",
  accent: "#f59e0b", // amber — matches the storefront theme
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
};

function emailShell(inner: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND.card};border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
              <span style="font-size:20px;font-weight:800;color:${BRAND.text};letter-spacing:0.5px;">
                shop<span style="color:${BRAND.accent};">-891</span>
              </span>
            </td>
          </tr>
          <tr><td style="padding:28px;">${inner}</td></tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e2e8f0;color:${BRAND.muted};font-size:12px;line-height:1.5;">
              This is an automated message from shop-891 — please do not reply.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Password-reset verification code email. */
export function resetCodeEmail(code: string, minutes: number) {
  const spaced = code.split("").join(" ");
  return {
    subject: `${code} is your shop-891 password reset code`,
    html: emailShell(`
      <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND.text};">Reset your password</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.text};">
        We received a request to reset the password for your shop-891 account.
        Enter this verification code to choose a new password:
      </p>
      <div style="margin:0 0 16px;padding:16px;background:#fffbeb;border:1px dashed ${BRAND.accent};border-radius:12px;text-align:center;">
        <span style="font-size:32px;font-weight:800;letter-spacing:10px;color:${BRAND.text};">${spaced}</span>
      </div>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${BRAND.text};">
        This code expires in <strong>${minutes} minutes</strong>.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
        If you didn&apos;t request a password reset, you can safely ignore this
        email — your password will stay unchanged.
      </p>
    `),
    text: [
      "Reset your password",
      "",
      `Your shop-891 verification code is: ${code}`,
      `It expires in ${minutes} minutes.`,
      "",
      "If you didn't request a password reset, you can safely ignore this email.",
    ].join("\n"),
  };
}
