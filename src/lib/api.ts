// ──────────────────────────────────────────────────────────────
// ShopVerse — Frontend API client
// Thin typed wrappers around fetch. All requests are same-origin
// with cookies included (JWT HTTP-only cookie auth).
// ──────────────────────────────────────────────────────────────
import type {
  AddressBookEntry,
  AdminStats,
  AdminUser,
  AppNotificationDTO,
  CartItemDTO,
  CartMergeItem,
  CheckoutPayload,
  CouponDTO,
  CouponQuote,
  NotificationsResponse,
  OrderDTO,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductQueryParams,
  ProductsResponse,
  PublicCoupon,
  ReviewDTO,
  Role,
  SessionUser,
  ShippingAddress,
  WishlistResponse,
  WishlistToggleResponse,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Auth ──────────────────────────────────────────────────────

export const apiAuth = {
  me: () => api<{ user: SessionUser }>("/api/auth/me"),
  login: (email: string, password: string) =>
    api<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  register: (payload: { name: string; email: string; password: string }) =>
    api<{ user: SessionUser }>("/api/auth/register", {
      method: "POST",
      body: payload,
    }),
  logout: () => api<{ success: boolean }>("/api/auth/logout", { method: "POST" }),
  updateProfile: (payload: { name: string; phone?: string }) =>
    api<{ user: SessionUser }>("/api/auth/me", { method: "PUT", body: payload }),
  /** Persist (or clear) the checkout shipping address for faster re-ordering. */
  saveAddress: (address: ShippingAddress | null, name: string) =>
    api<{ user: SessionUser }>("/api/auth/me", {
      method: "PUT",
      body: { name, savedAddress: address },
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ success: boolean }>("/api/auth/password", {
      method: "PUT",
      body: { currentPassword, newPassword },
    }),
  /** Forgot password — a real 6-digit reset code is emailed to the address. */
  forgotPassword: (email: string) =>
    api<{ success: boolean; message: string }>(
      "/api/auth/forgot-password",
      { method: "POST", body: { email } }
    ),
  /** Forgot password — verify the code and set the new password. */
  resetPassword: (email: string, code: string, newPassword: string) =>
    api<{ success: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: { email, code, newPassword },
    }),
};

// ── Products ──────────────────────────────────────────────────

export const apiProducts = {
  list: (params: ProductQueryParams) => {
    const q: Record<string, string | number | boolean | undefined> = {
      search: params.search,
      category: params.category,
      brands: params.brands?.filter(Boolean).join(","),
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      inStock: params.inStock === undefined ? undefined : String(params.inStock),
      placement: params.placement,
      sort: params.sort,
      page: params.page,
      limit: params.limit,
      ids: params.ids?.filter(Boolean).join(","),
      mine: params.mine === undefined ? undefined : String(params.mine),
    };
    return api<ProductsResponse>(`/api/products${qs(q)}`);
  },
  get: (idOrSlug: string) => api<{ product: Product }>(`/api/products/${idOrSlug}`),
  brands: () => api<{ brands: string[] }>("/api/products/brands"),
  create: (payload: Partial<Product>) =>
    api<{ product: Product }>("/api/products", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<Product>) =>
    api<{ product: Product }>(`/api/products/${id}`, { method: "PUT", body: payload }),
  remove: (id: string) =>
    api<{ success: boolean }>(`/api/products/${id}`, { method: "DELETE" }),
};

// ── Cart ──────────────────────────────────────────────────────

export const apiCart = {
  get: () => api<{ items: CartItemDTO[] }>("/api/cart"),
  add: (productId: string, quantity = 1) =>
    api<{ items: CartItemDTO[] }>("/api/cart", {
      method: "POST",
      body: { productId, quantity },
    }),
  setQuantity: (productId: string, quantity: number) =>
    api<{ items: CartItemDTO[] }>("/api/cart", {
      method: "PUT",
      body: { productId, quantity },
    }),
  remove: (productId: string) =>
    api<{ items: CartItemDTO[] }>(`/api/cart${qs({ productId })}`, {
      method: "DELETE",
    }),
  merge: (items: CartMergeItem[]) =>
    api<{ items: CartItemDTO[] }>("/api/cart/merge", {
      method: "POST",
      body: { items },
    }),
};

// ── Orders ────────────────────────────────────────────────────

export const apiOrders = {
  mine: () => api<{ orders: OrderDTO[] }>("/api/orders"),
  get: (id: string) => api<{ order: OrderDTO }>(`/api/orders/${id}`),
  checkout: (payload: CheckoutPayload) =>
    api<{ order: OrderDTO }>("/api/orders", { method: "POST", body: payload }),
  /** Customer cancels a pending/processing order — a reason is required. */
  cancel: (id: string, payload: { reason: string; comment?: string }) =>
    api<{ order: OrderDTO }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: { action: "cancel", ...payload },
    }),
  /** Customer requests a return for a delivered order. */
  requestReturn: (id: string, payload: { reason: string; comment?: string }) =>
    api<{ order: OrderDTO }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: { action: "return-request", ...payload },
    }),
  /** Admin approves (refund) or declines a pending return request. */
  resolveReturn: (id: string, approve: boolean, note?: string) =>
    api<{ order: OrderDTO }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: { action: "return-resolve", approve, note },
    }),
  /** Admin approves or declines a pending cancellation refund. */
  resolveRefund: (id: string, approve: boolean, note?: string) =>
    api<{ order: OrderDTO }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: { action: "refund-resolve", approve, note },
    }),
  all: (params?: { status?: OrderStatus; search?: string }) =>
    api<{ orders: OrderDTO[] }>(`/api/orders/all${qs(params ?? {})}`),
  /** Admin status update — cancelling requires a reason (the
   *  customer is notified with it). */
  updateStatus: (
    id: string,
    status: OrderStatus,
    trackingNumber?: string,
    reason?: string,
    comment?: string
  ) =>
    api<{ order: OrderDTO }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: { status, trackingNumber, ...(reason ? { reason, comment } : {}) },
    }),
};

// ── Notifications ──────────────────────────────────────────

export const apiNotifications = {
  list: () => api<NotificationsResponse>("/api/notifications"),
  markAllRead: () =>
    api<{ success: boolean }>("/api/notifications", { method: "POST" }),
  clearAll: () =>
    api<{ success: boolean }>("/api/notifications", { method: "DELETE" }),
};

// ── Wishlist ──────────────────────────────────────────────────

export const apiWishlist = {
  get: () => api<WishlistResponse>("/api/wishlist"),
  toggle: (productId: string) =>
    api<WishlistToggleResponse>("/api/wishlist", {
      method: "POST",
      body: { productId },
    }),
};

// ── Saved addresses (address book) ──────────────────────────

export const apiAddresses = {
  /** Add a new address to the signed-in user's address book. */
  add: (payload: {
    address: Omit<AddressBookEntry, "id" | "isDefault">;
    isDefault?: boolean;
  }) =>
    api<{ user: SessionUser }>("/api/addresses", {
      method: "POST",
      body: payload,
    }),
  /** Update an existing address (optionally make it the default). */
  update: (
    id: string,
    payload: {
      address: Omit<AddressBookEntry, "id" | "isDefault">;
      isDefault?: boolean;
    }
  ) =>
    api<{ user: SessionUser }>(`/api/addresses/${id}`, {
      method: "PUT",
      body: payload,
    }),
  /** Mark an address as the default. */
  setDefault: (id: string) =>
    api<{ user: SessionUser }>(`/api/addresses/${id}`, {
      method: "PATCH",
    }),
  /** Remove an address. */
  remove: (id: string) =>
    api<{ user: SessionUser }>(`/api/addresses/${id}`, {
      method: "DELETE",
    }),
};

// ── Reviews ───────────────────────────────────────────────────

export const apiReviews = {
  list: (productId: string) =>
    api<{ reviews: ReviewDTO[] }>(`/api/reviews${qs({ productId })}`),
  create: (payload: {
    productId: string;
    rating: number;
    title?: string;
    comment: string;
  }) =>
    api<{ review: ReviewDTO; product: Product }>("/api/reviews", {
      method: "POST",
      body: payload,
    }),
};

// ── Coupons ───────────────────────────────────────────────────

export const apiCoupons = {
  /** Admin: full coupon list for management. */
  list: () => api<{ coupons: CouponDTO[] }>("/api/coupons"),
  /** Public: live coupons safe to show on the storefront. */
  listPublic: () =>
    api<{ coupons: PublicCoupon[] }>("/api/coupons?public=1"),
  /** Quote a coupon code against a subtotal (checkout). */
  validate: (code: string, subtotal: number) =>
    api<{ quote: CouponQuote }>("/api/coupons/validate", {
      method: "POST",
      body: { code, subtotal },
    }),
  create: (payload: Partial<CouponDTO>) =>
    api<{ coupon: CouponDTO }>("/api/coupons", {
      method: "POST",
      body: payload,
    }),
  update: (id: string, payload: Partial<CouponDTO>) =>
    api<{ coupon: CouponDTO }>(`/api/coupons/${id}`, {
      method: "PUT",
      body: payload,
    }),
  remove: (id: string) =>
    api<{ success: boolean }>(`/api/coupons/${id}`, { method: "DELETE" }),
};

// ── Admin ─────────────────────────────────────────────────────

export const apiAdmin = {
  stats: () => api<{ stats: AdminStats }>("/api/admin/stats"),
  users: (search?: string) =>
    api<{ users: AdminUser[] }>(`/api/admin/users${qs({ search })}`),
  updateUserRole: (id: string, role: Role) =>
    api<{ user: AdminUser }>(`/api/admin/users/${id}`, {
      method: "PUT",
      body: { role },
    }),
};

// ── Upload ────────────────────────────────────────────────────

export const apiUpload = {
  image: async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(data?.error || "Upload failed", res.status);
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  },
};

// ── Helpers used by checkout ──────────────────────────────────

export const SHIPPING_FEE = 49;
export const FREE_SHIPPING_THRESHOLD = 499;

export function computeTotals(
  items: { price: number; quantity: number; isDigital?: boolean }[],
  discount = 0
) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasPhysical = items.some((i) => !i.isDigital);
  const shippingFee = !hasPhysical || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const discounted = subtotal - safeDiscount;
  // GST removed — prices are final
  const tax = 0;
  const total = Math.round((discounted + shippingFee + tax) * 100) / 100;
  return {
    subtotal,
    shippingFee,
    tax,
    discount: safeDiscount,
    total,
    hasPhysical,
  };
}

export type { ShippingAddress, PaymentMethod };
