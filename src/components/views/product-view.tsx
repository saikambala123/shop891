// ──────────────────────────────────────────────────────────────
// ShopVerse — Product detail view (gallery, info, specs,
// description, reviews, related products)
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardList,
  FileText,
  Heart,
  Leaf,
  Loader2,
  MessageSquare,
  Minus,
  PackageSearch,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ApiError, apiProducts, apiReviews } from "@/lib/api";
import { PLACEHOLDER_IMAGE, categoryMeta } from "@/lib/constants";
import {
  discountPercent,
  formatCurrency,
  formatDateTime,
} from "@/lib/format";
import { useAppStore } from "@/lib/store";
import {
  errorFieldClass,
  focusFirstError,
  type FieldErrors,
} from "@/lib/form-utils";
import { ProductCard } from "@/components/shared/product-card";
import { StarRating } from "@/components/shared/star-rating";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Product, ReviewDTO } from "@/lib/types";

const SCROLLBAR =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent";

function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "true") return;
  img.dataset.fallbackApplied = "true";
  img.src = PLACEHOLDER_IMAGE;
}

// ── Reveal-on-scroll wrapper ──────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Product hero entrance (springy, premium) ───────────────────

const heroSpring = { type: "spring", stiffness: 210, damping: 26, mass: 0.9 } as const;

function HeroReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 34, scale: 0.968 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...heroSpring, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: typeof Truck;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-3 text-xl font-extrabold tracking-tight sm:text-2xl"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
        <Icon size={19} />
      </span>
      {children}
    </h2>
  );
}

// ── Main component ────────────────────────────────────────────

export function ProductView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const addToCart = useAppStore((s) => s.addToCart);
  const startBuyNow = useAppStore((s) => s.startBuyNow);
  const toggleWishlist = useAppStore((s) => s.toggleWishlist);
  const wishlistIds = useAppStore((s) => s.wishlistIds);
  const openAuth = useAppStore((s) => s.openAuth);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [reviews, setReviews] = useState<ReviewDTO[] | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [sendingReview, setSendingReview] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<FieldErrors>({});

  // Fetch the product whenever the slug (or reload key) changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(null);
    setProduct(null);
    setReviews(null);
    setRelated([]);
    setActiveImage(0);
    setQty(1);
    const load = async () => {
      try {
        const { product: fetched } = await apiProducts.get(slug);
        if (cancelled) return;
        setProduct(fetched);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load this product. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  const productId = product?.id;
  const productCategory = product?.category;

  // Fetch reviews once the product is available.
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setReviews(null);
    apiReviews
      .list(productId)
      .then((res) => {
        if (!cancelled) setReviews(res.reviews);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Fetch related products from the same category.
  useEffect(() => {
    if (!productId || !productCategory) return;
    let cancelled = false;
    apiProducts
      .list({ category: productCategory, limit: 8 })
      .then((res) => {
        if (!cancelled) {
          setRelated(
            res.products.filter((p) => p.id !== productId).slice(0, 6)
          );
        }
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, productCategory]);

  // ── Derived values ──

  // Deduplicate the image list — the same URL twice would render
  // two identical pictures (looks like a broken, merged gallery).
  const images: string[] = product
    ? product.images.length > 0
      ? [...new Set(product.images)]
      : [PLACEHOLDER_IMAGE]
    : [];
  const activeSrc = images[Math.min(activeImage, images.length - 1)] ?? PLACEHOLDER_IMAGE;

  const outOfStock = product ? product.stock <= 0 : false;
  const lowStock = product ? !product.isDigital && !outOfStock && product.stock <= 5 : false;
  const maxQty = product && !product.isDigital ? product.stock : Number.POSITIVE_INFINITY;
  const purchaseBlocked = !product || outOfStock || qty > maxQty;
  const inWishlist = product ? wishlistIds.includes(product.id) : false;
  const discount = product ? discountPercent(product.price, product.compareAtPrice) : 0;

  // ── Actions ──

  const handleAddToCart = async () => {
    if (!product || purchaseBlocked || adding) return;
    setAdding(true);
    try {
      await addToCart(product.id, qty);
      toast({
        title: "Added to cart",
        description: `${qty} × ${product.name}`,
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

  const handleBuyNow = () => {
    if (!product || purchaseBlocked) return;
    // Direct purchase — the item is checked out on its own and the
    // cart is never touched.
    startBuyNow(product, qty);
  };

  const submitReview = async () => {
    if (!product || !user || sendingReview) return;
    // Validate first — highlight exactly what's missing so the
    // user sees WHERE the problem is instead of a dead button.
    const errs: FieldErrors = {};
    if (reviewRating < 1) errs.rating = "Choose a star rating";
    if (!reviewComment.trim()) errs.comment = "Write a few words about the product";
    setReviewErrors(errs);
    if (
      focusFirstError(errs, [
        { key: "rating", id: "rev-rating" },
        { key: "comment", id: "rev-comment" },
      ])
    )
      return;
    setSendingReview(true);
    try {
      const res = await apiReviews.create({
        productId: product.id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim(),
      });
      setReviews((prev) => [res.review, ...(prev ?? [])]);
      setProduct(res.product);
      toast({
        title: "Review submitted",
        description: "Thanks for sharing your feedback",
      });
      setReviewRating(0);
      setHoverRating(0);
      setReviewTitle("");
      setReviewComment("");
      setReviewErrors({});
    } catch (err) {
      toast({
        title: "Could not submit review",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingReview(false);
    }
  };

  // ── Render ──

  let content: ReactNode;

  if (loading) {
    content = <ProductViewSkeleton />;
  } else if (notFound) {
    content = (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
          <PackageSearch className="size-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Product not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This product may have been removed or is no longer available.
        </p>
        <Button
          className="mt-6 rounded-xl bg-gradient-primary font-semibold shadow-md hover:brightness-110"
          onClick={() => navigate({ name: "catalog" })}
        >
          <ArrowLeft className="size-4" />
          Back to catalog
        </Button>
      </div>
    );
  } else if (error || !product) {
    content = (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load product</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{error ?? "Something went wrong. Please try again."}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => navigate({ name: "catalog" })}>
              Back to catalog
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  } else {
    content = (
      <div className="flex flex-col gap-10">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button type="button" onClick={() => navigate({ name: "home" })}>
                  Home
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                onClick={() => navigate({ name: "catalog", category: product.category })}
              >
                <button type="button">
                  {categoryMeta(product.category).label}
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[180px] truncate sm:max-w-xs">
                {product.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Gallery + info */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <HeroReveal>
            <div className="flex flex-col gap-5">
              <div className="group relative aspect-square overflow-hidden rounded-3xl border bg-gradient-to-br from-secondary/60 to-muted/40 shadow-card-3d">
                {/* Plain keyed <img> — swaps in a single frame. No fade,
                    no cross-fade, no scale: two pictures can never be
                    seen blended/"merged" together. */}
                <img
                  key={activeSrc}
                  src={activeSrc}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={handleImageError}
                />
                {discount > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ ...heroSpring, delay: 0.35 }}
                    className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md"
                  >
                    {discount}% OFF
                  </motion.span>
                )}
              </div>
              {images.length > 1 && (
                <div
                  className={cn(
                    "flex gap-3 overflow-x-auto pb-1 pt-1 [-webkit-tap-highlight-color:transparent]",
                    SCROLLBAR
                  )}
                  aria-label="Product image thumbnails"
                >
                  {images.map((src, index) => (
                    <button
                      key={`${src}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`Show image ${index + 1} of ${images.length}`}
                      aria-pressed={index === activeImage}
                      className={cn(
                        "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-muted/40 transition-all duration-200 outline-none [-webkit-tap-highlight-color:transparent] focus-visible:border-primary sm:h-20 sm:w-20",
                        // Selection is drawn as an INSET border — it can
                        // never extend outside the button box, so the
                        // highlight can physically never bleed into the
                        // main picture above (no ring / ring-offset).
                        index === activeImage
                          ? "border-primary opacity-100 shadow-md"
                          : "border-transparent opacity-70 hover:-translate-y-0.5 hover:opacity-100"
                      )}
                    >
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={handleImageError}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </HeroReveal>

          {/* Info column */}
          <HeroReveal delay={0.12} className="flex flex-col gap-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary/80">
                {product.brand}
              </span>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StarRating
                value={product.rating}
                count={product.reviewCount}
                showValue
                size={15}
              />
              {product.soldCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {product.soldCount.toLocaleString()} sold
                </span>
              )}
            </div>

            {/* Price block */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {formatCurrency(product.price)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCurrency(product.compareAtPrice)}
                  </span>
                  <Badge className="border-transparent bg-gradient-primary text-primary-foreground shadow-sm">
                    Save {discount}%
                  </Badge>
                </>
              )}
            </div>

            {/* Stock badges */}
            <div className="flex flex-wrap items-center gap-2">
              {outOfStock ? (
                <Badge variant="destructive">Out of stock</Badge>
              ) : lowStock ? (
                <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                  Only {product.stock} left
                </Badge>
              ) : (
                <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  In stock
                </Badge>
              )}
            </div>

            {/* Highlights */}
            {product.highlights.length > 0 && (
              <div className="rounded-2xl border bg-muted/40 p-4">
                <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
                  <Leaf className="size-4 text-primary" /> Highlights
                </h2>
                <ul className="space-y-2">
                  {product.highlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="size-3" />
                      </span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quantity + actions */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">Quantity</span>
                <div className="flex items-center overflow-hidden rounded-xl border shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-r-none hover:bg-primary/10 hover:text-primary"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-10 text-center text-sm font-bold tabular-nums">
                    {qty}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-l-none hover:bg-primary/10 hover:text-primary"
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {!product.isDigital && (
                  <span className="text-xs text-muted-foreground">
                    {product.stock.toLocaleString()} available
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="shine-host h-11 flex-1 rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-[0.98] sm:flex-none"
                  disabled={purchaseBlocked || adding}
                  onClick={() => void handleAddToCart()}
                >
                  {adding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="size-4" />
                  )}
                  Add to Cart
                </Button>
                <Button
                  size="lg"
                  className="shine-host h-11 flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 font-bold text-white shadow-[0_10px_24px_-8px_rgb(16_185_129/0.55)] transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_30px_-8px_rgb(16_185_129/0.65)] active:scale-[0.98] sm:flex-none"
                  disabled={purchaseBlocked}
                  onClick={handleBuyNow}
                >
                  <Zap className="size-4" />
                  Buy Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full border-primary/30 shadow-card-3d transition-all hover:-translate-y-0.5 hover:border-rose-400/60 hover:text-rose-500"
                  aria-label={
                    inWishlist ? "Remove from wishlist" : "Add to wishlist"
                  }
                  onClick={() => void toggleWishlist(product.id)}
                >
                  <Heart
                    className={cn(
                      "size-5",
                      inWishlist && "fill-rose-500 text-rose-500"
                    )}
                  />
                </Button>
              </div>
            </div>

            {/* Delivery info glass card */}
            <div className="glass rounded-2xl p-4 shadow-card-3d">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Truck, title: "Free delivery", text: "On orders over ₹499" },
                  { icon: Wallet, title: "UPI & Cards", text: "Pay securely online" },
                  { icon: ShieldCheck, title: "7-day returns", text: "Easy replacement guarantee" },
                ].map((f) => (
                  <div key={f.title} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                      <f.icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">{f.title}</p>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {f.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </HeroReveal>
        </div>

        {/* Specs */}
        {product.specs.length > 0 && (
          <Reveal>
            <section aria-labelledby="specs-heading" className="space-y-4">
              <SectionHeading id="specs-heading" icon={ClipboardList}>
                Specifications
              </SectionHeading>
              <Card className="gap-0 divide-y overflow-hidden rounded-2xl p-0 py-0 shadow-card-3d">
                {product.specs.map((spec, index) => (
                  <div
                    key={`${spec.name}-${spec.value}`}
                    className={cn(
                      "flex text-sm",
                      index % 2 === 1 && "bg-muted/40"
                    )}
                  >
                    <div className="w-1/3 p-3.5 font-semibold">{spec.name}</div>
                    <div className="flex-1 p-3.5 text-muted-foreground">
                      {spec.value}
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          </Reveal>
        )}

        {/* Description */}
        <Reveal>
          <section aria-labelledby="description-heading" className="space-y-4">
            <SectionHeading id="description-heading" icon={FileText}>
              Description
            </SectionHeading>
            <p className="whitespace-pre-line rounded-2xl border bg-card/60 p-5 text-sm leading-relaxed text-muted-foreground shadow-card-3d">
              {product.description}
            </p>
          </section>
        </Reveal>

        {/* Reviews */}
        <Reveal>
          <section aria-labelledby="reviews-heading" className="space-y-4">
            <SectionHeading id="reviews-heading" icon={MessageSquare}>
              Customer reviews
            </SectionHeading>
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              {/* Summary + write review */}
              <div className="flex min-w-0 flex-col gap-4">
                <Card className="gap-4 rounded-2xl p-5 shadow-card-3d">
                  <div className="flex flex-col items-center">
                    <span className="text-gradient text-4xl font-extrabold tracking-tight">
                      {product.rating.toFixed(1)}
                    </span>
                    <StarRating value={product.rating} size={16} className="mt-1" />
                    <span className="mt-1 text-xs text-muted-foreground">
                      {product.reviewCount.toLocaleString()} reviews
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count =
                        reviews?.filter((r) => Math.round(r.rating) === star)
                          .length ?? 0;
                      const pct =
                        reviews && reviews.length > 0
                          ? (count / reviews.length) * 100
                          : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 text-right font-medium tabular-nums">
                            {star}
                          </span>
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-muted-foreground tabular-nums">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Write review */}
                <Card className="gap-3 rounded-2xl p-5 shadow-card-3d">
                  <h3 className="text-sm font-bold">Write a review</h3>
                  {!user ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Share your experience with this product.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-primary/30 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                        onClick={() => openAuth("login")}
                      >
                        Sign in to write a review
                      </Button>
                    </>
                  ) : (
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submitReview();
                      }}
                    >
                      <div
                        id="rev-rating"
                        role="radiogroup"
                        aria-label="Your rating"
                        aria-invalid={!!reviewErrors.rating}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-1 py-0.5",
                          reviewErrors.rating &&
                            "border border-destructive/60 field-error-shake"
                        )}
                      >
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = (hoverRating || reviewRating) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                              aria-checked={reviewRating === star}
                              role="radio"
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() => {
                                setReviewRating(star);
                                setReviewErrors((prev) => ({ ...prev, rating: "" }));
                              }}
                              className="rounded p-0.5 transition-transform hover:scale-110"
                            >
                              <Star
                                className={cn(
                                  "size-6",
                                  active
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-muted text-muted-foreground/30"
                                )}
                              />
                            </button>
                          );
                        })}
                        {reviewRating > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {reviewRating} / 5
                          </span>
                        )}
                      </div>
                      {reviewErrors.rating && (
                        <p className="-mt-2 text-xs font-medium text-destructive">
                          {reviewErrors.rating}
                        </p>
                      )}
                      <Input
                        placeholder="Title (optional)"
                        value={reviewTitle}
                        maxLength={100}
                        onChange={(e) => setReviewTitle(e.target.value)}
                        aria-label="Review title"
                        className="rounded-xl"
                      />
                      <div className="space-y-1.5">
                        <Textarea
                          id="rev-comment"
                          placeholder="What did you like or dislike about this product?"
                          value={reviewComment}
                          rows={4}
                          onChange={(e) => {
                            setReviewComment(e.target.value);
                            setReviewErrors((prev) => ({ ...prev, comment: "" }));
                          }}
                          aria-label="Review comment"
                          aria-invalid={!!reviewErrors.comment}
                          className={cn(
                            "rounded-xl field-sizing-fixed",
                            errorFieldClass(!!reviewErrors.comment)
                          )}
                        />
                        {reviewErrors.comment && (
                          <p className="text-xs font-medium text-destructive">
                            {reviewErrors.comment}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        disabled={sendingReview}
                        className="rounded-xl bg-gradient-primary font-semibold shadow-md hover:brightness-110"
                      >
                        {sendingReview && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Submit review
                      </Button>
                    </form>
                  )}
                </Card>
              </div>

              {/* Review list */}
              <div className="flex min-w-0 flex-col gap-4">
                {reviews === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                  ))
                ) : reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                      <MessageSquare className="size-6" />
                    </div>
                    <p className="mt-3 text-sm font-semibold">No reviews yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Be the first to share your thoughts about this product.
                    </p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <ReviewItem key={review.id} review={review} />
                  ))
                )}
              </div>
            </div>
          </section>
        </Reveal>

        {/* Related products */}
        {related.length > 0 && (
          <Reveal>
            <section aria-labelledby="related-heading" className="space-y-4">
              <SectionHeading id="related-heading" icon={Sparkles}>
                You may also like
              </SectionHeading>
              <div className={cn("rail-scroll scrollbar-slim flex gap-4 overflow-x-auto pb-2")}>
                {related.map((relatedProduct) => (
                  <ProductCard
                    key={relatedProduct.id}
                    product={relatedProduct}
                    className="w-44 shrink-0 sm:w-52"
                  />
                ))}
              </div>
            </section>
          </Reveal>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {content}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function ReviewItem({ review }: { review: ReviewDTO }) {
  const initials =
    review.userName
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-card-3d transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary ring-1 ring-primary/20">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{review.userName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(review.createdAt)}
          </p>
        </div>
        <StarRating value={review.rating} size={13} />
      </div>
      {review.title && (
        <p className="mt-3 text-sm font-semibold">{review.title}</p>
      )}
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {review.comment}
      </p>
    </article>
  );
}

function ProductViewSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="size-16 rounded-xl sm:size-20" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-2xl" />
            <Skeleton className="h-11 flex-1 rounded-2xl" />
            <Skeleton className="size-11 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
