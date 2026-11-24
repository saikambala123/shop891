// ──────────────────────────────────────────────────────────────
// ShopVerse — Multi-step checkout (shipping → payment → review)
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Package,
  Plus,
  ShoppingCart,
  Smartphone,
  Tag,
  Ticket,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { apiAddresses, apiCoupons, apiOrders, ApiError, computeTotals } from "@/lib/api";
import {
  errorFieldClass,
  focusFirstError,
} from "@/lib/form-utils";
import { formatCurrency } from "@/lib/format";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  CartItemDTO,
  CouponQuote,
  OrderDTO,
  PaymentMethod,
  PublicCoupon,
  ShippingAddress,
} from "@/lib/types";

const STEPS = ["Shipping", "Payment", "Review"] as const;

const emptyAddress: ShippingAddress = {
  fullName: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",
};

export function CheckoutView() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const openAuth = useAppStore((s) => s.openAuth);
  const cartItems = useAppStore((s) => s.cartItems);
  const cartCount = useAppStore((s) => s.cartCount);
  const refreshCart = useAppStore((s) => s.refreshCart);
  const buyNowItem = useAppStore((s) => s.buyNowItem);
  const clearBuyNow = useAppStore((s) => s.clearBuyNow);

  const [step, setStep] = useState(0);

  // ── Direct "Buy Now" ──
  // When active, this checkout covers only that item and the cart
  // is left completely untouched.
  const isDirectBuy = !!buyNowItem;
  const checkoutItems: CartItemDTO[] = buyNowItem ? [buyNowItem] : cartItems;

  // ── Address book ──
  // Saved addresses live on the account (managed from the profile).
  // Repeat customers pick one; a one-off delivery uses the form.
  const savedAddresses = user?.addresses ?? [];
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const selectedAddress =
    savedAddresses.find((a) => a.id === selectedAddressId) ?? null;

  const legacySaved = user?.savedAddress ?? null;
  const [address, setAddress] = useState<ShippingAddress>(
    legacySaved
      ? { ...legacySaved }
      : { ...emptyAddress, fullName: user?.name ?? "" }
  );
  const [saveAddress, setSaveAddress] = useState(true);

  /** The address this order actually ships to. */
  const effectiveAddress: ShippingAddress = selectedAddress
    ? {
        fullName: selectedAddress.fullName,
        phone: selectedAddress.phone,
        street: selectedAddress.street,
        city: selectedAddress.city,
        state: selectedAddress.state,
        zipCode: selectedAddress.zipCode,
        country: selectedAddress.country,
      }
    : address;

  // Sync the selection/form once the signed-in user is known (the
  // user may sign in mid-checkout, so the initial state can be empty).
  const addressSyncedRef = useRef(false);
  useEffect(() => {
    if (!user || addressSyncedRef.current) return;
    addressSyncedRef.current = true;
    const book = user.addresses ?? [];
    if (book.length > 0) {
      setSelectedAddressId((book.find((a) => a.isDefault) ?? book[0]).id);
    } else if (user.savedAddress) {
      // Legacy single saved address — prefill the form and migrate
      // it into the address book (best-effort, silent) so it shows
      // up in the profile and as a selectable card here.
      setAddress({ ...user.savedAddress });
      apiAddresses
        .add({
          address: { ...user.savedAddress, label: "Home" },
          isDefault: true,
        })
        .then(({ user: updated }) => {
          useAppStore.getState().setUser(updated);
          const first = updated.addresses?.[0];
          if (first) setSelectedAddressId(first.id);
        })
        .catch(() => undefined);
    } else {
      setAddress((a) => ({ ...a, fullName: user.name }));
    }
  }, [user]);

  const [payment, setPayment] = useState<PaymentMethod>("CARD");
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OrderDTO | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── step navigation always lands at the top ──
  // Every way of changing steps — the Next button (Continue to
  // payment / Review order), the confirmed Back dialog, the review
  // step's Edit links and the stepper circles — swaps the form
  // section. Each swap behaves like navigating to a fresh page:
  // the viewport jumps to the top so the new section's heading is
  // the first thing in view, on mobile and desktop alike. Without
  // this the user stays scrolled at the bottom (where the CTA
  // lives) and lands mid-way through the next step.
  const stepRef = useRef(step);
  useEffect(() => {
    if (stepRef.current === step) return;
    stepRef.current = step;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  // The success screen arrives from the bottom of the review step
  // (Place order) — start it at the top as well so the confirmation
  // card is fully in view.
  const placedRef = useRef(false);
  useEffect(() => {
    if (!placedOrder || placedRef.current) return;
    placedRef.current = true;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [placedOrder]);

  /** Patch the manual shipping form and clear that field's error. */
  const patchAddress = (patch: Partial<ShippingAddress>) => {
    setAddress((a) => ({ ...a, ...patch }));
    setErrors((prev) => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  // ── going back mid-checkout asks first ──
  const [backTarget, setBackTarget] = useState<number | null>(null);
  const requestBack = (target: number) => {
    if (placing) return;
    setBackTarget(target);
  };
  const confirmBack = () => {
    if (backTarget === null) return;
    setErrors({});
    setStep(backTarget);
    setBackTarget(null);
  };

  // ── coupon state (admin-managed codes) ──
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponQuote | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [publicCoupons, setPublicCoupons] = useState<PublicCoupon[]>([]);

  const subtotal = useMemo(
    () =>
      checkoutItems.reduce(
        (s, i) => s + i.product.price * i.quantity,
        0
      ),
    [checkoutItems]
  );

  const totals = useMemo(
    () =>
      computeTotals(
        checkoutItems.map((i) => ({ price: i.product.price, quantity: i.quantity, isDigital: i.product.isDigital })),
        coupon?.discount ?? 0
      ),
    [checkoutItems, coupon]
  );

  // Load admin-published coupon hints once the cart is ready.
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    let cancelled = false;
    apiCoupons
      .listPublic()
      .then((res) => {
        if (!cancelled) setPublicCoupons(res.coupons);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [checkoutItems.length]);

  // A stale coupon could violate its min-order after cart edits — reset it.
  useEffect(() => {
    setCoupon(null);
    setCouponError(null);
  }, [subtotal]);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || couponApplying) return;
    setCouponApplying(true);
    setCouponError(null);
    try {
      const { quote } = await apiCoupons.validate(trimmed, subtotal);
      setCoupon(quote);
      setCouponInput("");
      toast({
        title: `Coupon ${quote.code} applied`,
        description:
          quote.type === "PERCENT"
            ? `${quote.value}% off — you save ${formatCurrency(quote.discount)}`
            : `Flat ${formatCurrency(quote.value)} off — you save ${formatCurrency(quote.discount)}`,
      });
    } catch (err) {
      setCoupon(null);
      setCouponError(
        err instanceof Error ? err.message : "Could not apply this coupon"
      );
    } finally {
      setCouponApplying(false);
    }
  };

  const outOfStock = checkoutItems.some((i) => !i.product.isDigital && i.quantity > i.product.stock);

  // ── success screen ──
  if (placedOrder) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border bg-card px-6 py-12 text-center shadow-card-3d">
          <div
            aria-hidden
            className="mesh-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_60%_at_50%_35%,black,transparent)]"
          />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-card-3d ring-1 ring-primary/20">
            <CheckCircle2 size={38} />
          </span>
          <h1 className="relative mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Order placed — thank you!
          </h1>
          <p className="relative mt-2 max-w-md text-sm text-muted-foreground">
            Order <span className="font-mono font-semibold text-foreground">{placedOrder.orderNumber}</span> is
            confirmed. You&apos;ll get shipping updates as your order moves.
          </p>

          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="shine-host rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
              onClick={() => navigate({ name: "orders" })}
            >
              <Package size={16} /> View my orders
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl border-primary/30 shadow-card-3d transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
              onClick={() => navigate({ name: "catalog" })}
            >
              Continue shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── guards ──
  if (!authReady) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12 sm:px-6">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (cartItems.length === 0 && !buyNowItem) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <ShoppingCart size={34} />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Nothing to check out</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add some products to your cart first.</p>
        <Button
          size="lg"
          className="shine-host mt-6 rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
          onClick={() => navigate({ name: "catalog" })}
        >
          Browse products
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Lock size={32} />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Sign in to complete your order</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your cart is saved. Sign in or create an account in seconds to place your order.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            className="shine-host rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
            onClick={() => openAuth("login", "Sign in to complete your order")}
          >
            Sign in
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-2xl border-primary/30 shadow-card-3d transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
            onClick={() => openAuth("register", "Create an account to checkout")}
          >
            Create account
          </Button>
        </div>
      </div>
    );
  }

  // ── step validation ──
  const ADDRESS_ERROR_FIELDS = [
    { key: "fullName", id: "co-name" },
    { key: "phone", id: "co-phone" },
    { key: "zipCode", id: "co-zip" },
    { key: "street", id: "co-street" },
    { key: "city", id: "co-city" },
    { key: "state", id: "co-state" },
  ];

  const validateAddress = () => {
    // A selected saved address was validated when it was saved — only
    // the manual form needs checking.
    if (selectedAddress) return true;
    const e: Record<string, string> = {};
    if (!address.fullName.trim()) e.fullName = "Full name is required";
    if (!/^[+\d][\d\s()-]{6,}$/.test(address.phone.trim())) e.phone = "Enter a valid phone number";
    if (!address.street.trim()) e.street = "Street address is required";
    if (!address.city.trim()) e.city = "City is required";
    if (!address.state.trim()) e.state = "State is required";
    if (!/^[0-9A-Za-z\s-]{3,10}$/.test(address.zipCode.trim())) e.zipCode = "Enter a valid PIN code";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Take the user straight to the first field that needs fixing.
      focusFirstError(e, ADDRESS_ERROR_FIELDS);
      toast({
        title: "Please complete the highlighted fields",
        description: `${Object.keys(e).length} field${Object.keys(e).length === 1 ? "" : "s"} need${Object.keys(e).length === 1 ? "s" : ""} attention before continuing.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validatePayment = () => {
    const e: Record<string, string> = {};
    if (payment === "CARD") {
      const digits = card.number.replace(/\s/g, "");
      if (digits.length < 13 || !/^\d+$/.test(digits)) e.cardNumber = "Enter a valid card number";
      if (!card.name.trim()) e.cardName = "Name on card is required";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) e.cardExpiry = "Enter expiry as MM/YY";
      if (!/^\d{3,4}$/.test(card.cvc)) e.cardCvc = "CVC must be 3–4 digits";
    }
    if (payment === "UPI" && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim())) {
      e.upiId = "Enter a valid UPI ID (name@bank)";
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      focusFirstError(e, [
        { key: "cardNumber", id: "cc-num" },
        { key: "cardName", id: "cc-name" },
        { key: "cardExpiry", id: "cc-exp" },
        { key: "cardCvc", id: "cc-cvc" },
        { key: "upiId", id: "upi-id" },
      ]);
      toast({
        title: "Please complete the highlighted fields",
        description: `${Object.keys(e).length} payment field${Object.keys(e).length === 1 ? "" : "s"} need${Object.keys(e).length === 1 ? "s" : ""} attention.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const next = () => {
    if (step === 0 && totals.hasPhysical && !validateAddress()) return;
    if (step === 1 && !validatePayment()) return;
    setErrors({});
    setStep((s) => Math.min(s + 1, 2));
  };

  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    try {
      // Save a brand-new address to the address book (best-effort)
      // so the next order is one tap — never blocks checkout itself.
      if (saveAddress && totals.hasPhysical && user && !selectedAddress) {
        apiAddresses
          .add({ address: { ...address, label: "Home" } })
          .then(({ user: updated }) => useAppStore.getState().setUser(updated))
          .catch(() => undefined);
      }
      const payloadAddress = totals.hasPhysical
        ? effectiveAddress
        : { ...emptyAddress, fullName: user.name };
      const { order } = await apiOrders.checkout({
        address: payloadAddress,
        paymentMethod: payment,
        ...(coupon ? { couponCode: coupon.code } : {}),
        ...(buyNowItem
          ? { directItem: { productId: buyNowItem.productId, quantity: buyNowItem.quantity } }
          : {}),
      });
      setPlacedOrder(order);
      // order-success screen — the footer collapses to its slim
      // bottom bar for a clean, focused confirmation view
      useAppStore.getState().setCheckoutSuccess(true);
      if (buyNowItem) useAppStore.getState().clearBuyNow();
      await refreshCart();
      toast({ title: "Order placed successfully!", description: `Order ${order.orderNumber}` });
    } catch (err) {
      toast({
        title: "Could not place order",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
      // cart may have become invalid — refresh
      refreshCart();
    } finally {
      setPlacing(false);
    }
  };

  const paymentOptions: {
    value: PaymentMethod;
    icon: typeof CreditCard;
    title: string;
    description: string;
  }[] = [
    {
      value: "CARD",
      icon: CreditCard,
      title: "Credit / Debit card",
      description: "Visa, Mastercard, Amex — processed securely",
    },
    {
      value: "UPI",
      icon: Smartphone,
      title: "UPI / Wallet",
      description: "Pay with any UPI app",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
        <Lock size={12} /> Secure checkout
      </p>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Checkout</h1>
      <p className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock size={12} /> Demo checkout — no real payment is processed.
      </p>

      {/* step indicator */}
      <ol className="mb-8 flex items-center gap-2 sm:gap-4">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={i > step}
              onClick={() => i < step && requestBack(i)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300",
                i < step
                  ? "border-primary bg-gradient-primary text-primary-foreground shadow-md"
                  : i === step
                    ? "border-primary bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {i < step ? <Check size={15} /> : i + 1}
            </button>
            <span
              className={cn(
                "hidden text-sm font-semibold sm:block",
                i <= step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")} />
            )}
          </li>
        ))}
      </ol>

      {/* direct "Buy Now" notice — the cart stays untouched */}
      {isDirectBuy && (
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Zap size={15} />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-bold">Buying now — cart untouched.</span>{" "}
            <span className="text-muted-foreground">
              {cartItems.length > 0
                ? `Only this item is checked out; your cart (${cartCount} ${cartCount === 1 ? "item" : "items"}) stays saved.`
                : "This item is checked out on its own — nothing was added to a cart."}
            </span>
          </p>
          {cartItems.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-full border-primary/30 px-3 text-xs font-semibold hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
              onClick={clearBuyNow}
            >
              Check out cart instead
            </Button>
          )}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* ── STEP 1: shipping ── */}
          {step === 0 && (
            <section className="glass rounded-3xl border bg-card/60 p-5 shadow-card-3d sm:p-6" aria-label="Shipping details">
              <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                  <MapPin size={18} />
                </span>
                Shipping details
              </h2>
              {totals.hasPhysical ? (
                <>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Where should we deliver your order?
                  </p>

                  {/* saved addresses — pick one or enter a new one */}
                  {savedAddresses.length > 0 && (
                    <RadioGroup
                      value={selectedAddressId}
                      onValueChange={(v) => {
                        setSelectedAddressId(v);
                        setErrors({});
                      }}
                      className="mt-4 gap-2.5"
                      aria-label="Choose a shipping address"
                    >
                      {savedAddresses.map((a) => (
                        <Label
                          key={a.id}
                          htmlFor={`addr-${a.id}`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all duration-200",
                            selectedAddressId === a.id
                              ? "border-primary bg-primary/[0.05] shadow-card-3d ring-1 ring-primary/30"
                              : "hover:border-primary/40"
                          )}
                        >
                          <RadioGroupItem
                            id={`addr-${a.id}`}
                            value={a.id}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                              {a.fullName}
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">
                                {a.label}
                              </span>
                              {a.isDefault && (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                  Default
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {a.street}, {a.city}, {a.state} {a.zipCode}
                              <br />
                              {a.country} · {a.phone}
                            </span>
                          </span>
                        </Label>
                      ))}
                      <Label
                        htmlFor="addr-new"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-3.5 transition-all duration-200",
                          selectedAddressId === "new"
                            ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                            : "hover:border-primary/40"
                        )}
                      >
                        <RadioGroupItem id="addr-new" value="new" />
                        <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
                          <Plus size={14} /> Use a new address
                        </span>
                      </Label>
                    </RadioGroup>
                  )}

                  {(selectedAddressId === "new" || savedAddresses.length === 0) && (
                    <>
                      {savedAddresses.length > 0 && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Fill in the details below — we&apos;ll ship to this address.
                        </p>
                      )}
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="co-name">Full name</Label>
                      <Input
                        id="co-name"
                        value={address.fullName}
                        onChange={(e) => patchAddress({ fullName: e.target.value })}
                        placeholder="Aarav Sharma"
                        aria-invalid={!!errors.fullName}
                        className={cn("h-11 rounded-xl", errorFieldClass(!!errors.fullName))}
                      />
                      {errors.fullName && <p className="text-xs text-red-600 dark:text-red-400">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co-phone">Phone</Label>
                      <Input
                        id="co-phone"
                        value={address.phone}
                        onChange={(e) => patchAddress({ phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        aria-invalid={!!errors.phone}
                        className={cn("h-11 rounded-xl", errorFieldClass(!!errors.phone))}
                      />
                      {errors.phone && <p className="text-xs text-red-600 dark:text-red-400">{errors.phone}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co-zip">PIN code</Label>
                      <Input
                        id="co-zip"
                        value={address.zipCode}
                        onChange={(e) => patchAddress({ zipCode: e.target.value })}
                        placeholder="560001"
                        aria-invalid={!!errors.zipCode}
                        className={cn("h-11 rounded-xl", errorFieldClass(!!errors.zipCode))}
                      />
                      {errors.zipCode && <p className="text-xs text-red-600 dark:text-red-400">{errors.zipCode}</p>}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="co-street">Street address</Label>
                      <Input
                        id="co-street"
                        value={address.street}
                        onChange={(e) => patchAddress({ street: e.target.value })}
                        placeholder="2847 MG Road, Apt 4B"
                        aria-invalid={!!errors.street}
                        className={cn("h-11 rounded-xl", errorFieldClass(!!errors.street))}
                      />
                      {errors.street && <p className="text-xs text-red-600 dark:text-red-400">{errors.street}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co-city">City</Label>
                      <Input
                        id="co-city"
                        value={address.city}
                        onChange={(e) => patchAddress({ city: e.target.value })}
                        placeholder="Bengaluru"
                        aria-invalid={!!errors.city}
                        className={cn("h-11 rounded-xl", errorFieldClass(!!errors.city))}
                      />
                      {errors.city && <p className="text-xs text-red-600 dark:text-red-400">{errors.city}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="co-state">State</Label>
                      <Input
                        id="co-state"
                        value={address.state}
                        onChange={(e) => patchAddress({ state: e.target.value })}
                        placeholder="Karnataka"
                        aria-invalid={!!errors.state}
                        className={cn("h-11 rounded-xl", errorFieldClass(!!errors.state))}
                      />
                      {errors.state && <p className="text-xs text-red-600 dark:text-red-400">{errors.state}</p>}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="co-country">Country</Label>
                      <Input
                        id="co-country"
                        value={address.country}
                        onChange={(e) => patchAddress({ country: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* save address for next order */}
                  <label
                    htmlFor="co-save-address"
                    className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-3.5 transition-colors hover:bg-primary/[0.08]"
                  >
                    <Checkbox
                      id="co-save-address"
                      checked={saveAddress}
                      onCheckedChange={(v) => setSaveAddress(v === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        <BookmarkCheck size={14} className="text-primary" />
                        Save this address for next time
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        We&apos;ll add it to your saved addresses in your profile.
                      </span>
                    </span>
                  </label>
                    </>
                  )}
                </>
              ) : (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border bg-muted/40 p-4">
                  <Package size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">No shipping needed for this order</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Continue to payment to complete your purchase.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── STEP 2: payment ── */}
          {step === 1 && (
            <section className="glass rounded-3xl border bg-card/60 p-5 shadow-card-3d sm:p-6" aria-label="Payment method">
              <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                  <Wallet size={18} />
                </span>
                Payment method
              </h2>
              <RadioGroup
                value={payment}
                onValueChange={(v) => { setPayment(v as PaymentMethod); setErrors({}); }}
                className="mt-5 grid gap-3 sm:grid-cols-2"
              >
                {paymentOptions.map((o) => (
                  <Label
                    key={o.value}
                    htmlFor={`pay-${o.value}`}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-2.5 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5",
                      payment === o.value
                        ? "border-primary bg-primary/5 shadow-card-3d ring-1 ring-primary/30"
                        : "hover:border-primary/40"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                          payment === o.value
                            ? "bg-gradient-primary text-primary-foreground shadow-md"
                            : "bg-gradient-to-br from-primary/15 to-primary/5 text-primary"
                        )}
                      >
                        <o.icon size={17} />
                      </span>
                      <RadioGroupItem id={`pay-${o.value}`} value={o.value} />
                    </div>
                    <span className="text-sm font-bold">{o.title}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{o.description}</span>
                  </Label>
                ))}
              </RadioGroup>

              {payment === "CARD" && (
                <div className="mt-5 grid gap-4 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cc-num">Card number</Label>
                    <Input
                      id="cc-num"
                      inputMode="numeric"
                      value={card.number}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                        setCard({ ...card, number: digits.replace(/(\d{4})(?=\d)/g, "$1 ") });
                        setErrors((prev) => ({ ...prev, cardNumber: "" }));
                      }}
                      placeholder="4242 4242 4242 4242"
                      aria-invalid={!!errors.cardNumber}
                      className={cn("rounded-xl font-mono", errorFieldClass(!!errors.cardNumber))}
                    />
                    {errors.cardNumber && <p className="text-xs text-red-600 dark:text-red-400">{errors.cardNumber}</p>}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cc-name">Name on card</Label>
                    <Input
                      id="cc-name"
                      value={card.name}
                      onChange={(e) => {
                        setCard({ ...card, name: e.target.value });
                        setErrors((prev) => ({ ...prev, cardName: "" }));
                      }}
                      placeholder="AARAV SHARMA"
                      aria-invalid={!!errors.cardName}
                      className={cn("rounded-xl", errorFieldClass(!!errors.cardName))}
                    />
                    {errors.cardName && <p className="text-xs text-red-600 dark:text-red-400">{errors.cardName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-exp">Expiry (MM/YY)</Label>
                    <Input
                      id="cc-exp"
                      inputMode="numeric"
                      value={card.expiry}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                        setCard({ ...card, expiry: v });
                        setErrors((prev) => ({ ...prev, cardExpiry: "" }));
                      }}
                      placeholder="12/28"
                      aria-invalid={!!errors.cardExpiry}
                      className={cn("rounded-xl font-mono", errorFieldClass(!!errors.cardExpiry))}
                    />
                    {errors.cardExpiry && <p className="text-xs text-red-600 dark:text-red-400">{errors.cardExpiry}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-cvc">CVC</Label>
                    <Input
                      id="cc-cvc"
                      inputMode="numeric"
                      value={card.cvc}
                      onChange={(e) => {
                        setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) });
                        setErrors((prev) => ({ ...prev, cardCvc: "" }));
                      }}
                      placeholder="123"
                      aria-invalid={!!errors.cardCvc}
                      className={cn("rounded-xl font-mono", errorFieldClass(!!errors.cardCvc))}
                    />
                    {errors.cardCvc && <p className="text-xs text-red-600 dark:text-red-400">{errors.cardCvc}</p>}
                  </div>
                </div>
              )}

              {payment === "UPI" && (
                <div className="mt-5 space-y-1.5 rounded-2xl border bg-muted/40 p-4">
                  <Label htmlFor="upi-id">UPI ID</Label>
                  <Input
                    id="upi-id"
                    value={upiId}
                    onChange={(e) => {
                      setUpiId(e.target.value);
                      setErrors((prev) => ({ ...prev, upiId: "" }));
                    }}
                    placeholder="aarav@okbank"
                    aria-invalid={!!errors.upiId}
                    className={cn("rounded-xl", errorFieldClass(!!errors.upiId))}
                  />
                  {errors.upiId && <p className="text-xs text-red-600 dark:text-red-400">{errors.upiId}</p>}
                  <p className="text-xs text-muted-foreground">
                    A collect request will be sent to your UPI app (demo).
                  </p>
                </div>
              )}

              <div className="mt-6">
                <Button
                  variant="outline"
                  className="rounded-xl border-primary/25 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                  onClick={() => requestBack(0)}
                >
                  <ArrowLeft size={16} /> Back to shipping
                </Button>
              </div>
            </section>
          )}

          {/* ── STEP 3: review ── */}
          {step === 2 && (
            <section className="glass rounded-3xl border bg-card/60 p-5 shadow-card-3d sm:p-6" aria-label="Review order">
              <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                  <Check size={18} />
                </span>
                Review your order
              </h2>

              {totals.hasPhysical && (
                <div className="mt-4 rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Shipping to</p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => setStep(0)}
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {effectiveAddress.fullName} · {effectiveAddress.phone}
                    <br />
                    {effectiveAddress.street}, {effectiveAddress.city}, {effectiveAddress.state} {effectiveAddress.zipCode}
                    <br />
                    {effectiveAddress.country}
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Paying with</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => setStep(1)}
                  >
                    Edit
                  </button>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {payment === "CARD" && `Card ending in ${card.number.replace(/\s/g, "").slice(-4) || "••••"} — paid now`}
                  {payment === "UPI" && `UPI (${upiId || "your UPI app"}) — paid now`}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {checkoutItems.map((i) => (
                  <div key={i.productId} className="flex items-center gap-3 rounded-2xl border p-3 shadow-sm transition-all hover:border-primary/25">
                    <img
                      src={i.product.images[0] ?? PLACEHOLDER_IMAGE}
                      alt=""
                      className="h-14 w-14 rounded-xl border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{i.product.name}</p>
                      <p className="text-xs text-muted-foreground">Qty {i.quantity}</p>
                    </div>
                    <p className="text-sm font-bold tracking-tight">{formatCurrency(i.product.price * i.quantity)}</p>
                  </div>
                ))}
              </div>

              {outOfStock && (
                <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  {isDirectBuy
                    ? "This item is no longer available in the requested quantity."
                    : "Some items exceed available stock. Go back to your cart and adjust quantities."}
                </p>
              )}

              <div className="mt-6">
                <Button
                  variant="outline"
                  className="rounded-xl border-primary/25 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                  onClick={() => requestBack(1)}
                >
                  <ArrowLeft size={16} /> Back to payment
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* order summary rail */}
        <aside className="glass h-fit min-w-0 space-y-4 rounded-3xl p-5 shadow-card-3d lg:sticky lg:top-40">
          <h2 className="text-lg font-extrabold tracking-tight">Order summary</h2>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {checkoutItems.map((i) => (
              <div key={i.productId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">
                  {i.product.name} <span className="whitespace-nowrap">× {i.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatCurrency(i.product.price * i.quantity)}</span>
              </div>
            ))}
          </div>

          {/* ── coupon box (admin-managed codes) ── */}
          {coupon ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/[0.06] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Ticket size={15} />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-bold uppercase tracking-wide text-primary">
                    {coupon.code}
                    {coupon.firstOrderOnly && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px font-sans text-[10px] font-semibold normal-case tracking-normal text-emerald-700 dark:text-emerald-300">
                        First order only
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {coupon.description ||
                      (coupon.type === "PERCENT"
                        ? `${coupon.value}% off`
                        : `${formatCurrency(coupon.value)} off`)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCoupon(null);
                  setCouponError(null);
                }}
                aria-label={`Remove coupon ${coupon.code}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon(couponInput);
                      }
                    }}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    aria-invalid={!!couponError}
                    className="h-10 rounded-xl pl-8 font-mono uppercase tracking-wide"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 shrink-0 rounded-xl font-semibold"
                  onClick={() => applyCoupon(couponInput)}
                  disabled={!couponInput.trim() || couponApplying}
                >
                  {couponApplying ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
              {couponError && (
                <p className="text-xs font-medium text-destructive">{couponError}</p>
              )}
              {publicCoupons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {publicCoupons.slice(0, 4).map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => applyCoupon(c.code)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary transition-all hover:border-primary hover:bg-primary/10 active:scale-95"
                      title={
                        (c.description ||
                          (c.type === "PERCENT"
                            ? `${c.value}% off`
                            : `${formatCurrency(c.value)} off`)) +
                        (c.firstOrderOnly ? " — first order only" : "")
                      }
                    >
                      <Ticket size={11} /> {c.code}
                      {c.firstOrderOnly && (
                        <span className="font-sans text-[9px] font-semibold normal-case tracking-normal text-emerald-700 dark:text-emerald-300">
                          · 1st order
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>
            {coupon && (
              <div className="flex justify-between">
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <Ticket size={13} /> Coupon {coupon.code}
                </span>
                <span className="font-semibold text-primary">
                  −{formatCurrency(totals.discount)}
                </span>
              </div>
            )}
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

          {/* primary CTA — lives right below the total */}
          {step === 2 ? (
            <Button
              size="lg"
              className="shine-host mt-4 w-full rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-[0.98]"
              disabled={placing || outOfStock}
              onClick={placeOrder}
            >
              {placing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Place order · {formatCurrency(totals.total)}
            </Button>
          ) : (
            <Button
              size="lg"
              className="shine-host mt-4 w-full rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-[0.98]"
              onClick={next}
            >
              {step === 0 ? "Continue to payment" : "Review order"}{" "}
              <ArrowRight size={16} />
            </Button>
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock size={11} /> 256-bit encrypted · Demo checkout
          </p>
        </aside>
      </div>

      {/* going back mid-checkout asks first — no accidental taps */}
      <AlertDialog
        open={backTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBackTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={16} />
              </span>
              Go back to {backTarget !== null ? STEPS[backTarget].toLowerCase() : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll leave this step and return to{" "}
              {backTarget !== null ? STEPS[backTarget].toLowerCase() : ""}. Everything
              you&apos;ve filled in so far stays saved — you can come back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-end">
            <AlertDialogCancel className="mt-0 rounded-xl">Stay here</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110"
              onClick={confirmBack}
            >
              Yes, go back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
