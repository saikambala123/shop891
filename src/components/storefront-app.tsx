// ──────────────────────────────────────────────────────────────
// ShopVerse — App shell (client root: routing, theme, chrome)
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useLayoutEffect } from "react";
import { ThemeProvider } from "next-themes";
import { ShieldAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { initHistoryRouting } from "@/lib/nav-history";
import type { Route } from "@/lib/store";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { HomeView } from "@/components/views/home-view";
import { CatalogView } from "@/components/views/catalog-view";
import { ProductView } from "@/components/views/product-view";
import { CartView } from "@/components/views/cart-view";
import { CheckoutView } from "@/components/views/checkout-view";
import { OrdersView } from "@/components/views/orders-view";
import { WishlistView } from "@/components/views/wishlist-view";
import { ProfileView } from "@/components/views/profile-view";
import { AuthView } from "@/components/views/auth-view";
import { InfoView } from "@/components/views/info-view";
import { AdminView } from "@/components/admin/admin-view";
import { Button } from "@/components/ui/button";

function RouteOutlet() {
  const route = useAppStore((s) => s.route);
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const navigate = useAppStore((s) => s.navigate);
  const openAuth = useAppStore((s) => s.openAuth);

  // admin route guard
  if (route.name === "admin") {
    if (!authReady) {
      return (
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      );
    }
    if (!user || user.role !== "ADMIN") {
      return (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:px-6">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10">
            <ShieldAlert size={32} className="text-orange-600 dark:text-orange-400" />
          </span>
          <h1 className="mt-6 text-2xl font-bold">Restricted area</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The admin console is available to admin accounts only.
          </p>
          <div className="mt-6 flex gap-3">
            {!user && (
              <Button size="lg" onClick={() => openAuth("login", "Sign in with an admin account")}>
                Sign in
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={() => navigate({ name: "home" })}>
              Back to store
            </Button>
          </div>
        </div>
      );
    }
    return <AdminView user={user} />;
  }

  const routeKey =
    route.name === "product"
      ? `product-${route.slug}`
      : route.name === "catalog"
        ? `catalog-${(route as { category?: string }).category ?? ""}-${(route as { search?: string }).search ?? ""}-${(route as { digital?: boolean }).digital ? "digital" : ""}`
        : route.name === "info"
          ? `info-${route.topic}`
          : route.name;

  // Plain keyed wrapper with a one-shot CSS fade — no exit animation.
  // (AnimatePresence mode="wait" left a blank gap between the old view
  // exiting and the new one mounting, which read as a flicker.)
  return (
    <div key={routeKey} className="view-enter">
      {route.name === "home" && <HomeView />}
      {route.name === "catalog" && <CatalogView />}
      {route.name === "product" && <ProductView slug={route.slug} />}
      {route.name === "cart" && <CartView />}
      {route.name === "checkout" && <CheckoutView />}
      {route.name === "orders" && <OrdersView />}
      {route.name === "wishlist" && <WishlistView />}
      {route.name === "profile" && <ProfileView />}
      {route.name === "auth" && <AuthView />}
      {route.name === "info" && <InfoView topic={route.topic} />}
    </div>
  );
}

// SSR-safe layout effect (useLayoutEffect warns when rendered on the
// server, so fall back to useEffect there).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function StorefrontApp() {
  const initAuth = useAppStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // ── Refresh keeps the current view ──
  // The SPA router stores the active route on every history entry
  // (svRoute — see lib/nav-history.ts). A browser refresh wipes the
  // in-memory Zustand state, but the history entry survives, so the
  // route is restored from it before the first paint: reloading on
  // the Orders page (or any tab) reloads THAT page, instead of
  // resetting the customer back to the home dashboard.
  useIsoLayoutEffect(() => {
    try {
      const st = window.history.state as { svRoute?: unknown } | null;
      const r = st?.svRoute;
      if (
        r &&
        typeof r === "object" &&
        typeof (r as { name?: unknown }).name === "string" &&
        (r as { name: string }).name !== "home"
      ) {
        useAppStore.setState({ route: r as Route });
      }
    } catch {
      /* stay on home if the saved state is unreadable */
    }
  }, []);

  // ── Pinch-zoom lock (mobile) ──
  // The viewport meta (maximum-scale=1, user-scalable=no) stops
  // Chrome/Android pinch zoom, but iOS Safari ignores it for
  // accessibility. These guards cover every browser: Safari's
  // gesture events are cancelled, and any two-finger touchmove is
  // swallowed before it can zoom the page. Single-finger scrolling,
  // taps and the horizontal rails keep working untouched.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, []);

  // Browser-history routing — the mobile/browser Back button walks
  // back through in-app views (with saved scroll positions).
  useEffect(() => {
    initHistoryRouting((route, scroll) => {
      useAppStore.setState({ route: route as Route });
      // Restore the remembered scroll once the view has rendered.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: scroll });
        });
      });
    }, useAppStore.getState().route);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1">
          <RouteOutlet />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
