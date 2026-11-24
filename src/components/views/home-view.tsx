// ──────────────────────────────────────────────────────────────
// shop-891 — Home view (3D hero, categories, offers, featured)
// ──────────────────────────────────────────────────────────────
"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  BadgePercent,
  ChevronRight,
  Leaf,
  PackageOpen,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiProducts } from "@/lib/api";
import { CATEGORY_META, PLACEHOLDER_IMAGE, productThumb } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { ProductCard } from "@/components/shared/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

// ── Hero parallax context (mouse spring values) ────────────────

const HeroMouseContext = createContext<{
  sx: MotionValue<number>;
  sy: MotionValue<number>;
} | null>(null);

// ── Reveal-on-scroll wrapper ──────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── 3D hero scene ─────────────────────────────────────────────

function FloatingCard({
  product,
  depth,
  className,
  sizeClass,
  tiltDeg = 0,
  floatClass,
  style,
}: {
  product: Product;
  depth: number;
  className?: string;
  sizeClass?: string;
  tiltDeg?: number;
  floatClass: string;
  style?: React.CSSProperties;
}) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <motion.div
      className={cn("absolute cursor-pointer", floatClass, className)}
      style={{ ...style, transformStyle: "preserve-3d" }}
      onClick={() => navigate({ name: "product", slug: product.slug })}
      whileHover={{ scale: 1.05, zIndex: 40 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <HeroParallax depth={depth}>
        <div
          className={cn(
            "group rounded-2xl border border-white/80 bg-card p-2 shadow-pop-3d",
            sizeClass ?? "w-36 sm:w-40"
          )}
          style={{
            transform: `rotateY(${tiltDeg}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="overflow-hidden rounded-xl">
            <img
              src={productThumb(product.images[0]) ?? PLACEHOLDER_IMAGE}
              alt={product.name}
              loading="eager"
              decoding="async"
              className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <div className="space-y-0.5 px-1 pb-0.5 pt-1.5">
            <p className="truncate text-[11px] font-medium text-foreground/85">{product.name}</p>
            <p className="text-sm font-bold text-primary">
              {formatCurrency(product.price)}
            </p>
          </div>
        </div>
      </HeroParallax>
    </motion.div>
  );
}

function HeroParallax({
  depth,
  children,
}: {
  depth: number;
  children: React.ReactNode;
}) {
  const ctx = useContext(HeroMouseContext);
  const x = useTransform(ctx!.sx, (v: number) => v * depth * 14);
  const y = useTransform(ctx!.sy, (v: number) => v * depth * 11);
  return (
    <motion.div style={{ x, y, transformStyle: "preserve-3d" }}>{children}</motion.div>
  );
}

function HeroScene({ products }: { products: Product[] }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  // Phones: freeze every always-running framer-motion loop (orbit spin,
  // badge bobbing). These are the "icons moving up and down" users see on
  // mobile — the CSS mobile guardrails only stop CSS keyframes, so the
  // framer loops must be gated here. Also honours prefers-reduced-motion.
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const freeze = isMobile || !!reduceMotion;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 16, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 55, damping: 16, mass: 0.6 });

  const onPointerMove = (e: React.PointerEvent) => {
    // Mouse only — touch/pen drags are scrolls and must not drive parallax.
    if (e.pointerType !== "mouse") return;
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    my.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const cards = products.slice(0, 3);
  const spotlight = products[3] ?? products[0];

  return (
    <HeroMouseContext.Provider value={{ sx, sy }}>
      <div
        ref={sceneRef}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          mx.set(0);
          my.set(0);
        }}
        className="perspective-1200 relative mx-auto h-[430px] w-full max-w-[560px] select-none sm:h-[470px]"
        aria-hidden
      >
        {/* soft glow base */}
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />

        {/* orbit ring decoration — centered via framer x/y (motion owns transform) */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-[300px] w-[300px] rounded-full border border-primary/30 sm:h-[350px] sm:w-[350px]"
          style={{ x: "-50%", y: "-50%", rotateX: 62, transformStyle: "preserve-3d" }}
          animate={freeze ? { rotate: 0 } : { rotate: 360 }}
          transition={
            freeze
              ? { duration: 0.3, ease: "easeOut" }
              : { duration: 40, repeat: Infinity, ease: "linear" }
          }
        >
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_2px_var(--primary)]" />
        </motion.div>

        {/* top-left floating card */}
        {cards[0] && (
          <FloatingCard
            product={cards[0]}
            depth={0.7}
            tiltDeg={-10}
            floatClass="animate-float"
            className="left-0 top-[1%] z-10"
          />
        )}

        {/* top-right floating card */}
        {cards[2] && (
          <FloatingCard
            product={cards[2]}
            depth={0.6}
            tiltDeg={10}
            floatClass="animate-float-slower"
            className="right-0 top-[3%] z-10"
          />
        )}

        {/* center (hero) card — biggest */}
        {cards[1] && (
          <FloatingCard
            product={cards[1]}
            depth={1}
            tiltDeg={-2}
            floatClass="animate-float-slow"
            className="left-[31%] top-[22%] z-20"
            sizeClass="w-40 sm:w-48"
          />
        )}

        {/* bottom-left spotlight card */}
        {spotlight && (
          <FloatingCard
            product={spotlight}
            depth={0.9}
            tiltDeg={6}
            floatClass="animate-float"
            className="bottom-[2%] left-[3%] z-10"
            sizeClass="w-32 sm:w-36"
          />
        )}

        {/* floating glass badges */}
        <motion.div
          className="glass-dark absolute right-0 top-[50%] z-30 rounded-2xl px-3.5 py-2.5 text-white shadow-pop-3d"
          style={{ rotateZ: 6 }}
          animate={freeze ? { y: 0 } : { y: [0, -10, 0] }}
          transition={
            freeze
              ? { duration: 0.3, ease: "easeOut" }
              : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/25 text-cyan-300">
              <Leaf size={15} />
            </span>
            <div>
              <p className="text-xs font-bold leading-tight">Air-purifying</p>
              <p className="text-[10px] leading-tight text-white/70">green picks</p>
            </div>
          </div>
        </motion.div>

        {/* bottom-right badge — hidden on phones: at 390px it collides with
            the Free delivery badge; the same offer heads the Discounts
            & offers rail right below the hero. */}
        <motion.div
          className="glass-dark absolute bottom-[1%] right-[3%] z-30 hidden rounded-2xl px-3.5 py-2.5 text-white shadow-pop-3d sm:block"
          style={{ rotateZ: -5 }}
          animate={freeze ? { y: 0 } : { y: [0, 9, 0] }}
          transition={
            freeze
              ? { duration: 0.3, ease: "easeOut" }
              : { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1 }
          }
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/25 text-amber-300">
              <Sparkles size={15} />
            </span>
            <div>
              <p className="text-xs font-bold leading-tight">Up to 30% off</p>
              <p className="text-[10px] leading-tight text-white/70">across the store</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="glass-dark absolute bottom-[9%] left-[38%] z-30 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-white shadow-pop-3d"
          style={{ rotateZ: -3 }}
          animate={freeze ? { y: 0 } : { y: [0, -8, 0] }}
          transition={
            freeze
              ? { duration: 0.3, ease: "easeOut" }
              : { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.6 }
          }
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/25 text-primary">
            <Truck size={15} />
          </span>
          <div>
            <p className="text-xs font-bold leading-tight">Free delivery</p>
            <p className="text-[10px] leading-tight text-white/70">on orders over ₹499</p>
          </div>
        </motion.div>
      </div>
    </HeroMouseContext.Provider>
  );
}

// ── Hero section ──────────────────────────────────────────────

function Hero({ products, loading }: { products: Product[]; loading: boolean }) {
  const navigate = useAppStore((s) => s.navigate);

  if (loading) {
    return (
      <Skeleton className="h-[520px] w-full rounded-3xl sm:h-[560px]" />
    );
  }

  return (
    <section
      aria-label="Welcome to shop-891"
      className="hero-mesh relative -mx-4 overflow-hidden rounded-3xl border border-primary/15 px-4 pb-12 pt-10 sm:-mx-6 sm:px-8 lg:pb-16 lg:pt-16"
    >
      {/* drifting blobs — the second is desktop-only: a second blur-3xl
          layer is one of the heaviest paints on phone GPUs */}
      <div className="animate-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="animate-blob-delay pointer-events-none absolute -right-24 top-1/3 hidden h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl sm:block" />
      <div className="mesh-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]" />

      <div className="relative grid items-center gap-10 lg:grid-cols-2">
        {/* copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="mb-4 gap-1.5 rounded-full border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary"
            >
              <Sparkles size={13} /> 26 departments · one store
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="font-display mx-auto max-w-xl text-4xl font-bold leading-[1.08] tracking-wide sm:text-5xl lg:mx-0 lg:text-[3.4rem]"
          >
            Everything you love, in{" "}
            <span className="text-gradient">one universe</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0"
          >
            Mobiles &amp; electronics, fashion, beauty, home &amp; kitchen,
            plants, grocery, books, toys, sports and more — everything your
            world needs, delivered to your doorstep.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <Button
              size="lg"
              onClick={() => navigate({ name: "catalog" })}
              className="shine-host h-12 rounded-2xl bg-gradient-primary px-7 text-sm font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
            >
              Shop bestsellers <ArrowRight size={17} />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 lg:justify-start"
          >
            {[
              { icon: Truck, label: "Free delivery over ₹499" },
              { icon: Wallet, label: "UPI & Cards" },
              { icon: ShieldCheck, label: "7-day easy returns" },
            ].map((f) => (
              <span key={f.label} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <f.icon size={13} />
                </span>
                {f.label}
              </span>
            ))}
          </motion.div>
        </div>

        {/* 3D scene */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroScene products={products} />
        </motion.div>
      </div>
    </section>
  );
}

// ── Home view ─────────────────────────────────────────────────

/** Shared section header for product rails. */
function RailHeader({
  icon: Icon,
  accentClass,
  title,
  subtitle,
  cta,
}: {
  icon: typeof Rocket;
  accentClass: string;
  title: string;
  subtitle: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <Reveal className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-inner ${accentClass}`}
        >
          <Icon size={20} />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-wide sm:text-3xl">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>
      {cta ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={cta.onClick}
          className="hidden rounded-xl sm:flex"
        >
          {cta.label} <ArrowRight size={15} />
        </Button>
      ) : null}
    </Reveal>
  );
}

/** Horizontal snap-scroll rail of product cards + skeleton loader. */
function ProductRail({
  products,
  loading,
  footer,
}: {
  products: Product[];
  loading: boolean;
  footer?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[3/4] w-44 shrink-0 rounded-2xl sm:w-52"
          />
        ))}
      </div>
    );
  }
  return (
    <div className="rail-scroll scrollbar-slim flex gap-4 overflow-x-auto pb-3">
      <AnimatePresence>
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            className="w-44 shrink-0 sm:w-52"
          />
        ))}
      </AnimatePresence>
      {footer}
    </div>
  );
}

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate);
  const [loading, setLoading] = useState(true);
  const [popular, setPopular] = useState<Product[]>([]);
  const [placed, setPlaced] = useState<Record<string, Product[]>>({});
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pop, br, pOffer, pNew, pLaunch, pTop] =
          await Promise.all([
            apiProducts.list({ sort: "popular", limit: 10 }),
            apiProducts.brands(),
            // Admin-curated homepage rails (placement flags).
            // A rail shows ONLY what the admin curates — no fallbacks.
            // Newest-first so freshly curated products appear instantly.
            apiProducts.list({ placement: "discount-offer", sort: "newest", limit: 12 }),
            apiProducts.list({ placement: "newly-arrived", sort: "newest", limit: 10 }),
            apiProducts.list({ placement: "just-launched", sort: "newest", limit: 10 }),
            apiProducts.list({ placement: "top-rated", sort: "rating", limit: 8 }),
          ]);
        if (cancelled) return;
        setPopular(pop.products);
        setPlaced({
          "discount-offer": pOffer.products,
          "newly-arrived": pNew.products,
          "just-launched": pLaunch.products,
          "top-rated": pTop.products,
        });
        setBrands(br.brands);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rails are fully admin-managed: each section renders only the
  // products the admin explicitly placed there. Rails with no
  // curated products are hidden entirely (after loading) so a
  // product with a single placement never leaks into other rails.
  const offers = placed["discount-offer"] ?? [];
  const newlyArrived = placed["newly-arrived"] ?? [];
  const justLaunched = placed["just-launched"] ?? [];
  const topRated = placed["top-rated"] ?? [];

  const heroProducts = useMemo(() => popular.slice(0, 4), [popular]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-14 px-4 py-6 sm:px-6 sm:py-8">
      {/* ── 3D hero ── */}
      <Hero products={heroProducts} loading={loading} />

      {/* ── trust strip ── */}
      <Reveal>
        <section
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
          aria-label="Why shop with us"
        >
          {[
            { icon: Truck, title: "Free delivery", text: "On orders over ₹499" },
            { icon: Wallet, title: "UPI & Cards", text: "Pay securely online" },
            { icon: ShieldCheck, title: "Secure payments", text: "UPI & cards accepted" },
            { icon: Sparkles, title: "Quality checked", text: "Every item, every order" },
          ].map((f, i) => (
            <div
              key={f.title}
              className="group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card-3d transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 md:bg-card/80 md:backdrop-blur"
              style={{ transitionDelay: `${i * 30}ms` }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-300 group-hover:scale-110 group-hover:from-primary group-hover:to-primary/80 group-hover:text-primary-foreground">
                <f.icon size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{f.title}</p>
                <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </section>
      </Reveal>

      {/* ── categories ── */}
      <section aria-labelledby="categories-heading">
        <Reveal className="mb-5 flex items-end justify-between">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
              <Sparkles size={13} /> Shop by department
            </p>
            <h2 id="categories-heading" className="font-display text-2xl font-semibold tracking-wide sm:text-3xl">
              One store. Every department.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {CATEGORY_META.length} departments — from the latest tech to everyday essentials.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ name: "catalog" })}
            className="hidden rounded-xl sm:flex"
          >
            View all <ArrowRight size={15} />
          </Button>
        </Reveal>
        {/* Mobile-safe rail: no per-item reveal (icons used to fly
            up one-by-one as the rail was swiped) and no scroll-snap
            (mandatory snap locks the gesture on mobile WebKit/Chrome
            and the page stops scrolling when the touch starts on the
            icons). One reveal for the whole rail instead. */}
        <Reveal>
          <div className="rail-scroll scrollbar-slim flex gap-3 overflow-x-auto pb-3">
            {CATEGORY_META.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate({ name: "catalog", category: c.id })}
                className="group flex w-[108px] shrink-0 flex-col items-center gap-2.5 rounded-2xl border bg-card px-3 py-4 text-center shadow-card-3d transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-pop-3d active:translate-y-0 active:scale-95 sm:w-[124px]"
              >
                <span className="preserve-3d flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-primary group-hover:text-primary-foreground group-hover:shadow-lg">
                  <c.icon size={22} />
                </span>
                <span className="text-[11px] font-semibold leading-tight sm:text-xs">{c.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate({ name: "catalog" })}
              className="group flex w-[108px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-all hover:border-primary hover:text-primary hover:shadow-card-3d sm:w-[124px]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                <ChevronRight size={22} />
              </span>
              <span className="text-[11px] font-semibold sm:text-xs">All departments</span>
            </button>
          </div>
        </Reveal>
      </section>

      {/* ── discounts & offers (admin curated) ── */}
      {(loading || offers.length > 0) && (
      <section aria-labelledby="offers-heading">
        <RailHeader
          icon={BadgePercent}
          accentClass="bg-gradient-to-br from-orange-500/15 to-amber-500/10 text-orange-500"
          title="Discounts & offers"
          subtitle="Biggest savings across the store — curated by our team."
          cta={{ label: "Shop all products", onClick: () => navigate({ name: "catalog" }) }}
        />
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {offers.slice(0, 8).map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 0.06} className="h-full">
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
      )}

      {/* ── just launched (admin curated) ── */}
      {(loading || justLaunched.length > 0) && (
      <section aria-labelledby="new-heading">
        <RailHeader
          icon={Rocket}
          accentClass="bg-gradient-to-br from-cyan-400/20 to-primary/10 text-cyan-600 dark:text-cyan-300"
          title="Just launched"
          subtitle="Fresh launches — every new product curated here appears instantly."
          cta={{ label: "Shop all new", onClick: () => navigate({ name: "catalog" }) }}
        />
        <ProductRail products={justLaunched} loading={loading} />
      </section>
      )}

      {/* ── newly arrived promo banner ── */}
      <Reveal>
        <section
          aria-label="Indoor plants promotion"
          className="relative overflow-hidden rounded-3xl shadow-pop-3d"
        >
          <img
            src="/products/hero-living-room-1.jpg"
            alt="Bright living room filled with indoor plants"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/60 to-transparent" />
          <div className="relative flex flex-col items-start gap-5 p-7 text-white sm:p-12">
            <Badge className="rounded-full border-primary/50 bg-primary/20 text-primary-foreground backdrop-blur hover:bg-primary/20">
              <Leaf size={12} className="mr-1" /> The plant corner
            </Badge>
            <h2 className="font-display max-w-lg text-2xl font-semibold leading-tight tracking-wide sm:text-4xl">
              Green your space with air-purifying indoor plants
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-zinc-300 sm:text-base">
              Monsteras, snake plants, palms and more — nursery-fresh, potted and
              packed to arrive thriving at your door.
            </p>
            <Button
              size="lg"
              onClick={() => navigate({ name: "catalog", category: "Indoor Plants" })}
              className="shine-host glow-primary rounded-2xl bg-gradient-primary font-bold text-white hover:brightness-110 active:scale-95"
            >
              Shop indoor plants <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      </Reveal>

      {/* ── newly arrived (admin curated) ── */}
      {(loading || newlyArrived.length > 0) && (
      <section aria-labelledby="newly-heading">
        <RailHeader
          icon={PackageOpen}
          accentClass="bg-gradient-to-br from-primary/15 to-amber-500/10 text-primary"
          title="Newly arrived"
          subtitle="Just landed in our warehouse — new stock, curated weekly."
        />
        <ProductRail products={newlyArrived} loading={loading} />
      </section>
      )}

      {/* ── top rated by customers (admin curated) ── */}
      {(loading || topRated.length > 0) && (
      <section aria-labelledby="toprated-heading">
        <RailHeader
          icon={Star}
          accentClass="bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-500"
          title="Top rated by customers"
          subtitle="Highest average reviews this month."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))
            : topRated.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 0.06} className="h-full">
                  <ProductCard product={p} />
                </Reveal>
              ))}
        </div>
      </section>
      )}

      {/* ── brand strip ── */}
      {!loading && brands.length > 0 && (
        <Reveal>
          <section
            aria-label="Trusted brands"
            className="mesh-dots rounded-3xl border bg-card p-7 md:bg-card/70 md:backdrop-blur"
          >
            <p className="mb-5 flex items-center justify-center gap-2 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles size={15} className="text-primary" /> Trusted brands on shop-891
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
              {brands.slice(0, 18).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => navigate({ name: "catalog" })}
                  className="text-base font-bold tracking-tight text-muted-foreground/70 transition-all hover:-translate-y-0.5 hover:text-primary"
                >
                  {b}
                </button>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}
