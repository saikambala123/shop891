// ──────────────────────────────────────────────────────────────
// shop-891 — Top navigation bar (light glass header)
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  ShoppingCart,
  Sun,
  User,
  UserCircle2,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBackClose } from "@/lib/nav-history";
import { CATEGORY_META } from "@/lib/constants";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { FadingScroller } from "@/components/shared/fading-scroller";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "glow-ring group/logo relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-primary/40 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3 group-hover:glow-primary",
        className
      )}
    >
      <Image src="/logo.png" alt="shop-891 logo" width={40} height={40} className="h-full w-full object-cover" priority />
    </span>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
    >
      <Sun size={18} className="hidden dark:block" />
      <Moon size={18} className="dark:hidden" />
    </button>
  );
}

/** Account trigger — opens the dedicated profile page (no popup). */
function AccountButton({
  initials,
  userName,
  roleBadge,
}: {
  initials: string;
  userName: string;
  roleBadge: { label: string; className: string } | null;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const isProfile = useAppStore((s) => s.route.name) === "profile";

  return (
    <button
      type="button"
      aria-label="Open your profile page"
      onClick={() => navigate({ name: "profile" })}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-primary/10 sm:px-2 sm:py-1.5",
        isProfile && "bg-primary/10"
      )}
    >
      <span className="relative">
        <Avatar className="h-8 w-8 border border-primary/30 shadow-sm">
          <AvatarFallback className="bg-gradient-primary text-xs font-extrabold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        {roleBadge && (
          <Badge
            variant="outline"
            className="absolute -right-2.5 -top-1.5 h-4 rounded-md border-orange-500/40 bg-orange-500/15 px-1 text-[8px] font-extrabold leading-none text-orange-600 dark:text-orange-300"
          >
            {roleBadge.label}
          </Badge>
        )}
      </span>
      <span className="hidden leading-tight md:block">
        <span className="block text-[11px] text-muted-foreground">Hello,</span>
        <span className="block text-sm font-semibold">{userName.split(" ")[0]}</span>
      </span>
      <ChevronDown
        size={14}
        className="hidden text-muted-foreground transition-transform duration-200 md:block"
      />
    </button>
  );
}

export function Navbar() {
  const navigate = useAppStore((s) => s.navigate);
  const route = useAppStore((s) => s.route);
  const user = useAppStore((s) => s.user);
  const cartCount = useAppStore((s) => s.cartCount);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const openAuth = useAppStore((s) => s.openAuth);
  const logout = useAppStore((s) => s.logout);
  const [input, setInput] = useState(searchQuery);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Browser/mobile Back closes the topmost overlay first instead of
  // navigating away (history entry per overlay — lib/nav-history.ts).
  useBackClose(searchOpen, () => setSearchOpen(false));
  useBackClose(menuOpen, () => setMenuOpen(false));
  useBackClose(signOutOpen, () => setSignOutOpen(false));

  // keep local input in sync when the store changes from elsewhere
  useEffect(() => {
    setInput(searchQuery);
  }, [searchQuery]);

  // mobile expanded search: autofocus the field, close on Escape and
  // block wheel/touch scroll behind the backdrop WITHOUT locking the
  // document (hard locks made the page jump to the top on close).
  useEffect(() => {
    if (!searchOpen) return;
    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 80);
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    const onWheel = (e: WheelEvent) => e.preventDefault();
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [searchOpen]);

  // close the expanded search whenever we navigate elsewhere
  useEffect(() => {
    setSearchOpen(false);
  }, [route]);

  // auto-close if the viewport grows into the desktop layout
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setSearchOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(input);
    if (route.name !== "catalog") {
      navigate({ name: "catalog", search: input });
    }
  };

  const onMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(input);
    setSearchOpen(false);
    if (input.trim() && route.name !== "catalog") {
      navigate({ name: "catalog", search: input });
    }
  };

  const goCategory = (category?: string) => {
    setSearchQuery("");
    setMenuOpen(false);
    setSearchOpen(false);
    navigate(
      category
        ? { name: "catalog", category }
        : { name: "catalog" }
    );
  };

  const roleBadge =
    user?.role === "ADMIN"
      ? { label: "Admin", className: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300" }
      : null;

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
    .trim();

  const confirmSignOut = async () => {
    setSignOutOpen(false);
    setMenuOpen(false);
    await logout();
    navigate({ name: "home" });
  };

  const allActive =
    route.name === "catalog" && !("category" in route && route.category);

  return (
    <>
      {/* frosted backdrop — sits below the header (z-40 < z-50) so the top
          bars and search panel stay crisp while the page content is blurred */}
      <AnimatePresence>
        {searchOpen && (
          <motion.button
            key="search-backdrop"
            type="button"
            aria-label="Close search"
            tabIndex={-1}
            onClick={() => setSearchOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ touchAction: "none" }}
            className="fixed inset-0 z-40 cursor-default bg-background/55 backdrop-blur-md md:hidden"
          />
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 w-full">
      {/* announcement ticker — neon marquee */}
      <div className="marquee-host overflow-hidden bg-gradient-primary text-[11px] font-semibold tracking-wide text-primary-foreground sm:text-xs">
        <div className="animate-marquee flex w-max items-center py-1.5">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {[
                "Free delivery on orders over ₹499",
                "Pay with UPI, cards & wallets",
                "Coupons & daily deals — apply at checkout",
                "7-day easy returns",
              ].map((msg) => (
                <span key={msg} className="flex items-center">
                  <span className="px-6 py-0.5">{msg}</span>
                  <span className="inline-block h-1 w-1 rounded-full bg-primary-foreground/70" aria-hidden />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* main bar — light glass on desktop, solid on mobile (backdrop
          blur on a sticky bar repaints every scroll frame on phones) */}
      <div className="border-b border-primary/10 bg-card text-card-foreground shadow-card-3d md:bg-card/80 md:backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:gap-4">
          {/* mobile menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setSearchOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:hidden"
              >
                <Menu size={20} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetTitle className="flex items-center gap-2.5 border-b px-4 py-3.5 text-base font-bold">
                <LogoMark className="h-8 w-8 rounded-lg" />
                <span className="font-display tracking-wide">
                  shop<span className="text-primary">-891</span>
                </span>
              </SheetTitle>
              <SheetDescription className="sr-only">Browse categories and manage your account</SheetDescription>

              {/* account section — always visible in the mobile drawer */}
              <div className="border-b px-3 py-4">
                {user ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0 border border-primary/30 shadow-sm">
                        <AvatarFallback className="bg-gradient-primary text-sm font-extrabold text-white">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold">{user.name}</span>
                          {roleBadge && (
                            <Badge variant="outline" className={cn("shrink-0 text-[10px]", roleBadge.className)}>
                              {roleBadge.label}
                            </Badge>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      {/* dark-mode toggle beside profile in the sidebar */}
                      <ThemeToggle />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl text-xs font-semibold"
                        onClick={() => { setMenuOpen(false); navigate({ name: "profile" }); }}
                      >
                        <UserCircle2 size={14} /> Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl text-xs font-semibold"
                        onClick={() => { setMenuOpen(false); navigate({ name: "orders" }); }}
                      >
                        <Package size={14} /> Orders
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSignOutOpen(true)}
                      className="mt-2 h-9 w-full rounded-xl border-red-500/40 text-xs font-bold text-red-600 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
                    >
                      <LogOut size={14} /> Sign Out
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => { setMenuOpen(false); openAuth("login"); }}
                      className="shine-host h-10 flex-1 rounded-xl bg-gradient-primary text-sm font-bold shadow-md hover:brightness-110"
                    >
                      <User size={15} /> Sign in / Create account
                    </Button>
                    {/* dark-mode toggle beside profile in the sidebar */}
                    <ThemeToggle />
                  </div>
                )}
              </div>

              <nav className="flex flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Categories">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Departments
                </p>
                <button
                  type="button"
                  onClick={() => goCategory()}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  All Products
                </button>
                {CATEGORY_META.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goCategory(c.id)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <c.icon size={16} className="text-primary/70" />
                    {c.label}
                  </button>
                ))}
                <div className="my-2 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate({ name: "orders" }); }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Package size={16} className="text-primary/70" /> My Orders
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate({ name: "wishlist" }); }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Heart size={16} className="text-primary/70" /> Wishlist
                </button>
                {user?.role === "ADMIN" && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate({ name: "admin", tab: "overview" }); }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <LayoutDashboard size={16} className="text-primary/70" />
                    Admin Console
                  </button>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          {/* logo */}
          <Link
            href="/"
            onClick={(e) => { e.preventDefault(); setSearchOpen(false); navigate({ name: "home" }); }}
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="shop-891 home"
          >
            <LogoMark />
            <span className="font-display hidden text-xl font-bold tracking-wide sm:block">
              shop<span className="text-primary">-891</span>
            </span>
          </Link>

          {/* search — inline on desktop only; mobile expands it below the top bar */}
          <form
            onSubmit={onSearchSubmit}
            role="search"
            className="hidden min-w-0 flex-1 items-center overflow-hidden rounded-full border bg-muted/50 shadow-sm transition-all duration-300 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/25 md:flex"
          >
            <Search
              size={15}
              className="ml-3 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // live filtering while browsing the catalog
                if (route.name === "catalog") setSearchQuery(e.target.value);
              }}
              placeholder="Search products & more…"
              aria-label="Search products"
              className="h-9 border-0 bg-transparent text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="submit"
              aria-label="Search"
              className="shine-host flex h-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary px-4 text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-95"
            >
              <Search size={15} />
            </button>
          </form>

          {/* mobile search trigger — opens the expanded bar below the top bar */}
          <div className="min-w-0 flex-1 md:hidden" aria-hidden />
          <button
            type="button"
            aria-label="Search products"
            aria-expanded={searchOpen}
            onClick={() => { setMenuOpen(false); setSearchOpen(true); }}
            className="shine-host flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/60 px-3 text-muted-foreground shadow-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95 md:hidden"
          >
            <Search size={16} />
            <span className="text-xs font-semibold">Search</span>
          </button>

          {/* account — opens the dedicated profile page (like cart) */}
          {user ? (
            <AccountButton
              initials={initials || "U"}
              userName={user.name}
              roleBadge={roleBadge}
            />
          ) : (
            <Button
              variant="ghost"
              onClick={() => openAuth("login")}
              aria-label="Sign in"
              className="shrink-0 gap-1.5 rounded-full px-2 text-muted-foreground hover:bg-primary/10 hover:text-primary md:px-4"
            >
              <User size={18} />
              <span className="hidden text-sm font-semibold lg:inline">Sign in</span>
            </Button>
          )}

          {/* notification bell — icon-only trigger with numeric badge */}
          <NotificationsBell />

          {/* cart */}
          <button
            type="button"
            onClick={() => navigate({ name: "cart" })}
            aria-label={`Cart with ${cartCount} items`}
            className="relative flex items-center gap-1.5 rounded-full px-2 py-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <div className="relative">
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-primary px-1 text-[10px] font-bold text-primary-foreground shadow-md ring-1 ring-primary/30">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </div>
            <span className="hidden text-sm font-semibold lg:inline">Cart</span>
          </button>
        </div>
      </div>

      {/* category bar — pill nav (solid background on mobile). The
          row scrolls horizontally with soft edge fades (FadingScroller)
          so categories melt into the edge instead of being cut mid-word. */}
      <div className="border-b border-border/60 bg-background text-muted-foreground md:bg-background/80 md:backdrop-blur-xl">
        <FadingScroller
          className="mx-auto max-w-7xl px-4"
          contentClassName="flex items-center gap-1.5 py-2 text-sm"
          fadeSize={40}
        >
          <button
            type="button"
            onClick={() => goCategory()}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 font-semibold transition-all duration-300 hover:bg-primary/10 hover:text-primary",
              allActive && "bg-primary text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground"
            )}
          >
            All
          </button>
          {CATEGORY_META.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => goCategory(c.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-all duration-300 hover:bg-primary/10 hover:text-primary",
                route.name === "catalog" && "category" in route && route.category === c.id &&
                  "bg-primary text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
          {user?.role === "ADMIN" && (
            <button
              type="button"
              onClick={() => navigate({ name: "admin", tab: "overview" })}
              className="ml-auto hidden shrink-0 rounded-full px-3.5 py-1.5 font-medium text-orange-600 transition-colors hover:bg-orange-500/10 sm:block dark:text-orange-300"
            >
              Admin Console
            </button>
          )}
        </FadingScroller>
      </div>

      {/* mobile expanded search — slides in below the top bars.
          Transform/opacity only: no height animation (height measurement
          made framer-motion scroll the page and felt laggy on phones). */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-panel"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            style={{ willChange: "transform, opacity" }}
            className="relative z-50 border-b border-primary/15 bg-card shadow-card-3d md:bg-card/95 md:backdrop-blur-xl md:hidden"
          >
            <form
              onSubmit={onMobileSearchSubmit}
              role="search"
              className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-3"
            >
              <div className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-full border border-primary/25 bg-background shadow-lg transition-all duration-300 focus-within:border-primary/60 focus-within:glow-primary focus-within:ring-2 focus-within:ring-primary/30">
                <Search size={18} className="ml-4 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  ref={searchInputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // live filtering while browsing the catalog
                    if (route.name === "catalog") setSearchQuery(e.target.value);
                  }}
                  placeholder="Search products & more…"
                  aria-label="Search products"
                  className="h-12 border-0 bg-transparent px-3 text-base font-medium text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                />
                {input.length > 0 && (
                  <button
                    type="button"
                    aria-label="Clear search text"
                    onClick={() => {
                      setInput("");
                      if (route.name === "catalog") setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive active:scale-90"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="Search"
                  className="shine-host flex h-12 w-12 shrink-0 items-center justify-center self-stretch bg-gradient-primary text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-95"
                >
                  <Search size={18} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="shrink-0 rounded-full px-1 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-primary active:scale-95"
              >
                Cancel
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      </header>

      {/* sign-out confirmation — compact panel */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent className="max-w-[300px] gap-3 rounded-xl p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <LogOut size={15} />
              </span>
              Sign out of shop-891?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              You&apos;ll need to sign in again to access your cart,
              orders and wishlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9 rounded-lg px-3 text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSignOut}
              className="h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition-all hover:bg-red-700 focus-visible:ring-red-500/60"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
