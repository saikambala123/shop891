// ──────────────────────────────────────────────────────────────
// ShopVerse — Server-side auth utilities
// JWT (HS256) sessions delivered via HTTP-only cookie `sv_token`.
// Passwords hashed with bcrypt. RBAC helpers for API routes.
// ──────────────────────────────────────────────────────────────
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Role, SessionPayload } from "@/lib/types";

const JWT_SECRET =
  process.env.JWT_SECRET || "shopverse-dev-secret-change-in-production";

const secretKey = new TextEncoder().encode(JWT_SECRET);

export const AUTH_COOKIE = "sv_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ── Passwords ─────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT ───────────────────────────────────────────────────────

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("shopverse")
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "shopverse",
    });
    if (!payload.userId || !payload.role) return null;
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

// ── Request helpers ───────────────────────────────────────────

export function getTokenFromRequest(req: NextRequest): string | null {
  // HTTP-only cookie first, then Authorization: Bearer fallback
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie) return cookie;
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Returns the session when the caller is authenticated AND (optionally)
 * has one of the allowed roles. Otherwise returns null — callers should
 * respond with 401/403 accordingly.
 */
export async function requireRole(
  req: NextRequest,
  allowed?: Role[]
): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session) return null;
  if (allowed && !allowed.includes(session.role)) return null;
  return session;
}

// ── Cookie responses ──────────────────────────────────────────

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Local dev may run over plain HTTP; production (Vercel) is always HTTPS.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  };
}

export function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(AUTH_COOKIE, token, authCookieOptions());
  return res;
}

export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set(AUTH_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
  return res;
}
