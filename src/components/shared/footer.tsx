// ──────────────────────────────────────────────────────────────
// shop-891 — Site footer (deep space navy + neon accents)
// ──────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import {
  ArrowRight,
  CreditCard,
  Github,
  Instagram,
  ShieldCheck,
  Sparkles,
  Ticket,
  Truck,
  Twitter,
  Wallet,
  Youtube,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { CATEGORY_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InfoTopic } from "@/lib/store";

export function Footer() {
  const navigate = useAppStore((s) => s.navigate);
  const route = useAppStore((s) => s.route);
  const checkoutSuccess = useAppStore((s) => s.checkoutSuccess);
  const [email, setEmail] = useState("");

  const goInfo = (topic: InfoTopic) => navigate({ name: "info", topic });

  // During checkout the Shop / Help / Company columns are hidden for a
  // focused, distraction-free payment experience.
  const isCheckout = route.name === "checkout";

  // After an order is placed the success screen gets an even cleaner
  // footer: only the slim bottom bar (copyright + payment badges) —
  // no newsletter, no brand block, no link columns, no trust row.
  const isSuccess = isCheckout && checkoutSuccess;

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    toast({ title: "Subscribed!", description: "Deal alerts are on their way to your inbox." });
    setEmail("");
  };

  return (
    <footer className="relative mt-auto bg-zinc-950 text-zinc-300/80">
      {/* neon top edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-primary/10 to-transparent" />

      {/* newsletter strip */}
      {!isSuccess && (
      <div className="relative border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-9 sm:flex-row">
          <div className="flex items-start gap-3.5">
            <span className="animate-neon-pulse mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <Ticket size={18} />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold tracking-wide text-white">
                Never miss a deal
              </h3>
              <p className="mt-0.5 text-sm text-zinc-400">
                Get coupon codes, price-drop alerts and new arrivals in your inbox.
              </p>
            </div>
          </div>
          <form onSubmit={subscribe} className="flex w-full max-w-sm gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus-visible:ring-primary/50"
            />
            <Button
              type="submit"
              className="shine-host h-11 shrink-0 rounded-xl bg-gradient-primary font-semibold text-white shadow-lg shadow-black/40 hover:brightness-110"
            >
              Subscribe <ArrowRight size={15} />
            </Button>
          </form>
        </div>
      </div>
      )}

      {/* link columns + brand block */}
      {!isSuccess && (
      <>{/* Mobile (<sm): 2-column grid where the left cell stacks Shop
          directly above Company (fills the tall gap the taller Help
          column used to leave) and Help fills the right cell.
          sm+: the wrapper turns into `display: contents` so all three
          navs become independent grid columns in their original
          Shop | Help | Company order. */}
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-8 gap-y-10 px-4 py-12 sm:grid-cols-3 sm:gap-8 lg:grid-cols-4">
        <div className={isCheckout ? "col-span-2 sm:col-span-3 lg:col-span-4" : "col-span-2 sm:col-span-3 lg:col-span-1"}>
          <div className="flex items-center gap-2.5">
            { }
            <img src="/logo.png" alt="shop-891 logo" className="glow-ring h-10 w-10 rounded-xl object-cover" />
            <span className="font-display text-xl font-semibold tracking-wide text-white">
              shop<span className="text-primary">-891</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
            India&apos;s modern online marketplace — mobiles, electronics,
            fashion, home &amp; kitchen, plants, grocery and everyday
            essentials, delivered to your door.
          </p>
          <div className="mt-4 flex gap-2">
            {[Twitter, Instagram, Youtube, Github].map((Icon, i) => (
              <span
                key={i}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/5 text-zinc-400 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:bg-primary/20 hover:text-primary hover:ring-primary/40"
              >
                <Icon size={15} />
              </span>
            ))}
          </div>
        </div>

        {!isCheckout && (
          <>
            {/* Mobile: Shop + Company share the left column; sm+: separate columns */}
            <div className="sm:contents">
              <nav aria-label="Shop" className="sm:order-2">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary/90">Shop</h4>
                <ul className="space-y-2 text-sm">
                  {CATEGORY_META.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => navigate({ name: "catalog", category: c.id })}
                        className="text-zinc-400 transition-colors hover:text-white"
                      >
                        {c.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Company" className="mt-10 sm:mt-0 sm:order-4">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary/90">Company</h4>
                <ul className="space-y-3 text-sm">
                  <li>
                    <button
                      type="button"
                      onClick={() => goInfo("about")}
                      className="font-medium text-zinc-300 transition-colors hover:text-white"
                    >
                      About shop-891
                    </button>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                      India&apos;s modern marketplace — our story, mission &amp; values.
                    </p>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => goInfo("privacy")}
                      className="font-medium text-zinc-300 transition-colors hover:text-white"
                    >
                      Privacy Policy
                    </button>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                      How we collect, use &amp; protect your data.
                    </p>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => goInfo("terms")}
                      className="font-medium text-zinc-300 transition-colors hover:text-white"
                    >
                      Terms of Service
                    </button>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                      The rules for shopping with shop-891.
                    </p>
                  </li>
                </ul>
              </nav>
            </div>

            <nav aria-label="Help" className="sm:order-3">
              <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary/90">Help</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate({ name: "orders" })}
                    className="font-medium text-zinc-300 transition-colors hover:text-white"
                  >
                    Track Your Order
                  </button>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                    Live status for every order &amp; shipment.
                  </p>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => goInfo("shipping")}
                    className="text-left font-medium text-zinc-300 transition-colors hover:text-white"
                  >
                    Shipping &amp; Delivery
                  </button>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                    Free delivery over ₹499 · 2–5 business days across 19,000+ pin codes.
                  </p>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => goInfo("returns")}
                    className="text-left font-medium text-zinc-300 transition-colors hover:text-white"
                  >
                    Returns &amp; Refunds
                  </button>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                    7-day easy returns with instant refunds to the original payment method.
                  </p>
                </li>
                <li>
                  <h5 className="font-medium text-zinc-300">Contact Us</h5>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                    saikambala111@gmail.com · 8919301129 (Mon–Sat, 9am–9pm IST)
                  </p>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => goInfo("faq")}
                    className="font-medium text-zinc-300 transition-colors hover:text-white"
                  >
                    FAQs
                  </button>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                    Payments, coupons, delivery &amp; account help.
                  </p>
                </li>
              </ul>
            </nav>
          </>
        )}
      </div>
      </>
      )}

      {/* trust badges row */}
      {!isSuccess && (
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:justify-between">
          {[
            { icon: Truck, label: "Fast delivery across India" },
            { icon: ShieldCheck, label: "Secure checkout" },
            { icon: Sparkles, label: "Quality checked" },
          ].map((f) => (
            <span key={f.label} className="flex items-center gap-2 text-xs text-zinc-400">
              <f.icon size={14} className="text-primary" />
              {f.label}
            </span>
          ))}
        </div>
      </div>
      )}

      {/* bottom bar — respects the iPhone home-bar safe area */}
      <div className="safe-bottom relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-5 text-xs text-zinc-500 sm:flex-row">
          <p>© {new Date().getFullYear()} shop-891 Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
              <CreditCard size={13} className="text-primary" /> Card
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
              <Wallet size={13} className="text-primary" /> UPI
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
