// ──────────────────────────────────────────────────────────────
// ShopVerse — MongoDB seed script (Mongoose)
// Run: bun run seed
//   (or: bun scripts/seed.ts / npx tsx scripts/seed.ts)
//
// Plants & Home Essentials store (Indian market, INR pricing).
// Seeds 1 admin + 6 customers + 12 reviewers, 36 products,
// reviews with aggregates, and 18 orders across all statuses.
// Idempotent: wipes the ShopVerse collections first.
// ──────────────────────────────────────────────────────────────
import { readFileSync } from "fs";
import { join } from "path";
import { hashSync } from "bcryptjs";
import {
  CartItem,
  Coupon,
  Notification,
  Order,
  Product,
  Review,
  Upload,
  User,
  WishlistItem,
  connectDB,
} from "../src/lib/db";
import { SEED_PRODUCTS } from "../src/lib/seed-products";
import { SEED_PRODUCTS_EXTRA } from "../src/lib/seed-products-new";

// Deterministic PRNG so the seed is reproducible
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20250615);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;

const seedImages: Record<string, string[]> = JSON.parse(
  readFileSync(join(process.cwd(), "src", "lib", "seed-images.json"), "utf-8")
);

// ── Users ─────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: "Aarav Sharma", email: "aarav@example.com" },
  { name: "Priya Nair", email: "priya@example.com" },
  { name: "Rohan Verma", email: "rohan@example.com" },
  { name: "Sneha Iyer", email: "sneha@example.com" },
  { name: "Vikram Singh", email: "vikram@example.com" },
  { name: "Meera Krishnan", email: "meera@example.com" },
];

const REVIEWER_NAMES = [
  "Ananya Reddy", "Kabir Malhotra", "Ishita Bose", "Arjun Pillai",
  "Divya Menon", "Rahul Joshi", "Kavya Rao", "Aditya Kulkarni",
  "Ritu Chauhan", "Sameer Khan", "Nandini Das", "Farhan Ali",
];

const ADDRESSES = [
  { street: "402, Sunrise Heights, Linking Road, Bandra West", city: "Mumbai", state: "Maharashtra", zip: "400050", country: "India" },
  { street: "No. 27, 3rd Cross, 12th Main, Indiranagar", city: "Bengaluru", state: "Karnataka", zip: "560038", country: "India" },
  { street: "B-18, 2nd Floor, Greater Kailash-II", city: "New Delhi", state: "Delhi", zip: "110048", country: "India" },
  { street: "1103, A-Wing, Sai Residency, Baner Road", city: "Pune", state: "Maharashtra", zip: "411045", country: "India" },
  { street: "8-2-120/73, Road No. 12, Banjara Hills", city: "Hyderabad", state: "Telangana", zip: "500034", country: "India" },
  { street: "Villa 7, Palm Grove, Panampilly Nagar", city: "Kochi", state: "Kerala", zip: "682036", country: "India" },
  { street: "21, Civil Lines, C-Scheme", city: "Jaipur", state: "Rajasthan", zip: "302006", country: "India" },
  { street: "B-404, Sunrise Apartments, Satellite", city: "Ahmedabad", state: "Gujarat", zip: "380015", country: "India" },
];

const phone = () =>
  `+91 ${pick(["97", "98", "99", "90", "91", "89"])}${randInt(100000, 999999)}${pick([
    "21", "34", "45", "67", "80", "12",
  ])}`;

// ── Review text pools ─────────────────────────────────────────

const RATING_5 = [
  "Ordered on Monday and it reached me by Thursday — packaging was so solid that nothing could get damaged in transit. Very happy with the quality.",
  "Exactly as shown in the pictures. My family loved it and delivery to my Pincode took only three days. Great value for money.",
  "Packed very carefully with bubble wrap and everything intact. Been using it daily for two weeks now and no complaints at all.",
  "Bought it during the sale but honestly it's worth even the MRP. Quality feels premium, much better than what local shops offer.",
  "Superb product for the price. The finishing is neat and it looks classy in my home. Will definitely order from ShopVerse again.",
  "Plants arrived healthy and fresh, not a single broken leaf. The care instructions card inside was a nice touch.",
];
const RATING_4 = [
  "Product is good and delivery was quick. One star less because the outer box was slightly dented, though the item inside was perfectly fine.",
  "Happy with the purchase. Took one star off only because delivery to my area took a day extra. Product itself is solid and as described.",
  "Does the job well. Finish could be slightly better, but at this price I am not complaining. Would recommend.",
  "Nice product, sturdy packaging. Wish there were more colour options, otherwise no complaints from my side.",
  "Good quality and arrived on time. Slightly smaller than I expected from the photos, but works fine for my space.",
];
const RATING_3 = [
  "Decent, but nothing extraordinary. Fine if you're getting it in a sale like I did.",
  "It's okay for the price. Works as described, though I expected slightly better finishing.",
  "Average. Does the basic job, but the photos look fancier than the real thing.",
];
const RATING_2 = [
  "Arrived late and the packaging was torn at one corner. Item works, but the whole experience was disappointing.",
  "Not worth it for me. Quality didn't match the listing photos. Return process was smooth though.",
];

const SPECIFIC_REVIEWS: Record<
  string,
  { name: string; rating: number; title: string; comment: string }[]
> = {
  "monstera-deliciosa-plant": [
    { name: "Ananya Reddy", rating: 5, title: "Worth every rupee", comment: "The monstera arrived in perfect condition with 7 healthy leaves, packed in moulded cardboard with the pot taped so the soil wouldn't spill. Two new leaves have unfurled in the three weeks since. Thriving in my Mumbai flat's indirect light." },
    { name: "Kabir Malhotra", rating: 4, title: "Beautiful plant, slightly small", comment: "Plant is healthy and well-rooted with no yellow leaves. Slightly smaller than I expected at this price, but a new fenestrated leaf is on the way, so it should fill out soon." },
  ],
  "snake-plant-sansevieria": [
    { name: "Ishita Bose", rating: 5, title: "Impossible to kill", comment: "I have killed every plant I've ever owned, including cacti. This snake plant has survived three weeks of my neglect and Kolkata humidity without a single droopy leaf. Firm, upright and gorgeous." },
    { name: "Arjun Pillai", rating: 5, title: "Perfect for the bedroom", comment: "Bought it specifically for the night-time oxygen. Arrived with 6-7 strong leaves and zero damage. Ordering two more for my parents' room now." },
  ],
  "triply-steel-cookware-5": [
    { name: "Divya Menon", rating: 5, title: "Restaurant-grade quality", comment: "Heats so evenly across the kadhai that the masala never burns at the centre anymore. Made biryani for 8 people and the 26 cm kadhai handled it comfortably. Worth every rupee over regular steel." },
    { name: "Rahul Joshi", rating: 4, title: "Excellent, but heavy", comment: "Cooking performance is superb and haldi stains wipe right off. Just note that it's genuinely heavy triply — my mother finds the large kadhai a bit hard to handle with one hand." },
  ],
  "nonstick-dosa-tawa-30": [
    { name: "Ritu Chauhan", rating: 5, title: "Perfect dosas from day one", comment: "The very first dosa came off whole without a drop of extra oil — I was shocked. The base is thick and spreads heat evenly, so no raw patches. My kids finally finish their breakfast without fuss." },
    { name: "Sameer Khan", rating: 4, title: "Great tawa, go easy on flame", comment: "Crisp dosas and effortless cleanup. One heads-up: keep the flame on medium — I ran it on high once and the coating hasn't been as slick since. My fault, not the tawa's." },
  ],
  "himalayan-salt-lamp": [
    { name: "Kavya Rao", rating: 5, title: "So calming in the evenings", comment: "The amber glow is beautiful and the dimmer is genuinely useful — full brightness for reading, lowest as a night lamp. Even came with a spare bulb, which was thoughtful." },
    { name: "Aditya Kulkarni", rating: 4, title: "Lovely glow, sweats in monsoon", comment: "Beautiful lamp with solid build and a smooth dimmer. Heads-up for coastal folks: it 'sweats' in high humidity, so keep a coaster under it during monsoon months." },
  ],
  "cotton-bedsheet-queen-300tc": [
    { name: "Nandini Das", rating: 5, title: "Slept like a baby", comment: "The cotton is genuinely breathable — a big difference from the polycotton sheets I had before. Five washes so far with zero colour fading, and it fits my 8-inch mattress with room to spare." },
    { name: "Farhan Ali", rating: 4, title: "Good quality, slight shrinkage", comment: "Fabric quality is excellent for the price and the print looks premium. Shrank maybe half an inch after the first hot wash, so wash it cold. Still very happy overall." },
  ],
};

async function main() {
  console.log("Connecting to MongoDB...");
  await connectDB();

  console.log("Wiping existing data...");
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    CartItem.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    WishlistItem.deleteMany({}),
    Upload.deleteMany({}),
    Coupon.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // ── Users ──
  console.log("Seeding users...");
  const password = hashSync("Password123!", 10);
  const adminPass = hashSync("Admin123!", 10);

  const admin = await User.create({
    name: "Aarav Mehta",
    email: "admin@shopverse.com",
    passwordHash: adminPass,
    role: "ADMIN",
    phone: phone(),
  });

  const customers: any[] = [];
  for (const c of CUSTOMERS) {
    const u = await User.create({
      name: c.name,
      email: c.email,
      passwordHash: password,
      role: "USER",
      phone: phone(),
    });
    customers.push(u);
  }

  const reviewers: any[] = [];
  for (const name of REVIEWER_NAMES) {
    const u = await User.create({
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      passwordHash: password,
      role: "USER",
      phone: phone(),
    });
    reviewers.push(u);
  }
  const allReviewers = [...customers, ...reviewers];

  // ── Products ──
  console.log("Seeding products...");
  const products: any[] = [];
  const extraSlugs = new Set(SEED_PRODUCTS_EXTRA.map((p) => p.slug));
  for (const p of [...SEED_PRODUCTS, ...SEED_PRODUCTS_EXTRA]) {
    const images = seedImages[p.slug] ?? [];
    const created = await Product.create({
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      brand: p.brand,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
      images,
      highlights: p.highlights,
      specs: p.specs,
      tags: p.tags,
      stock: p.stock,
      isDigital: false,
      isActive: true,
      // new-catalog items land recently so they show in "Just launched"
      createdAt: new Date(
        Date.now() -
        (extraSlugs.has(p.slug) ? randInt(1, 16) : randInt(10, 220)) * 24 * 3600 * 1000
      ),
    });
    products.push({ ...created.toObject() });
  }
  console.log(`Created ${products.length} products`);

  // ── Reviews ──
  console.log("Seeding reviews...");
  let reviewCount = 0;
  for (const p of products) {
    const specific = SPECIFIC_REVIEWS[p.slug] ?? [];
    const extraCount = specific.length > 0 ? randInt(2, 6 - specific.length) : randInt(2, 6);
    const usedUserIds = new Set<string>();

    for (const s of specific) {
      let reviewer =
        allReviewers.find((r) => r.name === s.name) ?? pick(allReviewers);
      if (usedUserIds.has(String(reviewer._id))) {
        reviewer = allReviewers.find((r) => !usedUserIds.has(String(r._id)))!;
      }
      usedUserIds.add(String(reviewer._id));
      await Review.create({
        product: p._id,
        user: reviewer._id,
        rating: s.rating,
        title: s.title,
        comment: s.comment,
        createdAt: new Date(Date.now() - randInt(3, 60) * 24 * 3600 * 1000),
      });
      reviewCount++;
    }

    for (let i = 0; i < extraCount; i++) {
      const pool = allReviewers.filter((r) => !usedUserIds.has(String(r._id)));
      if (pool.length === 0) break;
      const reviewer = pick(pool);
      usedUserIds.add(String(reviewer._id));
      const roll = rand();
      const rating = roll < 0.55 ? 5 : roll < 0.85 ? 4 : roll < 0.95 ? 3 : 2;
      const comment =
        rating === 5
          ? pick(RATING_5)
          : rating === 4
            ? pick(RATING_4)
            : rating === 3
              ? pick(RATING_3)
              : pick(RATING_2);
      await Review.create({
        product: p._id,
        user: reviewer._id,
        rating,
        comment,
        createdAt: new Date(Date.now() - randInt(1, 90) * 24 * 3600 * 1000),
      });
      reviewCount++;
    }

    // recompute aggregates
    const agg = await Review.aggregate<{ _id: null; avg: number; count: number }>([
      { $match: { product: p._id } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await Product.updateOne(
      { _id: p._id },
      {
        $set: {
          rating: Math.round((agg[0]?.avg ?? 0) * 10) / 10,
          reviewCount: agg[0]?.count ?? 0,
        },
      }
    );
  }
  console.log(`Created ${reviewCount} reviews`);

  // ── Homepage placements (admin-curated rails) ──
  console.log("Assigning homepage placements...");
  {
    const all = await Product.find({}).lean() as any[];
    const discountPct = (p: any) =>
      p.compareAtPrice && p.compareAtPrice > p.price
        ? (p.compareAtPrice - p.price) / p.compareAtPrice
        : 0;

    const byDiscount = [...all].sort((a, b) => discountPct(b) - discountPct(a));
    const byNew = [...all].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const byRating = [...all].sort(
      (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount
    );

    const ids = (list: any[]) => new Set(list.map((p) => String(p._id)));
    const dealOfDay = ids(byDiscount.slice(0, 10));
    const discountOffer = ids(byDiscount.slice(10, 22));
    const newlyArrived = ids(byNew.slice(0, 10));
    const justLaunched = ids(byNew.slice(10, 18));
    const topRated = ids(byRating.filter((p) => p.rating >= 4.2).slice(0, 10));

    for (const p of all) {
      const id = String(p._id);
      const placements: string[] = [];
      if (dealOfDay.has(id)) placements.push("deal-of-day");
      if (discountOffer.has(id)) placements.push("discount-offer");
      if (newlyArrived.has(id)) placements.push("newly-arrived");
      if (justLaunched.has(id)) placements.push("just-launched");
      if (topRated.has(id)) placements.push("top-rated");
      await Product.updateOne({ _id: p._id }, { $set: { placements } });
    }
    console.log(
      `Placements: deals=${dealOfDay.size}, offers=${discountOffer.size}, newly-arrived=${newlyArrived.size}, just-launched=${justLaunched.size}, top-rated=${topRated.size}`
    );
  }

  // ── Coupons (admin-managed offers) ──
  console.log("Seeding coupons...");
  const in90Days = new Date(Date.now() + 90 * 24 * 3600 * 1000);
  const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const coupons = [
    {
      code: "WELCOME10",
      description: "10% off your first order",
      type: "PERCENT",
      value: 10,
      minOrderAmount: 499,
      maxDiscountAmount: 300,
      expiresAt: in90Days,
      isActive: true,
      // Redeemable once per customer — only on their first order.
      firstOrderOnly: true,
    },
    {
      code: "SAVE150",
      description: "Flat ₹150 off orders above ₹1,299",
      type: "FIXED",
      value: 150,
      minOrderAmount: 1299,
      maxDiscountAmount: null,
      expiresAt: in30Days,
      isActive: true,
    },
    {
      code: "GORILLA25",
      description: "25% off — launch week special (max ₹500)",
      type: "PERCENT",
      value: 25,
      minOrderAmount: 999,
      maxDiscountAmount: 500,
      expiresAt: in30Days,
      isActive: true,
    },
    {
      code: "FESTIVE5",
      description: "5% off everything, no minimum",
      type: "PERCENT",
      value: 5,
      minOrderAmount: 0,
      maxDiscountAmount: 100,
      expiresAt: null,
      isActive: true,
    },
  ];
  for (const c of coupons) {
    await Coupon.create({ ...c, usageCount: 0 });
  }
  console.log(`Created ${coupons.length} coupons`);

  // ── Orders ──
  console.log("Seeding orders...");
  const shippedTracking = () => `SVTRK${randInt(1000000000, 9999999999)}`;
  const ALNUM = "ABCDEFGHJKMNPQRSTUVWXYZ0123456789";
  const randCode = (len: number) =>
    Array.from({ length: len }, () => ALNUM[randInt(0, ALNUM.length - 1)]).join("");
  const orderNum = (d: Date) =>
    `SV-${d.toISOString().slice(0, 10).replace(/-/g, "")}-${randCode(4)}`;

  interface OrderPlan {
    customerIdx: number;
    productSlugs: string[];
    status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
    daysAgo: number;
    payment: "CARD" | "UPI";
    addressIdx?: number;
  }

  const orderPlans: OrderPlan[] = [
    { customerIdx: 0, productSlugs: ["monstera-deliciosa-plant", "ceramic-planter-set-3"], status: "DELIVERED", daysAgo: 24, payment: "UPI" },
    { customerIdx: 1, productSlugs: ["triply-steel-cookware-5"], status: "DELIVERED", daysAgo: 21, payment: "CARD" },
    { customerIdx: 2, productSlugs: ["snake-plant-sansevieria", "terracotta-pot-set-6"], status: "DELIVERED", daysAgo: 19, payment: "CARD" },
    { customerIdx: 3, productSlugs: ["cotton-bedsheet-queen-300tc"], status: "DELIVERED", daysAgo: 17, payment: "UPI" },
    { customerIdx: 4, productSlugs: ["nonstick-dosa-tawa-30", "natural-dishwash-refill-2"], status: "DELIVERED", daysAgo: 15, payment: "CARD" },
    { customerIdx: 5, productSlugs: ["himalayan-salt-lamp", "ceramic-bud-vase-trio"], status: "DELIVERED", daysAgo: 13, payment: "UPI" },
    { customerIdx: 0, productSlugs: ["golden-pothos-money-plant", "peace-lily-spathiphyllum"], status: "DELIVERED", daysAgo: 11, payment: "UPI" },
    { customerIdx: 0, productSlugs: ["areca-palm-dypsis", "cocopeat-potting-mix-5kg", "self-watering-planter-xl"], status: "SHIPPED", daysAgo: 8, payment: "CARD" },
    { customerIdx: 1, productSlugs: ["spin-mop-360-system", "microfiber-cleaning-cloth-12"], status: "SHIPPED", daysAgo: 7, payment: "UPI" },
    { customerIdx: 2, productSlugs: ["brass-diya-set-6"], status: "SHIPPED", daysAgo: 7, payment: "CARD", addressIdx: 6 },
    { customerIdx: 3, productSlugs: ["vegetable-seeds-kit-12", "garden-tool-set-5", "hybrid-rose-plant-pack-2"], status: "SHIPPED", daysAgo: 6, payment: "UPI" },
    { customerIdx: 4, productSlugs: ["memory-foam-pillow-2"], status: "SHIPPED", daysAgo: 5, payment: "CARD" },
    { customerIdx: 1, productSlugs: ["ceramic-dinner-set-24"], status: "PROCESSING", daysAgo: 4, payment: "CARD" },
    { customerIdx: 2, productSlugs: ["jade-plant-crassula", "hanging-macrame-planters-2"], status: "PROCESSING", daysAgo: 3, payment: "UPI" },
    { customerIdx: 3, productSlugs: ["marigold-genda-flower-seeds"], status: "PENDING", daysAgo: 2, payment: "UPI", addressIdx: 7 },
    { customerIdx: 4, productSlugs: ["microfiber-comforter-queen", "under-bed-storage-bags-2"], status: "PENDING", daysAgo: 1, payment: "UPI" },
    { customerIdx: 0, productSlugs: ["shoe-rack-5-tier"], status: "CANCELLED", daysAgo: 6, payment: "CARD" },
    { customerIdx: 3, productSlugs: ["insulated-casserole-set-3"], status: "CANCELLED", daysAgo: 4, payment: "CARD" },
  ];

  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  // ── Notifications ──
  // One "placed" + one status event per order, plus a welcome
  // message per account. Items older than 7 days arrive pre-read so
  // the badge reflects only recent activity.
  console.log("Seeding notifications...");
  const STATUS_EVENT: Record<string, { kind: string; title: string; body: (n: string) => string }> = {
    PROCESSING: { kind: "processing", title: "Order processing", body: (n) => `We're preparing ${n} for dispatch` },
    SHIPPED: { kind: "shipped", title: "Order shipped", body: (n) => `${n} is on its way` },
    DELIVERED: { kind: "delivered", title: "Order delivered", body: (n) => `${n} was delivered — enjoy!` },
    CANCELLED: { kind: "cancelled", title: "Order cancelled", body: (n) => `${n} was cancelled & refunded` },
  };
  const notifDocs: any[] = [];
  const HOUR = 3600 * 1000;

  const welcomeFor = (u: any, daysAgo: number) => ({
    user: u._id,
    kind: "welcome",
    title: `Welcome to shop-891, ${u.name.split(" ")[0]}!`,
    body: "Your account is ready — browse deals, save wishlists and track orders in one place.",
    amount: null,
    orderNumber: null,
    read: daysAgo > 7,
    createdAt: new Date(Date.now() - daysAgo * 24 * HOUR),
  });
  notifDocs.push(welcomeFor(admin, 30));
  for (const c of customers) notifDocs.push(welcomeFor(c, 30));

  for (const plan of orderPlans) {
    const customer = customers[plan.customerIdx];
    const addr = ADDRESSES[plan.addressIdx ?? plan.customerIdx];
    const created = new Date(
      Date.now() - plan.daysAgo * 24 * 3600 * 1000 - randInt(0, 20) * 3600 * 1000
    );

    const items = plan.productSlugs.map((slug) => {
      const p = productBySlug.get(slug)!;
      const qty = rand() < 0.75 ? 1 : 2;
      return {
        product: p._id,
        name: p.name,
        image: (p.images as string[])[0] ?? "",
        price: p.price,
        quantity: qty,
        isDigital: false,
        licenseKey: null,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingFee = subtotal >= 499 ? 0 : 49;
    const tax = 0; // GST removed — prices are final
    const total = Math.round((subtotal + shippingFee + tax) * 100) / 100;

    const orderNumber = orderNum(created);
    const cancelled = plan.status === "CANCELLED";
    const paymentStatus = cancelled ? "REFUNDED" : "PAID";

    await Order.create({
      orderNumber,
      user: customer._id,
      status: plan.status,
      paymentMethod: plan.payment,
      paymentStatus,
      subtotal,
      shippingFee,
      tax,
      total,
      shippingName: customer.name,
      shippingPhone: customer.phone,
      addressLine: addr.street,
      city: addr.city,
      state: addr.state,
      zipCode: addr.zip,
      country: addr.country,
      trackingNumber:
        plan.status === "SHIPPED" || plan.status === "DELIVERED"
          ? shippedTracking()
          : null,
      createdAt: created,
      items,
    });

    // notifications for this order
    notifDocs.push({
      user: customer._id,
      kind: "placed",
      title: "Order placed",
      body: `Order ${orderNumber} is confirmed`,
      amount: total,
      orderNumber,
      read: plan.daysAgo > 7,
      createdAt: created,
    });
    const ev = STATUS_EVENT[plan.status];
    if (ev) {
      notifDocs.push({
        user: customer._id,
        kind: ev.kind,
        title: ev.title,
        body: ev.body(orderNumber),
        amount: total,
        orderNumber,
        read: plan.daysAgo > 7,
        createdAt: new Date(created.getTime() + Math.min(plan.daysAgo, 2) * 12 * HOUR),
      });
    }

    // stock + sold count only for non-cancelled orders
    if (!cancelled) {
      for (const i of items) {
        await Product.updateOne({ _id: i.product }, { $inc: { stock: -i.quantity } });
        await Product.updateOne({ _id: i.product }, { $inc: { soldCount: i.quantity } });
      }
    }
  }
  console.log(`Created ${orderPlans.length} orders`);

  if (notifDocs.length > 0) {
    await Notification.insertMany(notifDocs);
    console.log(`Created ${notifDocs.length} notifications`);
  }

  const userCount = await User.countDocuments();
  const productCount = await Product.countDocuments();
  const orderCount = await Order.countDocuments();
  console.log(
    `Done. Users: ${userCount}, Products: ${productCount}, Orders: ${orderCount}`
  );
  console.log("Demo accounts:");
  console.log("  Admin:    admin@shopverse.com / Admin123!");
  console.log("  Customer: aarav@example.com / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    import("mongoose").then((m) => m.default.disconnect());
  });
