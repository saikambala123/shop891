// ──────────────────────────────────────────────────────────────
// ShopVerse — Shopping cart view
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Leaf,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { apiProducts, computeTotals, FREE_SHIPPING_THRESHOLD } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
import { ProductCard } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/types";

export function CartView() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const openAuth = useAppStore((s) => s.openAuth);
  const cartItems = useAppStore((s) => s.cartItems);
  const setCartQuantity = useAppStore((s) => s.setCartQuantity);
  const removeFromCart = useAppStore((s) => s.removeFromCart);
  const clearBuyNow = useAppStore((s) => s.clearBuyNow);
  const cartLoading = !useAppStore((s) => s.authReady) ? true : false;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Product[]>([]);

  useEffect(() => {
    apiProducts
      .list({ sort: "popular", limit: 6 })
      .then((r) => setSuggestions(r.products))
      .catch(() => {});
  }, []);

  // Opening the cart ends any direct "Buy Now" flow — proceeding to
  // checkout from here should check out the cart, not a stale item.
  useEffect(() => {
    clearBuyNow();
  }, [clearBuyNow]);

  const totals = computeTotals(
    cartItems.map((i) => ({ price: i.product.price, quantity: i.quantity, isDigital: i.product.isDigital }))
  );
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.subtotal);
  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const update = async (productId: string, qty: number) => {
    setBusyId(productId);
    try {
      await setCartQuantity(productId, qty);
    } finally {
      setBusyId(null);
    }
  };

  // ── empty state ──
  if (!cartLoading && cartItems.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center shadow-card-3d">
          <div
            aria-hidden
            className="mesh-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
          />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-card-3d ring-1 ring-primary/20">
            <Leaf size={36} />
          </span>
          <h1 className="relative mt-6 text-2xl font-extrabold tracking-tight">
            Your cart is empty
          </h1>
          <p className="relative mt-2 max-w-sm text-sm text-muted-foreground">
            Browse the catalog and find something you love — deals refresh daily.
          </p>
          <Button
            size="lg"
            className="shine-host relative mt-6 rounded-2xl bg-gradient-primary px-7 font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
            onClick={() => navigate({ name: "catalog" })}
          >
            Start shopping <ArrowRight size={17} />
          </Button>
        </div>

        {suggestions.length > 0 && (
          <section className="mt-12" aria-label="Recommended for you">
            <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                <Sparkles size={17} />
              </span>
              Recommended for you
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
              {suggestions.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
          <ShoppingCart size={13} /> Your bag
        </p>
        <h1 className="flex flex-wrap items-center gap-x-2.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Shopping Cart
          {!cartLoading && (
            <span className="text-base font-normal text-muted-foreground">
              ({cartItems.reduce((s, i) => s + i.quantity, 0)}{" "}
              {cartItems.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "items"})
            </span>
          )}
        </h1>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* items */}
        <div className="min-w-0 space-y-3">
          {cartLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : (
            <>
              {!user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm shadow-sm">
                  <p className="text-muted-foreground">
                    You&apos;re shopping as a guest.{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => openAuth("login", "Sign in to sync your cart across devices")}
                    >
                      Sign in
                    </button>{" "}
                    to save your cart.
                  </p>
                </div>
              )}

              {cartItems.map((item) => {
                const overStock = !item.product.isDigital && item.quantity > item.product.stock;
                return (
                  <div
                    key={item.productId}
                    className="flex gap-4 rounded-2xl border bg-card p-3.5 shadow-card-3d transition-all duration-300 hover:border-primary/25 sm:p-4"
                  >
                    <button
                      type="button"
                      onClick={() => navigate({ name: "product", slug: item.product.slug })}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/60 transition-transform duration-300 hover:scale-[1.03] sm:h-28 sm:w-28"
                      aria-label={`View ${item.product.name}`}
                    >
                      <img
                        src={item.product.images[0] ?? PLACEHOLDER_IMAGE}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-primary/80">
                            {item.product.brand}
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate({ name: "product", slug: item.product.slug })}
                            className="line-clamp-2 text-left text-sm font-semibold leading-snug transition-colors hover:text-primary sm:text-base"
                          >
                            {item.product.name}
                          </button>
                          {overStock && (
                            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                              Exceeds available stock
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tracking-tight">
                            {formatCurrency(item.product.price * item.quantity)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.product.price)} each
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                        <div className="flex items-center overflow-hidden rounded-xl border shadow-sm">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={busyId === item.productId || item.quantity <= 1}
                            onClick={() => update(item.productId, item.quantity - 1)}
                            className="flex h-11 w-11 items-center justify-center transition-all hover:bg-primary/10 hover:text-primary active:scale-90 disabled:opacity-40 disabled:active:scale-100 sm:h-9 sm:w-9"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-11 text-center text-sm font-bold tabular-nums sm:w-10">
                            {busyId === item.productId ? (
                              <Loader2 size={14} className="mx-auto animate-spin" />
                            ) : (
                              item.quantity
                            )}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={busyId === item.productId}
                            onClick={() => update(item.productId, item.quantity + 1)}
                            className="flex h-11 w-11 items-center justify-center transition-all hover:bg-primary/10 hover:text-primary active:scale-90 disabled:opacity-40 disabled:active:scale-100 sm:h-9 sm:w-9"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="flex h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 active:scale-95 dark:hover:text-red-400"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {cartItems.some((i) => overStockWarning(i)) && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  Some items exceed available stock — reduce quantities before checkout.
                </div>
              )}
            </>
          )}
        </div>

        {/* summary */}
        <aside className="glass h-fit min-w-0 space-y-4 rounded-3xl p-5 shadow-card-3d lg:sticky lg:top-40">
          {totals.hasPhysical && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm">
                <Truck size={15} className="shrink-0 text-primary" />
                {remainingForFree > 0 ? (
                  <span>
                    Add <strong>{formatCurrency(remainingForFree)}</strong> for FREE shipping
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    You&apos;ve unlocked FREE shipping
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? "bg-gradient-primary" : "bg-primary/70"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <h2 className="text-lg font-extrabold tracking-tight">Order summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Shipping <span className="text-xs">(free over ₹499)</span>
              </span>
              <span className="font-semibold">
                {totals.shippingFee === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">FREE</span>
                ) : (
                  formatCurrency(totals.shippingFee)
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-extrabold tracking-tight">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
          <Button
            size="lg"
            className="shine-host w-full rounded-2xl bg-gradient-primary text-sm font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-[0.98]"
            disabled={cartItems.some((i) => overStockWarning(i))}
            onClick={() => navigate({ name: "checkout" })}
          >
            Proceed to checkout <ArrowRight size={16} />
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-2xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
            onClick={() => navigate({ name: "catalog" })}
          >
            Continue shopping
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Free delivery on orders over ₹499 · Pay with UPI, cards & wallets ·
            Orders ship in 1–2 business days.
          </p>
        </aside>
      </div>

      {/* cross-sell */}
      {suggestions.length > 0 && (
        <section className="mt-12" aria-label="You might also like">
          <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <Sparkles size={17} />
            </span>
            You might also like
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function overStockWarning(item: { product: Product; quantity: number }) {
  return !item.product.isDigital && item.quantity > item.product.stock;
}
