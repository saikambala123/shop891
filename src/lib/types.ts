// ──────────────────────────────────────────────────────────────
// ShopVerse — Shared types (API contract used by client & server)
// Single-store model: customers shop, the Admin manages the
// entire catalog (plants, home & living products).
// ──────────────────────────────────────────────────────────────

export type Role = "USER" | "ADMIN";

export const ROLES: Role[] = ["USER", "ADMIN"];

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
];

export type PaymentMethod = "CARD" | "UPI";
export type PaymentStatus = "PENDING" | "PAID" | "REFUND_PENDING" | "REFUNDED";

// ── Cancellations ─────────────────────────────────────────────

/** Why a customer cancels a pending/processing order. */
export const CANCEL_REASONS: { value: string; label: string; hint: string }[] = [
  { value: "CHANGED_MIND", label: "Changed my mind", hint: "I no longer need these items" },
  { value: "ORDERED_MISTAKE", label: "Ordered by mistake", hint: "Wrong item or quantity" },
  { value: "FOUND_BETTER_PRICE", label: "Found a better price", hint: "Cheaper somewhere else" },
  { value: "DELIVERY_TOO_SLOW", label: "Delivery too slow", hint: "Won't arrive in time" },
  { value: "DUPLICATE_ORDER", label: "Duplicate order", hint: "I ordered twice by accident" },
  { value: "PAYMENT_ISSUE", label: "Payment issue", hint: "Problem with my payment" },
  { value: "OTHER", label: "Other reason", hint: "Tell us more in the note" },
];

export const CANCEL_REASON_LABELS: Record<string, string> = Object.fromEntries(
  CANCEL_REASONS.map((r) => [r.value, r.label])
);

/** Why an admin cancels an order from the console. */
export const ADMIN_CANCEL_REASONS: { value: string; label: string; hint: string }[] = [
  { value: "OUT_OF_STOCK", label: "Item out of stock", hint: "Cannot fulfil one or more items" },
  { value: "PAYMENT_FAILED", label: "Payment not verified", hint: "Payment couldn't be confirmed" },
  { value: "SUSPICIOUS_ORDER", label: "Suspicious order", hint: "Possible fraud or abuse" },
  { value: "CUSTOMER_REQUEST", label: "Customer requested it", hint: "Customer asked us to cancel" },
  { value: "SHIPPING_UNAVAILABLE", label: "Can't ship to this address", hint: "Courier doesn't service the pin code" },
  { value: "OTHER", label: "Other reason", hint: "Explain in the note" },
];

export const ADMIN_CANCEL_REASON_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_CANCEL_REASONS.map((r) => [r.value, r.label])
);

/** Who cancelled an order, when and why. */
export interface CancelInfoDTO {
  reason: string;
  comment?: string | null;
  by: "USER" | "ADMIN";
  at: string;
}

/** Cancellation refund lifecycle — an admin approves or declines it. */
export interface RefundInfoDTO {
  amount: number;
  origin: "USER_CANCEL" | "ADMIN_CANCEL";
  status: "PENDING" | "APPROVED" | "DECLINED";
  requestedAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
}

// ── Returns & refunds ─────────────────────────────────────────

/** Why a customer wants to return a delivered order. */
export type ReturnReason =
  | "DAMAGED"
  | "WRONG_ITEM"
  | "NOT_AS_DESCRIBED"
  | "QUALITY_ISSUE"
  | "NO_LONGER_NEEDED";

export const RETURN_REASONS: { value: ReturnReason; label: string; hint: string }[] = [
  { value: "DAMAGED", label: "Arrived damaged", hint: "Item was broken or damaged on arrival" },
  { value: "WRONG_ITEM", label: "Wrong item received", hint: "I received something different" },
  { value: "NOT_AS_DESCRIBED", label: "Not as described", hint: "Doesn't match the listing" },
  { value: "QUALITY_ISSUE", label: "Quality issue", hint: "Item doesn't meet expectations" },
  { value: "NO_LONGER_NEEDED", label: "No longer needed", hint: "Changed my mind" },
];

export const RETURN_REASON_LABELS: Record<string, string> = Object.fromEntries(
  RETURN_REASONS.map((r) => [r.value, r.label])
);

/** Lifecycle of a return request attached to an order. */
export interface ReturnInfoDTO {
  reason: string;
  comment?: string | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  /** Refund amount (₹) — the full order total for approved returns. */
  refundAmount: number;
  requestedAt: string;
  resolvedAt?: string | null;
  /** Admin note shown when a request is declined. */
  adminNote?: string | null;
}

// ── Auth / session ────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  /** Address saved by the customer at checkout for faster re-ordering (legacy). */
  savedAddress?: ShippingAddress | null;
  /** Address book entries managed from the profile page. */
  addresses?: AddressBookEntry[];
  createdAt: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
}

// ── Products ──────────────────────────────────────────────────

/**
 * Homepage placements an admin can curate. Each placement feeds a
 * dedicated product-card rail on the storefront home page.
 */
export const PLACEMENTS = [
  "discount-offer",
  "newly-arrived",
  "just-launched",
  "top-rated",
] as const;

export type Placement = (typeof PLACEMENTS)[number];

export interface PlacementMeta {
  id: Placement;
  label: string;
  description: string;
}

export const PLACEMENT_META: PlacementMeta[] = [
  {
    id: "discount-offer",
    label: "Discount & offer",
    description: "Featured in the Discounts & Offers showcase",
  },
  {
    id: "newly-arrived",
    label: "Newly arrived",
    description: "Featured in the Newly arrived rail",
  },
  {
    id: "just-launched",
    label: "Just launched",
    description: "Featured in the Just launched rail",
  },
  {
    id: "top-rated",
    label: "Top rated",
    description: "Featured in Top rated by customers",
  },
];

export function placementMeta(id: string): PlacementMeta {
  return (
    PLACEMENT_META.find((p) => p.id === id) ?? {
      id: id as Placement,
      label: id,
      description: "",
    }
  );
}

export interface ProductSpec {
  name: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  compareAtPrice?: number | null;
  images: string[];
  highlights: string[];
  specs: ProductSpec[];
  tags: string[];
  stock: number;
  isDigital: boolean;
  isActive: boolean;
  placements: string[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  createdAt: string;
}

export type ProductSort =
  | "popular"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating";

export interface ProductQueryParams {
  search?: string;
  category?: string;
  brands?: string[]; // comma list is sent as `brands`
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  /** Filter by admin-curated homepage placement (e.g. discount-offer). */
  placement?: Placement;
  sort?: ProductSort;
  page?: number;
  limit?: number;
  ids?: string[];
  /** When true, returns all products including inactive ones (ADMIN). */
  mine?: boolean;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Coupons (admin-managed) ──────────────────────────────────

export type CouponType = "PERCENT" | "FIXED";

export interface CouponDTO {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  /** Percent (0-100) when type=PERCENT, flat ₹ amount when FIXED. */
  value: number;
  /** Minimum order subtotal (₹) required to apply. */
  minOrderAmount: number;
  /** Cap (₹) on the discount for PERCENT coupons. */
  maxDiscountAmount?: number | null;
  expiresAt?: string | null;
  isActive: boolean;
  /** Valid only on a customer's first order (per user). */
  firstOrderOnly?: boolean;
  usageCount: number;
  createdAt: string;
}

/** Public-safe coupon projection shown on the storefront. */
export interface PublicCoupon {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  /** Valid only on a customer's first order (per user). */
  firstOrderOnly?: boolean;
}

export interface CouponQuote {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  discount: number;
  /** Valid only on a customer's first order (per user). */
  firstOrderOnly?: boolean;
}

// ── Cart ──────────────────────────────────────────────────────

export interface CartItemDTO {
  productId: string;
  quantity: number;
  product: Product;
}

export interface CartMergeItem {
  productId: string;
  quantity: number;
}

// ── Orders ────────────────────────────────────────────────────

export interface OrderItemDTO {
  id: string;
  productId?: string | null;
  name: string;
  image: string;
  price: number;
  quantity: number;
  isDigital: boolean;
  licenseKey?: string | null;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/** An address-book entry — a shipping address plus a label
 *  ("Home", "Office", …) and a default flag. */
export interface AddressBookEntry extends ShippingAddress {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingFee: number;
  tax: number;
  /** Coupon discount applied at checkout (₹). */
  discount: number;
  /** Coupon code redeemed on this order. */
  couponCode?: string | null;
  total: number;
  shippingName?: string | null;
  shippingPhone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  trackingNumber?: string | null;
  /** Who cancelled this order and why, if it was cancelled. */
  cancelInfo?: CancelInfoDTO | null;
  /** Cancellation refund request (admin-approved), if any. */
  refundInfo?: RefundInfoDTO | null;
  /** Return / refund request attached to this order, if any. */
  returnInfo?: ReturnInfoDTO | null;
  items: OrderItemDTO[];
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

/** A single-item direct purchase ("Buy Now") — checked out
 *  without touching the user's cart. */
export interface DirectBuyPayload {
  productId: string;
  quantity: number;
}

export interface CheckoutPayload {
  address: ShippingAddress; // required when cart has physical items
  paymentMethod: PaymentMethod;
  /** Optional coupon code redeemed at checkout. */
  couponCode?: string;
  /** When set, the order is built from this single "Buy Now" item
   *  and the cart is left untouched. */
  directItem?: DirectBuyPayload;
}

// ── Reviews ───────────────────────────────────────────────────

export interface ReviewDTO {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: string;
}

// ── Admin analytics ───────────────────────────────────────────

export interface AdminStats {
  scope: "ADMIN";
  revenue: number;
  orderCount: number;
  activeOrders: number;
  productCount: number;
  lowStockCount: number;
  customerCount?: number;
  lowStockProducts: { id: string; name: string; stock: number; image: string }[];
  salesByDay: { date: string; revenue: number; orders: number }[];
  statusCounts: Record<string, number>;
  categoryRevenue: { category: string; revenue: number }[];
  topProducts: { id: string; name: string; units: number; revenue: number; image: string }[];
  recentOrders: OrderDTO[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

// ── Wishlist ──────────────────────────────────────────────────

export interface WishlistResponse {
  products: Product[];
}

export interface WishlistToggleResponse {
  added: boolean;
  productIds: string[];
}

// ── Notifications ─────────────────────────────────────────────

export type AppNotificationKind =
  | "placed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "welcome"
  | "return"
  | "refund";

export interface AppNotificationDTO {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  amount: number | null;
  orderNumber: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotificationDTO[];
  unreadCount: number;
}

// ── Misc ──────────────────────────────────────────────────────

export interface ApiErrorShape {
  error: string;
}

export const CATEGORIES = [
  "Indoor Plants",
  "Outdoor & Garden",
  "Planters & Pots",
  "Home & Kitchen",
  "Home Decor",
  "Storage & Organization",
  "Bedding & Bath",
  "Cleaning & Essentials",
] as const;

export type Category = (typeof CATEGORIES)[number];
