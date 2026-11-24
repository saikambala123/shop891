// ──────────────────────────────────────────────────────────────
// ShopVerse — Shared API route helpers (server only)
// Mongoose-backed serializers, query helpers and domain logic.
// ──────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from "next/server";
import { CartItem, Coupon, Order, Product as ProductModel, idOf, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { PLACEMENTS } from "@/lib/types";
import type {
  CouponDTO,
  OrderDTO,
  Placement,
  Product,
  ReviewDTO,
  SessionPayload,
  SessionUser,
} from "@/lib/types";

// ── Errors ────────────────────────────────────────────────────

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Thrown inside request handlers for clean 4xx responses. */
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── Auth helper (distinguishes 401 vs 403) ────────────────────

export async function authenticate(
  req: NextRequest,
  roles?: SessionPayload["role"][]
): Promise<
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse }
> {
  const session = await getSession(req);
  if (!session) return { error: jsonError("Not authenticated", 401) };
  if (roles && !roles.includes(session.role)) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { session };
}

// ── Body parsing ──────────────────────────────────────────────

export async function readJson<T = Record<string, unknown>>(
  req: NextRequest
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

// ── Numbers ───────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parses a non-negative float query param; null when absent/invalid. */
export function parsePositiveFloat(
  v: string | null | undefined
): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parses an integer query param; null when absent/invalid. */
export function parseIntSafe(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : null;
}

// ── Regex helpers (search) ────────────────────────────────────

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsRegex(text: string): RegExp {
  return new RegExp(escapeRegex(text), "i");
}

// ── Images ────────────────────────────────────────────────────

export function firstImage(product: { images?: unknown }): string {
  if (Array.isArray(product.images)) {
    const img = product.images.find((i) => typeof i === "string" && i.length > 0);
    return img ?? "";
  }
  return "";
}

// ── Date helpers ──────────────────────────────────────────────

export function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function toDayKey(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

/** Last N days (UTC, today included) zero-filled revenue buckets. */
export function initSalesByDay(
  days = 14
): { date: string; revenue: number; orders: number }[] {
  const out: { date: string; revenue: number; orders: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    );
    out.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
  }
  return out;
}

// ── Serializers (Mongoose documents → API DTOs) ───────────────

export function serializeProduct(p: any): Product {
  return {
    id: idOf(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    brand: p.brand,
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? null,
    images: Array.isArray(p.images) ? p.images : [],
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    specs: Array.isArray(p.specs) ? p.specs : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    stock: p.stock,
    isDigital: p.isDigital,
    isActive: p.isActive,
    placements: Array.isArray(p.placements) ? p.placements : [],
    rating: p.rating,
    reviewCount: p.reviewCount,
    soldCount: p.soldCount,
    createdAt: toIso(p.createdAt),
  };
}

export function serializeUser(u: any): SessionUser {
  return {
    id: idOf(u._id ?? u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone ?? null,
    savedAddress: u.savedAddress ?? null,
    addresses: (Array.isArray(u.addresses) ? u.addresses : []).map(
      (a: any) => ({
        id: idOf(a._id),
        label: a.label ?? "Home",
        fullName: a.fullName ?? "",
        phone: a.phone ?? "",
        street: a.street ?? "",
        city: a.city ?? "",
        state: a.state ?? "",
        zipCode: a.zipCode ?? "",
        country: a.country ?? "India",
        isDefault: Boolean(a.isDefault),
      })
    ),
    createdAt: toIso(u.createdAt),
  };
}

export function serializeOrder(o: any): OrderDTO {
  return {
    id: idOf(o._id ?? o.id),
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    subtotal: o.subtotal,
    shippingFee: o.shippingFee,
    tax: o.tax,
    discount: o.discount ?? 0,
    couponCode: o.couponCode ?? null,
    total: o.total,
    shippingName: o.shippingName ?? null,
    shippingPhone: o.shippingPhone ?? null,
    addressLine: o.addressLine ?? null,
    city: o.city ?? null,
    state: o.state ?? null,
    zipCode: o.zipCode ?? null,
    country: o.country ?? null,
    trackingNumber: o.trackingNumber ?? null,
    cancelInfo:
      o.cancelInfo && o.cancelInfo.reason
        ? {
            reason: o.cancelInfo.reason,
            comment: o.cancelInfo.comment ?? null,
            by: o.cancelInfo.by ?? "USER",
            at: toIso(o.cancelInfo.at ?? o.updatedAt),
          }
        : null,
    refundInfo:
      o.refundInfo && o.refundInfo.status
        ? {
            amount: o.refundInfo.amount ?? 0,
            origin: o.refundInfo.origin ?? "USER_CANCEL",
            status: o.refundInfo.status,
            requestedAt: toIso(o.refundInfo.requestedAt),
            resolvedAt: o.refundInfo.resolvedAt ? toIso(o.refundInfo.resolvedAt) : null,
            adminNote: o.refundInfo.adminNote ?? null,
          }
        : null,
    returnInfo:
      o.returnInfo && o.returnInfo.status
        ? {
            reason: o.returnInfo.reason,
            comment: o.returnInfo.comment ?? null,
            status: o.returnInfo.status,
            refundAmount: o.returnInfo.refundAmount ?? 0,
            requestedAt: toIso(o.returnInfo.requestedAt),
            resolvedAt: o.returnInfo.resolvedAt ? toIso(o.returnInfo.resolvedAt) : null,
            adminNote: o.returnInfo.adminNote ?? null,
          }
        : null,
    items: (o.items ?? []).map((i: any) => ({
      id: idOf(i._id ?? i.id),
      productId: i.product ? idOf(i.product) : null,
      name: i.name,
      image: i.image,
      price: i.price,
      quantity: i.quantity,
      isDigital: i.isDigital,
      licenseKey: i.licenseKey ?? null,
    })),
    createdAt: toIso(o.createdAt),
    userName: o.user?.name,
    userEmail: o.user?.email,
  };
}

// ── Coupons ───────────────────────────────────────────────────

export function serializeCoupon(c: any): CouponDTO {
  return {
    id: idOf(c._id ?? c.id),
    code: c.code,
    description: c.description ?? "",
    type: c.type,
    value: c.value,
    minOrderAmount: c.minOrderAmount ?? 0,
    maxDiscountAmount: c.maxDiscountAmount ?? null,
    expiresAt: c.expiresAt ? toIso(c.expiresAt) : null,
    isActive: c.isActive,
    firstOrderOnly: Boolean(c.firstOrderOnly),
    usageCount: c.usageCount ?? 0,
    createdAt: toIso(c.createdAt),
  };
}

/** Is the coupon currently redeemable (active + not expired)? */
export function isCouponLive(coupon: {
  isActive: boolean;
  expiresAt?: Date | string | null;
}): boolean {
  if (!coupon.isActive) return false;
  if (!coupon.expiresAt) return true;
  return new Date(coupon.expiresAt).getTime() > Date.now();
}

/** Compute the ₹ discount a coupon yields on a given subtotal. */
export function computeCouponDiscount(
  coupon: { type: string; value: number; maxDiscountAmount?: number | null },
  subtotal: number
): number {
  let discount =
    coupon.type === "PERCENT"
      ? (subtotal * coupon.value) / 100
      : coupon.value;
  if (coupon.type === "PERCENT" && coupon.maxDiscountAmount) {
    discount = Math.min(discount, coupon.maxDiscountAmount);
  }
  return round2(Math.max(0, Math.min(discount, subtotal)));
}

/** Count a customer's non-cancelled orders — used to enforce
 *  first-order-only coupons (e.g. WELCOME10). */
export async function countCustomerOrders(userId: string): Promise<number> {
  const userOid = oid(userId);
  if (!userOid) return 0;
  return Order.countDocuments({
    user: userOid,
    status: { $ne: "CANCELLED" },
  });
}

/** Shared eligibility gate: active, not expired, min order met and —
 *  for first-order-only coupons — the customer has no prior orders. */
export async function assertCouponEligibility(
  coupon: any,
  subtotal: number,
  userId?: string | null
): Promise<void> {
  if (!isCouponLive(coupon)) {
    throw new HttpError("This coupon is no longer active", 400);
  }
  if (coupon.firstOrderOnly) {
    if (!userId) {
      throw new HttpError(
        `Sign in to use ${coupon.code} — it's valid on your first order only`,
        401
      );
    }
    const priorOrders = await countCustomerOrders(userId);
    if (priorOrders > 0) {
      throw new HttpError(
        `${coupon.code} is valid on your first order only — it can't be used again`,
        400
      );
    }
  }
  if (subtotal < (coupon.minOrderAmount ?? 0)) {
    throw new HttpError(
      `Add items worth ${formatInr(coupon.minOrderAmount - subtotal)} more to use ${coupon.code}`,
      400
    );
  }
}

export async function validateCouponForCheckout(
  rawCode: unknown,
  subtotal: number,
  userId?: string | null
): Promise<{ coupon: any; discount: number } | null> {
  const code = asString(rawCode).trim().toUpperCase();
  if (!code) return null;

  const coupon = await Coupon.findOne({ code }).lean();
  if (!coupon) {
    throw new HttpError("This coupon code doesn't exist", 400);
  }
  await assertCouponEligibility(coupon, subtotal, userId);
  const discount = computeCouponDiscount(coupon, subtotal);
  if (discount <= 0) {
    throw new HttpError("This coupon gives no discount on this order", 400);
  }
  return { coupon, discount };
}

function formatInr(n: number): string {
  return `₹${Math.round(n * 100) / 100}`;
}

export function serializeReview(r: any): ReviewDTO {
  return {
    id: idOf(r._id ?? r.id),
    productId: idOf(r.product),
    userId: idOf(r.user),
    userName: r.user?.name ?? "Anonymous",
    rating: r.rating,
    title: r.title ?? null,
    comment: r.comment,
    createdAt: toIso(r.createdAt),
  };
}

// ── Slugs ─────────────────────────────────────────────────────

export async function generateUniqueSlug(
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name) || "product";
  let slug = base;
  let counter = 2;
  for (;;) {
    const existing = await ProductModel.findOne({ slug })
      .select("_id")
      .lean();
    if (!existing || (excludeId && idOf(existing._id) === excludeId)) return slug;
    slug = `${base}-${counter++}`;
  }
}

// ── Random codes ──────────────────────────────────────────────

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomChars(len: number, charset: string): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

export function generateOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SV-${day}-${randomChars(4, ALPHANUM)}`;
}

export function generateLicenseKey(): string {
  return [0, 1, 2, 3].map(() => randomChars(4, ALPHANUM)).join("-");
}

export function generateTrackingNumber(): string {
  return `SVTRK${randomChars(10, "0123456789")}`;
}

// ── Input coercion ────────────────────────────────────────────

export function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function toSpecsArray(v: unknown): { name: string; value: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => !!x && typeof x === "object")
    .map((x: any) => ({ name: String(x.name ?? ""), value: String(x.value ?? "") }))
    .filter((s) => s.name.length > 0);
}

/** Sanitizes an unknown value into a list of valid, de-duplicated placements. */
export function toPlacementsArray(v: unknown): Placement[] {
  if (!Array.isArray(v)) return [];
  const valid = new Set<string>(PLACEMENTS);
  const seen = new Set<string>();
  const out: Placement[] = [];
  for (const x of v) {
    if (typeof x === "string" && valid.has(x) && !seen.has(x)) {
      seen.add(x);
      out.push(x as Placement);
    }
  }
  return out;
}

// ── Domain helpers ────────────────────────────────────────────

/** Full cart payload, oldest first. */
export async function getCartPayload(userId: string) {
  const items = await CartItem.find({ user: userId })
    .sort({ createdAt: 1 })
    .populate("product")
    .lean();
  return {
    items: items
      .filter((i: any) => i.product)
      .map((i: any) => ({
        productId: idOf(i.product._id),
        quantity: i.quantity,
        product: serializeProduct(i.product),
      })),
  };
}

/** Decrement a product's soldCount (floored at 0). */
async function decrementSoldCount(productId: string, quantity: number) {
  await ProductModel.updateOne(
    { _id: productId, soldCount: { $gte: quantity } },
    { $inc: { soldCount: -quantity } }
  );
  await ProductModel.updateOne(
    { _id: productId, soldCount: { $lt: quantity } },
    { $set: { soldCount: 0 } }
  );
}

/**
 * Restock cancelled order items: physical products get their stock
 * back; soldCount is decremented (floored at 0) for every item.
 */
export async function restockItems(
  items: { product?: string | null; quantity: number; isDigital: boolean }[]
): Promise<void> {
  for (const item of items) {
    const productId = item.product;
    if (!productId) continue;
    if (!item.isDigital) {
      await ProductModel.updateOne(
        { _id: productId },
        { $inc: { stock: item.quantity } }
      );
    }
    await decrementSoldCount(productId, item.quantity);
  }
}

/** Reverse a successful stock/soldCount decrement (checkout rollback). */
export async function rollbackDecrement(
  items: { productId: string; quantity: number; isPhysical: boolean }[]
): Promise<void> {
  for (const item of items) {
    await ProductModel.updateOne(
      { _id: item.productId },
      {
        $inc: {
          ...(item.isPhysical ? { stock: item.quantity } : {}),
          soldCount: -item.quantity,
        },
      }
    );
  }
  // soldCount must never go below zero
  for (const item of items) {
    await ProductModel.updateOne(
      { _id: item.productId, soldCount: { $lt: 0 } },
      { $set: { soldCount: 0 } }
    );
  }
}
