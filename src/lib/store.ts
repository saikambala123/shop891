// ──────────────────────────────────────────────────────────────
// ShopVerse — Global client store (Zustand)
// Handles view routing, auth session, cart (server-synced for
// logged-in users, localStorage for guests, merged on login),
// wishlist, and global search.
// ──────────────────────────────────────────────────────────────
"use client";

import { create } from "zustand";
import { toast } from "@/hooks/use-toast";
import {
  apiAuth,
  apiCart,
  apiProducts,
  apiWishlist,
} from "@/lib/api";
import { pushRouteEntry } from "@/lib/nav-history";
import type {
  CartItemDTO,
  CartMergeItem,
  Product,
  SessionUser,
} from "@/lib/types";

// ── Routing ───────────────────────────────────────────────────

export type InfoTopic =
  | "about"
  | "faq"
  | "privacy"
  | "terms"
  | "shipping"
  | "returns";

export type Route =
  | { name: "home" }
  | {
      name: "catalog";
      category?: string;
      search?: string;
    }
  | { name: "product"; slug: string }
  | { name: "cart" }
  | { name: "checkout" }
  | { name: "orders" }
  | { name: "wishlist" }
  | { name: "profile" }
  | { name: "auth" }
  | { name: "info"; topic: InfoTopic }
  | { name: "admin"; tab?: AdminTab };

export type AdminTab = "overview" | "products" | "orders" | "customers" | "coupons";

// ── Guest cart persistence ────────────────────────────────────

const GUEST_CART_KEY = "shopverse_guest_cart";

function readGuestCart(): CartMergeItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartMergeItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items: CartMergeItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

// ── Store ─────────────────────────────────────────────────────

interface AppStore {
  // routing
  route: Route;
  navigate: (route: Route) => void;

  // auth
  user: SessionUser | null;
  authReady: boolean;
  authMode: "login" | "register";
  authMessage?: string;
  setUser: (user: SessionUser | null) => void;
  initAuth: () => Promise<void>;
  openAuth: (mode?: "login" | "register", message?: string) => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<SessionUser>;
  logout: () => Promise<void>;

  // cart
  cartItems: CartItemDTO[];
  cartCount: number;
  cartLoading: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<boolean>;
  setCartQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;

  // direct "Buy Now" (bypasses the cart entirely)
  buyNowItem: CartItemDTO | null;
  startBuyNow: (product: Product, quantity: number) => void;
  clearBuyNow: () => void;

  // order-success screen (set right after an order is placed — drives
  // the clean minimal footer; cleared automatically on navigation)
  checkoutSuccess: boolean;
  setCheckoutSuccess: (v: boolean) => void;

  // wishlist
  wishlistIds: string[];
  refreshWishlist: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;

  // search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ── routing ──
  route: { name: "home" },
  navigate: (route) => {
    // any navigation leaves the order-success state behind
    set({ route, checkoutSuccess: false });
    // Push a real history entry so the mobile/browser Back button
    // returns to the previous view (see lib/nav-history.ts).
    pushRouteEntry(route);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },

  // ── auth ──
  user: null,
  authReady: false,
  authMode: "login",
  authMessage: undefined,
  setUser: (user) => set({ user }),

  initAuth: async () => {
    try {
      const { user } = await apiAuth.me();
      set({ user, authReady: true });
      await Promise.all([get().refreshCart(), get().refreshWishlist()]);
    } catch {
      set({ user: null, authReady: true });
      await get().refreshCart();
    }
  },

  // Signing in / creating an account opens a dedicated full page
  // (not a popup). The previous view is preserved underneath so the
  // browser Back button — and the post-login redirect — return the
  // user to exactly where they came from.
  openAuth: (mode = "login", message) => {
    set({ authMode: mode, authMessage: message });
    if (get().route.name !== "auth") {
      get().navigate({ name: "auth" });
    }
  },
  closeAuth: () => {
    set({ authMessage: undefined });
    // Return to the view the user was on before the auth page.
    if (get().route.name === "auth" && typeof window !== "undefined") {
      window.history.back();
    }
  },

  login: async (email, password) => {
    const { user } = await apiAuth.login(email, password);
    set({ user });
    // merge guest cart into the server cart, then hydrate
    const guest = readGuestCart();
    if (guest.length > 0) {
      try {
        await apiCart.merge(guest);
        writeGuestCart([]);
      } catch {
        /* keep guest cart if merge fails */
      }
    }
    set({ authMessage: undefined });
    if (get().route.name === "auth" && typeof window !== "undefined") {
      window.history.back(); // back to the view the user signed in from
    }
    await Promise.all([get().refreshCart(), get().refreshWishlist()]);
    return user;
  },

  register: async (payload) => {
    const { user } = await apiAuth.register(payload);
    set({ user });
    const guest = readGuestCart();
    if (guest.length > 0) {
      try {
        await apiCart.merge(guest);
        writeGuestCart([]);
      } catch {
        /* ignore */
      }
    }
    set({ authMessage: undefined });
    if (get().route.name === "auth" && typeof window !== "undefined") {
      window.history.back(); // back to the view the user signed up from
    }
    await Promise.all([get().refreshCart(), get().refreshWishlist()]);
    return user;
  },

  logout: async () => {
    try {
      await apiAuth.logout();
    } catch {
      /* ignore */
    }
    set({
      user: null,
      cartItems: [],
      cartCount: 0,
      wishlistIds: [],
      buyNowItem: null,
      checkoutSuccess: false,
      route: { name: "home" },
    });
  },

  // ── cart ──
  cartItems: [],
  cartCount: 0,
  cartLoading: false,

  refreshCart: async () => {
    const { user } = get();
    if (!user) {
      // guest: hydrate from localStorage + fetch product details
      const guest = readGuestCart();
      if (guest.length === 0) {
        set({ cartItems: [], cartCount: 0 });
        return;
      }
      try {
        const { products } = await apiProducts.list({
          ids: guest.map((g) => g.productId),
          limit: 100,
        });
        const byId = new Map(products.map((p: Product) => [p.id, p]));
        const items: CartItemDTO[] = guest
          .filter((g) => byId.has(g.productId))
          .map((g) => ({
            productId: g.productId,
            quantity: g.quantity,
            product: byId.get(g.productId)!,
          }));
        set({
          cartItems: items,
          cartCount: items.reduce((s, i) => s + i.quantity, 0),
        });
      } catch {
        set({ cartItems: [], cartCount: 0 });
      }
      return;
    }
    try {
      const { items } = await apiCart.get();
      set({
        cartItems: items,
        cartCount: items.reduce((s, i) => s + i.quantity, 0),
      });
    } catch {
      set({ cartItems: [], cartCount: 0 });
    }
  },

  addToCart: async (productId, quantity = 1) => {
    const { user } = get();
    if (user) {
      const { items } = await apiCart.add(productId, quantity);
      set({
        cartItems: items,
        cartCount: items.reduce((s, i) => s + i.quantity, 0),
      });
      return true;
    }
    // guest path
    const guest = readGuestCart();
    const existing = guest.find((g) => g.productId === productId);
    if (existing) existing.quantity += quantity;
    else guest.push({ productId, quantity });
    writeGuestCart(guest);
    await get().refreshCart();
    return true;
  },

  setCartQuantity: async (productId, quantity) => {
    const { user } = get();
    if (quantity <= 0) return get().removeFromCart(productId);
    if (user) {
      const { items } = await apiCart.setQuantity(productId, quantity);
      set({
        cartItems: items,
        cartCount: items.reduce((s, i) => s + i.quantity, 0),
      });
      return;
    }
    const guest = readGuestCart();
    const item = guest.find((g) => g.productId === productId);
    if (item) {
      item.quantity = quantity;
      writeGuestCart(guest);
      await get().refreshCart();
    }
  },

  removeFromCart: async (productId) => {
    const { user } = get();
    if (user) {
      const { items } = await apiCart.remove(productId);
      set({
        cartItems: items,
        cartCount: items.reduce((s, i) => s + i.quantity, 0),
      });
      return;
    }
    const guest = readGuestCart().filter((g) => g.productId !== productId);
    writeGuestCart(guest);
    await get().refreshCart();
  },

  // ── direct "Buy Now" (cart stays untouched) ──
  buyNowItem: null,
  startBuyNow: (product, quantity) => {
    set({
      buyNowItem: { productId: product.id, quantity, product },
    });
    get().navigate({ name: "checkout" });
  },
  clearBuyNow: () => set({ buyNowItem: null }),

  // ── order-success screen state ──
  checkoutSuccess: false,
  setCheckoutSuccess: (v) => set({ checkoutSuccess: v }),

  // ── wishlist ──
  wishlistIds: [],
  refreshWishlist: async () => {
    const { user } = get();
    if (!user) {
      set({ wishlistIds: [] });
      return;
    }
    try {
      const { products } = await apiWishlist.get();
      set({ wishlistIds: products.map((p) => p.id) });
    } catch {
      set({ wishlistIds: [] });
    }
  },

  toggleWishlist: async (productId) => {
    const { user, wishlistIds } = get();
    if (!user) {
      get().openAuth("login", "Sign in to save items to your wishlist");
      return;
    }
    // Optimistic flip — the heart reacts instantly, the server call
    // settles in the background and we reconcile afterwards.
    const prev = wishlistIds;
    const optimistic = prev.includes(productId)
      ? prev.filter((id) => id !== productId)
      : [...prev, productId];
    set({ wishlistIds: optimistic });
    try {
      const { productIds } = await apiWishlist.toggle(productId);
      set({ wishlistIds: productIds });
    } catch {
      // revert and inform
      set({ wishlistIds: prev });
      toast({
        title: "Couldn't update wishlist",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  },

  // ── search ──
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
}));

export { GUEST_CART_KEY };
