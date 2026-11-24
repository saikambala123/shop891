// ──────────────────────────────────────────────────────────────
// shop-891 — Info pages (About, FAQ, Privacy, Terms)
// Each footer link opens a dedicated, fully detailed page.
// ──────────────────────────────────────────────────────────────
"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Globe2,
  HeartHandshake,
  Info,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Truck,
  Undo2,
  Users,
} from "lucide-react";
import { useAppStore, type InfoTopic } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── Topic registry ────────────────────────────────────────────

const TOPIC_META: Record<
  InfoTopic,
  { title: string; kicker: string; icon: typeof Info; updated: string }
> = {
  about: {
    title: "About shop-891",
    kicker: "Company",
    icon: Building2,
    updated: "Updated March 2025",
  },
  faq: {
    title: "Frequently asked questions",
    kicker: "Help",
    icon: FileText,
    updated: "Everything about orders, payments & returns",
  },
  privacy: {
    title: "Privacy Policy",
    kicker: "Legal",
    icon: ShieldCheck,
    updated: "Last updated: 1 March 2025",
  },
  terms: {
    title: "Terms of Service",
    kicker: "Legal",
    icon: Scale,
    updated: "Last updated: 1 March 2025",
  },
  shipping: {
    title: "Shipping & Delivery",
    kicker: "Help",
    icon: Truck,
    updated: "Timelines, charges & order tracking",
  },
  returns: {
    title: "Returns & Refunds",
    kicker: "Help",
    icon: RotateCcw,
    updated: "7-day returns, exchanges & refund timelines",
  },
};

const ALL_TOPICS: InfoTopic[] = [
  "about",
  "shipping",
  "returns",
  "faq",
  "privacy",
  "terms",
];

// ── Shared page scaffolding ───────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-card-3d sm:p-7">
      <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight sm:text-xl">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
            <Icon size={18} />
          </span>
        )}
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border bg-background/60 p-4 text-center shadow-sm">
      <p className="bg-gradient-primary bg-clip-text text-2xl font-extrabold text-transparent sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}


// ── Topic: About ──────────────────────────────────────────────

function AboutContent() {
  return (
    <div className="space-y-6">
      <Section icon={Info} title="Our story">
        <p>
          shop-891 began with a simple frustration: buying everyday essentials
          in India meant juggling half a dozen apps, each with its own login,
          wallet and delivery fee. In 2023 we set out to build one modern
          marketplace that carries everything a household needs — from
          smartphones and laptops to kitchenware, fashion, plants, groceries
          and digital gift cards — under a single, honest checkout.
        </p>
        <p>
          Today shop-891 curates 90+ product lines from verified brands and
          sellers, ships to more than 19,000 pin codes, and processes payments
          over UPI, cards and wallets — all with the same obsession we started
          with: make online shopping in India fast, fair and delightful.
        </p>
      </Section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard value="90+" label="Curated product lines" />
        <StatCard value="19,000+" label="Pin codes served" />
        <StatCard value="4.8★" label="Average store rating" />
        <StatCard value="24/7" label="Order tracking" />
      </div>

      <Section icon={Sparkles} title="Our mission">
        <p>
          To give every Indian household a single trustworthy store for
          electronics, home and everyday essentials — with transparent
          pricing, fast delivery and returns that are actually easy.
        </p>
      </Section>

      <Section icon={HeartHandshake} title="What we value">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: BadgeIndianRupee,
              title: "Honest pricing",
              text: "Real compare-at prices, no inflated MRP games. Daily deals are real discounts.",
            },
            {
              icon: Truck,
              title: "Fast, tracked delivery",
              text: "Free shipping over ₹499, live status on every parcel, 2–5 day delivery pan-India.",
            },
            {
              icon: RotateCcw,
              title: "Easy returns",
              text: "7-day no-questions returns with instant refunds to your original payment method.",
            },
            {
              icon: ShieldCheck,
              title: "Secure by default",
              text: "Encrypted checkout, PCI-aware card handling and UPI-first payments.",
            },
          ].map((v) => (
            <li key={v.title} className="flex gap-3 rounded-2xl border bg-background/60 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <v.icon size={16} />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{v.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{v.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ShoppingBag} title="What we sell">
        <p>
          Mobiles &amp; accessories, laptops &amp; tablets, audio, cameras,
          smart home devices, fashion, home &amp; kitchen essentials, plants
          &amp; gardening, grocery &amp; everyday staples, plus digital
          products like e-gift cards and software licenses. Every listing is
          quality-checked before it goes live.
        </p>
      </Section>

      <Section icon={Building2} title="Company details">
        <p>
          shop-891 Inc. · Registered office: 891 Startup Lane, HSR Layout,
          Bengaluru, Karnataka 560102, India.
        </p>
        <p>
          Support: <span className="font-semibold text-foreground">saikambala111@gmail.com</span> ·
          Phone: <span className="font-semibold text-foreground">8919301129</span> (Mon–Sat, 9am–9pm IST)
        </p>
      </Section>
    </div>
  );
}

// ── Topic: FAQ ────────────────────────────────────────────────

const FAQ_GROUPS: {
  group: string;
  icon: typeof ShoppingBag;
  items: { q: string; a: string }[];
}[] = [
  {
    group: "Orders & delivery",
    icon: Package,
    items: [
      {
        q: "How long does delivery take?",
        a: "Most orders are delivered in 2–5 business days depending on your pin code. Metro cities usually receive orders within 2–3 days. Digital products (e-gift cards, software licenses) are delivered instantly to your email and account page.",
      },
      {
        q: "How do I track my order?",
        a: "Open the Orders page from your profile or tap the bell icon in the top bar — every status change (processing, shipped, delivered) appears there as a notification. Each order also shows its tracking number once dispatched.",
      },
      {
        q: "What are the shipping charges?",
        a: "Delivery is free on orders above ₹499. Below that, a flat ₹49 shipping fee applies. Digital products never carry shipping fees.",
      },
      {
        q: "Can I change my delivery address after ordering?",
        a: "Yes — as long as the order hasn't shipped. Contact saikambala111@gmail.com or call 8919301129 with your order number and we'll update the address before dispatch.",
      },
      {
        q: "Can I cancel my order?",
        a: "Orders can be cancelled any time before they are dispatched — use the Cancel order button in My Orders. Once delivered, you can request a return instead: open the order and tap Return items, pick a reason, and we'll refund your original payment method once the return is approved.",
      },
    ],
  },
  {
    group: "Payments & coupons",
    icon: CreditCard,
    items: [
      {
        q: "Which payment methods do you accept?",
        a: "We accept UPI (Google Pay, PhonePe, Paytm, BHIM), credit and debit cards (Visa, Mastercard, RuPay, Amex), and popular wallets. All payments are processed over an encrypted connection.",
      },
      {
        q: "How do I apply a coupon code?",
        a: "Enter the code in the coupon field on the checkout page and press Apply. The discount is validated instantly — minimum order values and expiry dates are shown with each coupon in your account's coupon list.",
      },
      {
        q: "Why was my payment declined?",
        a: "Declines usually come from the bank or UPI app — insufficient balance, daily limits, or an expired card. Try another method; if the amount was debited but the order failed, it is auto-refunded within 5–7 business days.",
      },
      {
        q: "Is it safe to save my card?",
        a: "We never store raw card numbers. Payments run through PCI-DSS compliant gateways; we only keep a token that lets you re-pay without re-entering details.",
      },
    ],
  },
  {
    group: "Returns & refunds",
    icon: RotateCcw,
    items: [
      {
        q: "What is the return window?",
        a: "Most items can be returned within 7 days of delivery. Open My Orders, find the delivered order and tap Return items. The product should be unused and in its original packaging with accessories and manuals included.",
      },
      {
        q: "Which items are not returnable?",
        a: "Digital products (gift cards, software licenses), groceries, personal-care items and products marked 'non-returnable' on the product page cannot be returned once used or redeemed.",
      },
      {
        q: "How fast are refunds?",
        a: "Once the return is picked up and checked, refunds are initiated immediately — UPI refunds typically settle within 1–2 business days, card refunds within 5–7 business days, depending on your bank.",
      },
      {
        q: "What if my item arrives damaged?",
        a: "Report it within 48 hours with photos from the Orders page or support inbox. We arrange a free pickup and ship a replacement or issue a full refund — your choice.",
      },
    ],
  },
  {
    group: "Account & wishlist",
    icon: Users,
    items: [
      {
        q: "How do I create an account?",
        a: "Tap Sign in on the top bar and choose Create account — you just need a name, email and password. Your cart, wishlist and addresses stay in sync across every device you sign in on.",
      },
      {
        q: "What does the wishlist do?",
        a: "Tap the heart on any product to save it for later. Your wishlist is permanent and synced to your account — we show it in your profile so you can move items to the cart in one tap.",
      },
      {
        q: "I forgot my password. What now?",
        a: "Tap Sign in on the top bar, then use the 'Forgot password?' link on the sign-in page. Enter your account email, confirm the 6-digit code we generate, and set a fresh password — you can also contact support for help.",
      },
      {
        q: "How do I delete my account?",
        a: "Email privacy@shop-891.in from your registered address. We remove your personal data within 30 days, keeping only records required by tax law.",
      },
    ],
  },
];

function FaqContent() {
  return (
    <div className="space-y-6">
      {FAQ_GROUPS.map((g) => (
        <section key={g.group} className="rounded-3xl border bg-card p-5 shadow-card-3d sm:p-7">
          <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight sm:text-xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <g.icon size={18} />
            </span>
            {g.group}
          </h2>
          <Accordion type="single" collapsible className="mt-3">
            {g.items.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="text-sm font-bold text-foreground hover:no-underline sm:text-[15px]">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      <Section icon={Info} title="Still need help?">
        <p>
          Our support team answers within a few hours on business days. Email{" "}
          <span className="font-semibold text-foreground">saikambala111@gmail.com</span>, call{" "}
          <span className="font-semibold text-foreground">8919301129</span> (Mon–Sat, 9am–9pm IST),
          or open the bell menu and track any order live from the Orders page.
        </p>
      </Section>
    </div>
  );
}

// ── Topic: Privacy ────────────────────────────────────────────

function PrivacyContent() {
  return (
    <div className="space-y-6">
      <Section icon={Info} title="1. Overview">
        <p>
          This Privacy Policy explains how shop-891 Inc. ("we", "us") collects,
          uses, shares and protects your personal information when you browse,
          shop or interact with shop-891. By using the store you agree to the
          practices described here.
        </p>
      </Section>
      <Section icon={Users} title="2. Information we collect">
        <p>
          <span className="font-semibold text-foreground">Account data</span> — name, email address,
          phone number and password (stored only as a salted hash).
        </p>
        <p>
          <span className="font-semibold text-foreground">Order data</span> — items purchased,
          shipping addresses, order history and invoices.
        </p>
        <p>
          <span className="font-semibold text-foreground">Payment data</span> — we never store full
          card numbers; payments are tokenised by PCI-DSS compliant gateways.
        </p>
        <p>
          <span className="font-semibold text-foreground">Usage data</span> — pages viewed, searches
          and device/browser info used to improve store performance.
        </p>
      </Section>
      <Section icon={Globe2} title="3. How we use your information">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To create and secure your account and authenticate sign-ins.</li>
          <li>To process orders, payments, shipping, returns and refunds.</li>
          <li>To send transactional updates (order confirmations, shipping alerts) and — only with your consent — marketing emails such as deal alerts.</li>
          <li>To personalise recommendations and improve catalog relevance.</li>
          <li>To detect fraud, abuse and secure the platform.</li>
          <li>To meet legal, tax and accounting obligations.</li>
        </ul>
      </Section>
      <Section icon={Banknote} title="4. Sharing with third parties">
        <p>
          We share the minimum data necessary with: payment gateways and UPI
          PSPs (to process payments), logistics partners (name, address and
          phone for delivery), and cloud infrastructure providers that host
          the store. We never sell your personal data. Law-enforcement
          requests are honoured only where legally required.
        </p>
      </Section>
      <Section icon={ShieldCheck} title="5. Cookies & storage">
        <p>
          We use a single session cookie to keep you signed in, and local
          storage to remember your cart, wishlist, theme and notification
          state on your own device. You can clear these at any time from your
          browser settings; the store keeps working, just without your
          personalised state.
        </p>
      </Section>
      <Section icon={Sparkles} title="6. Data security">
        <p>
          All traffic runs over TLS. Passwords are hashed with bcrypt.
          Access to production data is limited, logged and reviewed. We
          retain order records for 8 years as required by Indian tax law, and
          marketing preferences until you unsubscribe.
        </p>
      </Section>
      <Section icon={Scale} title="7. Your rights">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Correct inaccurate profile details at any time from your Profile page.</li>
          <li>Request deletion of your account and personal data (subject to legal retention).</li>
          <li>Withdraw marketing consent at any time via the unsubscribe link in any email.</li>
        </ul>
      </Section>
      <Section icon={Info} title="8. Contact">
        <p>
          For any privacy question or request, write to{" "}
          <span className="font-semibold text-foreground">privacy@shop-891.in</span> or post to
          shop-891 Inc., 891 Startup Lane, HSR Layout, Bengaluru, Karnataka
          560102, India. We respond within 30 days.
        </p>
      </Section>
    </div>
  );
}

// ── Topic: Terms ──────────────────────────────────────────────

function TermsContent() {
  return (
    <div className="space-y-6">
      <Section icon={Info} title="1. Acceptance of terms">
        <p>
          These Terms of Service ("Terms") govern your access to and use of
          the shop-891 store, including browsing, account creation, ordering
          and use of digital products. By using the store you agree to be
          bound by these Terms and our Privacy Policy.
        </p>
      </Section>
      <Section icon={Users} title="2. Your account">
        <p>
          You must provide accurate registration details and keep your
          password confidential. You are responsible for activity under your
          account. Notify us immediately of any unauthorised access. We may
          suspend accounts engaged in fraud, abuse or resale in violation of
          these Terms.
        </p>
      </Section>
      <Section icon={ShoppingBag} title="3. Orders, pricing & availability">
        <p>
          Placing an order constitutes an offer to purchase. A contract forms
          when we confirm the order (by email or order-status update). Prices
          are in Indian Rupees (₹) and include applicable taxes unless stated
          otherwise. Listed availability, delivery estimates and compare-at
          prices are indicative; in the rare case of a pricing or stock
          error we may cancel the order with a full refund.
        </p>
      </Section>
      <Section icon={CreditCard} title="4. Payments">
        <p>
          We accept UPI, cards and wallets as shown at checkout. Your payment
          may be pre-authorised and captured at dispatch. If a payment fails
          after debit due to a technical error, the amount is auto-refunded
          by your bank within 5–7 business days.
        </p>
      </Section>
      <Section icon={Truck} title="5. Shipping & risk">
        <p>
          Orders ship to serviceable pin codes across India. Title and risk
          pass to you on delivery. Free shipping applies to orders above ₹499;
          otherwise a flat ₹49 fee applies. Estimated delivery windows are
          not guarantees but are accurate for the vast majority of orders.
        </p>
      </Section>
      <Section icon={RotateCcw} title="6. Returns & refunds">
        <p>
          Unless marked non-returnable, items may be returned within 7 days
          of delivery in unused, original condition. Approved refunds are
          issued to the original payment method — UPI within 1–2 business
          days, cards within 5–7 business days. Digital products are
          non-returnable once redeemed or revealed.
        </p>
      </Section>
      <Section icon={FileText} title="7. Digital products">
        <p>
          Digital products (e-gift cards, software licenses) are delivered
          electronically. License keys are shown once and must be stored
          safely; we cannot re-issue revealed keys. Gift cards are valid for
          12 months from purchase and are not redeemable for cash.
        </p>
      </Section>
      <Section icon={ShieldCheck} title="8. Warranties & liability">
        <p>
          Products carry manufacturer warranties where applicable; claims are
          facilitated by us but governed by the manufacturer's policy. To the
          maximum extent permitted by law, our aggregate liability for any
          claim relating to the store is limited to the amount you paid for
          the order giving rise to the claim. Nothing in these Terms limits
          liability that cannot be limited under Indian law.
        </p>
      </Section>
      <Section icon={Scale} title="9. Governing law & changes">
        <p>
          These Terms are governed by the laws of India, with exclusive
          jurisdiction of the courts of Bengaluru, Karnataka. We may update
          these Terms from time to time; the effective date at the top of
          this page always reflects the current version. Continued use of
          the store after changes constitutes acceptance.
        </p>
        <p>
          Questions? Write to{" "}
          <span className="font-semibold text-foreground">legal@shop-891.in</span>.
        </p>
      </Section>
    </div>
  );
}

// ── Topic: Shipping ─────────────────────────────────────

function ShippingContent() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard value="2–5 days" label="Standard delivery" />
        <StatCard value="19,000+" label="Pin codes served" />
        <StatCard value="₹499+" label="Orders ship free" />
        <StatCard value="Instant" label="Digital products" />
      </div>

      <Section icon={Clock} title="Delivery timelines">
        <p>
          Every physical order is dispatched within 24 hours of confirmation.
          Actual delivery time depends on your pin code:
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Metro cities",
              text: "Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata — 2–3 business days.",
            },
            {
              title: "Tier 2 & 3 towns",
              text: "Most state capitals and major towns — 3–5 business days.",
            },
            {
              title: "Remote & northeast regions",
              text: "Hilly, island and northeast pin codes — up to 7 business days.",
            },
            {
              title: "Digital products",
              text: "E-gift cards and software licenses — delivered instantly to your email and account page.",
            },
          ].map((r) => (
            <li key={r.title} className="flex gap-3 rounded-2xl border bg-background/60 p-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Truck size={14} />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{r.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={BadgeIndianRupee} title="Shipping charges">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-foreground">Free delivery</span> on every order of
            ₹499 or more — after coupons, before shipping.
          </li>
          <li>
            Orders below ₹499 carry a flat{" "}
            <span className="font-semibold text-foreground">₹49</span> shipping fee, anywhere in
            India.
          </li>
          <li>
            <span className="font-semibold text-foreground">Digital products never carry
            shipping fees</span> — gift cards and licenses are delivered electronically.
          </li>
          <li>Cash on Delivery (COD) is available on eligible pin codes for orders up to ₹50,000.</li>
        </ul>
      </Section>

      <Section icon={PackageCheck} title="Track every order">
        <p>
          Every parcel is trackable end-to-end. Once your order ships, a tracking
          number appears on the order card in <span className="font-semibold text-foreground">My
          Orders</span>, and each status change — processing, shipped, out for
          delivery, delivered — lands in your notifications bell as well.
        </p>
        <p>
          You can check live status any time from the Orders page in your
          profile, or from the bell icon in the top bar.
        </p>
      </Section>

      <Section icon={MapPin} title="Where we deliver">
        <p>
          shop-891 currently delivers to <span className="font-semibold text-foreground">19,000+
          pin codes</span> across all 28 states and 8 union territories. Enter your
          pin code at checkout — we confirm serviceability instantly before you
          pay. If a pin code isn&apos;t serviceable yet, digital products are
          still available nationwide.
        </p>
      </Section>

      <Section icon={Info} title="Address changes & delivery issues">
        <p>
          Need to correct the delivery address? As long as the order hasn&apos;t
          shipped, contact us with your order number and we&apos;ll update it
          before dispatch.
        </p>
        <p>
          Missed a delivery? Our courier partners attempt delivery up to three
          times, and you can reschedule directly from the tracking link. For
          anything else, write to{" "}
          <span className="font-semibold text-foreground">saikambala111@gmail.com</span> or call{" "}
          <span className="font-semibold text-foreground">8919301129</span> (Mon–Sat, 9am–9pm
          IST).
        </p>
      </Section>
    </div>
  );
}

// ── Topic: Returns ───────────────────────────────────────

function ReturnsContent() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard value="7 days" label="Easy return window" />
        <StatCard value="Free" label="Pickup & drop-off" />
        <StatCard value="1–2 days" label="UPI refunds" />
        <StatCard value="5–7 days" label="Card refunds" />
      </div>

      <Section icon={RotateCcw} title="How returns work">
        <ol className="space-y-3">
          {[
            {
              title: "Open My Orders",
              text: "Find the delivered order and tap “Return items” — available for 7 days after delivery.",
            },
            {
              title: "Pick a reason",
              text: "Choose why you're returning (damaged, wrong item, not as described, or changed your mind) and add an optional comment.",
            },
            {
              title: "We arrange pickup",
              text: "Our courier partner collects the item from your address — usually within 2–3 business days. Pickup is free.",
            },
            {
              title: "Refund released",
              text: "Once the item passes the quick quality check, your refund is released to the original payment method and you get a notification.",
            },
          ].map((s, i) => (
            <li key={s.title} className="flex gap-3.5 rounded-2xl border bg-background/60 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-extrabold text-primary-foreground shadow-md">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section icon={CheckCircle2} title="What can be returned">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Most items within 7 days of delivery — mobiles, electronics, fashion, home &amp; kitchen, plants, sports and more.</li>
          <li>The product should be unused and in original condition, with all accessories, freebies, manuals and packaging included.</li>
          <li>Exchange available for size/colour issues on fashion items where stock permits.</li>
        </ul>
      </Section>

      <Section icon={Undo2} title="Items that can’t be returned">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Digital products — e-gift cards and software licenses — once the code is revealed or redeemed.</li>
          <li>Groceries, personal-care items and innerwear, once used or opened.</li>
          <li>Products explicitly marked “non-returnable” on the product page.</li>
        </ul>
      </Section>

      <Section icon={CreditCard} title="Refund timelines">
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Smartphone, title: "UPI & wallets", text: "1–2 business days after the return is approved." },
            { icon: CreditCard, title: "Credit / debit cards", text: "5–7 business days, depending on your bank." },
            { icon: Banknote, title: "Cash on Delivery", text: "Refunded to your bank account within 2–4 business days — UPI ID or IFSC details are collected at approval." },
          ].map((r) => (
            <li key={r.title} className="rounded-2xl border bg-background/60 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <r.icon size={16} />
              </span>
              <p className="mt-2.5 text-sm font-bold text-foreground">{r.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ShieldCheck} title="Damaged, defective or wrong item?">
        <p>
          If your order arrives damaged, defective or isn&apos;t what you ordered,
          report it within 48 hours of delivery — with photos if possible — from
          the order page or by writing to us. We arrange a{" "}
          <span className="font-semibold text-foreground">free pickup</span> and
          send a replacement or issue a full refund, whichever you prefer. In
          such cases the return window is extended to 10 days.
        </p>
      </Section>

      <Section icon={Package} title="Checking your return status">
        <p>
          Track every return request from <span className="font-semibold text-foreground">My
          Orders</span> — the order card shows the live return status (requested,
          approved or declined) and the refund amount. You&apos;ll also receive a
          bell notification the moment your request is resolved and when the
          refund is on its way.
        </p>
      </Section>

      <Section icon={HeartHandshake} title="Need help with a return?">
        <p>
          Our support team can start a return, update a pickup or chase a refund
          for you. Email{" "}
          <span className="font-semibold text-foreground">saikambala111@gmail.com</span> or call{" "}
          <span className="font-semibold text-foreground">8919301129</span> (Mon–Sat, 9am–9pm
          IST) with your order number handy.
        </p>
      </Section>
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────

export function InfoView({ topic }: { topic: InfoTopic }) {
  const navigate = useAppStore((s) => s.navigate);
  const meta = TOPIC_META[topic];
  const Icon = meta.icon;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* breadcrumb + back */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft size={13} /> Home
        </button>
        <ChevronRight size={13} aria-hidden />
        <span className="font-semibold text-foreground/80">{meta.kicker}</span>
      </nav>

      {/* hero */}
      <header className="mt-4">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-primary p-[1.5px] shadow-md">
          <span className="flex items-center gap-2.5 rounded-[calc(1rem-1px)] bg-card px-4 py-2.5">
            <Icon size={22} className="text-primary" />
            <span className="font-display text-lg font-bold tracking-wide text-foreground">
              shop<span className="text-primary">-891</span>
            </span>
          </span>
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{meta.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{meta.updated}</p>
        <Separator className="mt-5" />
      </header>

      {/* topic body */}
      <div className="mt-6">
        {topic === "about" && <AboutContent />}
        {topic === "faq" && <FaqContent />}
        {topic === "privacy" && <PrivacyContent />}
        {topic === "terms" && <TermsContent />}
        {topic === "shipping" && <ShippingContent />}
        {topic === "returns" && <ReturnsContent />}
      </div>

      {/* cross-links */}
      <footer className="mt-10">
        <Separator className="mb-6" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          More from shop-891
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_TOPICS.filter((t) => t !== topic).map((t) => {
            const m = TOPIC_META[t];
            const MIcon = m.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => navigate({ name: "info", topic: t })}
                className={cn(
                  "flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                  "hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95"
                )}
              >
                <MIcon size={15} className="text-primary/70" />
                {m.title}
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex flex-col gap-3 rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-card-3d sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-extrabold tracking-tight">Ready to shop?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              90+ product lines with free delivery over ₹499.
            </p>
          </div>
          <Button
            onClick={() => navigate({ name: "catalog" })}
            className="shine-host h-11 shrink-0 rounded-xl bg-gradient-primary font-bold shadow-md hover:brightness-110"
          >
            Browse all products <ArrowRight size={16} />
          </Button>
        </div>
      </footer>
    </div>
  );
}
