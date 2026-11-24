// ──────────────────────────────────────────────────────────────
// shop-891 — Product card with 3D tilt + glare (home, catalog, wishlist)
// The tilt is applied via direct style writes inside a rAF batch —
// zero React re-renders while the pointer moves, so grids of cards
// stay perfectly smooth even on low-end devices.
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { StarRating } from "@/components/shared/star-rating";
import { discountPercent, formatCurrency } from "@/lib/format";
import { productThumb } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const NEW_BADGE_MS = 14 * 24 * 3600 * 1000; // 14 days

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const addToCart = useAppStore((s) => s.addToCart);
  const toggleWishlist = useAppStore((s) => s.toggleWishlist);
  const wishlistIds = useAppStore((s) => s.wishlistIds);
  const [adding, setAdding] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef<{ px: number; py: number } | null>(null);

  // compute NEW badge only after mount to avoid SSR/client hydration mismatch
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    setIsNew(
      !!product.createdAt &&
      Date.now() - new Date(product.createdAt).getTime() < NEW_BADGE_MS
    );
  }, [product.createdAt]);

  // cancel any pending frame on unmount
  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  // paint the tilt for the latest pointer position (one frame, no re-render)
  const paintTilt = () => {
    rafRef.current = null;
    const el = cardRef.current;
    const p = pointerRef.current;
    if (!el || !p) return;
    const rx = (0.5 - p.py) * 9; // ±4.5deg
    const ry = (p.px - 0.5) * 9; // ±4.5deg
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
    if (glareRef.current) {
      glareRef.current.style.setProperty("--glare-x", `${Math.round(p.px * 100)}%`);
      glareRef.current.style.setProperty("--glare-y", `${Math.round(p.py * 100)}%`);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Touch/pen drags (i.e. scrolling) must never trigger tilt maths —
    // pointer events fire continuously on Android scroll.
    if (e.pointerType !== "mouse") return;
    const el = cardRef.current;
    if (!el || product.stock <= 0) return;
    const rect = el.getBoundingClientRect();
    pointerRef.current = {
      px: (e.clientX - rect.left) / rect.width, // 0..1
      py: (e.clientY - rect.top) / rect.height, // 0..1
    };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(paintTilt);
    }
  };

  const onPointerLeave = () => {
    pointerRef.current = null;
    const el = cardRef.current;
    if (el) el.style.transform = "";
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock <= 0 || adding) return;
    setAdding(true);
    try {
      await addToCart(product.id, 1);
      toast({
        title: "Added to cart",
        description: product.name,
      });
    } catch (err) {
      toast({
        title: "Could not add to cart",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    // optimistic store update → the heart flips instantly
    void toggleWishlist(product.id);
  };

  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const image = productThumb(product.images[0]);
  const inWishlist = wishlistIds.includes(product.id);
  const discount = discountPercent(product.price, product.compareAtPrice);

  return (
    <div className="perspective-900">
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={() => navigate({ name: "product", slug: product.slug })}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate({ name: "product", slug: product.slug });
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className={cn(
          "tilt-card preserve-3d group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground",
          "shadow-card-3d hover:shadow-pop-3d hover:border-primary/30",
          className
        )}
      >
        {/* image layer pops in 3D */}
        <div className="preserve-3d relative aspect-square overflow-hidden bg-gradient-to-br from-secondary/60 to-muted/40">
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
          />
          {/* glare */}
          <div
            ref={glareRef}
            className="tilt-glare pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
          {/* badges */}
          <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
            {isNew && (
              <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md">
                NEW
              </span>
            )}
            {discount > 0 && (
              <span className="rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md">
                {discount}% OFF
              </span>
            )}
            {product.rating >= 4.5 && product.reviewCount >= 3 && (
              <span className="glass flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
                <span className="text-amber-500" aria-hidden>★</span> Top rated
              </span>
            )}
          </div>
          {/* wishlist heart — springs in/out instantly via CSS */}
          <button
            type="button"
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={inWishlist}
            onClick={handleWishlist}
            className={cn(
              "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all duration-200 ease-out hover:scale-110 active:scale-90",
              inWishlist
                ? "bg-rose-500 text-white shadow-rose-500/40"
                : "glass text-muted-foreground hover:text-rose-500"
            )}
          >
            <Heart
              width={15}
              height={15}
              className={cn(
                "transition-transform duration-200 ease-out",
                inWishlist ? "scale-110 fill-white" : "scale-100 fill-transparent"
              )}
            />
          </button>
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <span className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                Out of stock
              </span>
            </div>
          )}
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
            {product.brand}
          </span>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">
            {product.name}
          </h3>
          <StarRating value={product.rating} count={product.reviewCount} size={13} />
          <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
            <span className="text-base font-bold tracking-tight text-foreground">
              {formatCurrency(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            )}
          </div>
          {lowStock && (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Only {product.stock} left in stock
            </span>
          )}
          <button
            type="button"
            disabled={outOfStock || adding}
            onClick={handleAdd}
            className="shine-host mt-1.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-primary text-xs font-semibold text-primary-foreground shadow-md transition-all duration-300 hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {adding ? (
              <Loader2 width={14} height={14} className="animate-spin" />
            ) : (
              <ShoppingCart width={14} height={14} />
            )}
            {outOfStock ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
