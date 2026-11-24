// ──────────────────────────────────────────────────────────────
// ShopVerse — Wishlist view
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { apiWishlist } from "@/lib/api";
import { ProductCard } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/types";

export function WishlistView() {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const openAuth = useAppStore((s) => s.openAuth);
  const navigate = useAppStore((s) => s.navigate);
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!user) return;
    apiWishlist
      .get()
      .then((r) => setProducts(r.products))
      .catch(() => setProducts([]));
  }, [user]);

  if (!authReady) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20">
          <Heart size={32} />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Your wishlist</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sign in to save products you love and find them here across all your devices.
        </p>
        <Button
          size="lg"
          className="shine-host mt-6 rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
          onClick={() => openAuth("login", "Sign in to view your wishlist")}
        >
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-500">
        <Heart size={13} /> Saved
      </p>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
        My Wishlist
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {products === null
          ? "Loading…"
          : `${products.length} saved ${products.length === 1 ? "item" : "items"} — tap the heart on any card to remove it.`}
      </p>

      {products === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center shadow-card-3d">
          <div
            aria-hidden
            className="mesh-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-500 ring-1 ring-rose-500/20">
            <Sparkles size={28} />
          </span>
          <h2 className="relative mt-5 text-lg font-extrabold tracking-tight">Nothing saved yet</h2>
          <p className="relative mt-1.5 max-w-sm text-sm text-muted-foreground">
            Tap the heart icon on any product to keep it here for later.
          </p>
          <Button
            className="shine-host relative mt-5 rounded-full bg-gradient-primary px-6 font-semibold shadow-md transition-all hover:brightness-110"
            onClick={() => navigate({ name: "catalog" })}
          >
            Discover products <ArrowRight size={15} />
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
