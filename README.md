# ShopVerse — Your Everything Store

A full-stack, production-ready **online marketplace** (inspired by Amazon/Flipkart) spanning **26 departments — mobiles & tablets, electronics & TV, laptops, men's & women's fashion, footwear & bags, watches & jewellery, beauty, health & wellness, home & kitchen, home decor, storage, bedding & bath, cleaning, indoor plants, outdoor & garden, planters, grocery & gourmet, books, toys & games, baby & kids, sports & fitness, pet supplies, stationery & office, tools & DIY, and musical instruments**. Modern **3D + glassmorphism UI**, **Indian Rupees (₹) pricing**, and a **single-Admin catalog** — customers shop, the Admin manages every product. Built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui** on the frontend and **REST API routes backed by MongoDB (Mongoose)** on the backend. Deploys seamlessly to **Vercel + MongoDB Atlas**.

## Features

### Storefront (customers)
- **3D animated homepage**: parallax hero with floating product cards, orbit decoration, glass badges, department strip (26 departments), deals of the day with countdown, **Just launched rail (new products appear instantly)**, top-rated grid, brand strip
- Real-time search, full catalog with filters (category, brand, price range, rating, in-stock, deals) and sorting
- Product pages: image gallery, highlights, specs, stock status, delivery info (free delivery ₹499+, COD, 7-day returns), reviews with rating distribution, related products
- **3D tilt product cards** with glare effect and shine-sweep CTAs
- Guest cart (localStorage) that **merges into the MongoDB cart on login**
- Multi-step checkout: shipping address → payment method (Card / UPI / COD) → review → place order
- Order history with status timeline (Pending → Processing → Shipped → Delivered / Cancelled), customer cancellation with automatic restock & refund status
- Wishlist, profile settings, password change, dark mode, fully responsive (mobile-first)
- **Indian Rupees everywhere**: ₹ formatting (en-IN), 18% GST, ₹49 flat shipping (free over ₹499), COD/UPI/Card payments, Indian address forms

### Admin console (single store owner)
- Analytics: revenue, active orders, product count, customer count, low-stock alerts, 14-day revenue chart, revenue by category, top products, recent orders
- **Product CRUD** — the Admin adds and manages every product across all 26 departments with multi-image upload (stored in MongoDB — works on serverless), image by URL, specs/highlights/tags; newly added products instantly surface on the home page's "Just launched" rail with a NEW badge
- Order management: status updates with automatic tracking numbers, shipment confirmation
- User management: search, role changes (Customer ↔ Admin) with confirm-on-admin-escalation

### Security & architecture
- JWT (HS256, `jose`) sessions in **HTTP-only cookies**, bcrypt password hashing
- Role-based access control (USER / ADMIN) enforced on every API route — registration always creates customers; client-supplied roles are never trusted
- Server-side price computation (₹), atomic stock decrements with rollback (works on **any** MongoDB deployment including Atlas M0 free tier)
- Cascading deletes (product → cart/wishlist/review cleanup, order item snapshots preserved)
- Single cached Mongoose connection — serverless safe

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui, lucide-react, framer-motion |
| Database | **MongoDB** with Mongoose 9 |
| Auth | JWT (`jose`) + HTTP-only cookies, `bcryptjs` |
| State | Zustand |
| Charts | Recharts |

## Project structure

```
├── src/
│   ├── app/
│   │   ├── api/                # REST API (serverless functions)
│   │   │   ├── auth/           # register, login, logout, me, password
│   │   │   ├── products/       # list/create, [id] update/delete, brands
│   │   │   ├── cart/           # get/add/update/remove + guest merge
│   │   │   ├── orders/         # checkout, my orders, [id] get/cancel/status
│   │   │   ├── reviews/        # list/create (one per user per product)
│   │   │   ├── wishlist/       # list/toggle
│   │   │   ├── upload/         # image upload → MongoDB (admin)
│   │   │   ├── uploads/[id]/   # serve images from MongoDB
│   │   │   └── admin/          # stats, users, role management
│   │   ├── layout.tsx          # root layout + metadata
│   │   ├── globals.css         # theme tokens + 3D/glass utilities
│   │   └── page.tsx            # SPA entry (single-route app)
│   ├── components/
│   │   ├── shared/             # navbar, footer, 3D product card, auth dialog
│   │   ├── views/              # home, catalog, product, cart, checkout,
│   │   │                       # orders, wishlist, profile
│   │   └── admin/              # admin console tabs + product form
│   └── lib/
│       ├── db.ts               # Mongoose connection + all models
│       ├── auth.ts             # JWT, bcrypt, cookie helpers
│       ├── api.ts              # typed frontend API client (₹ constants)
│       ├── api-utils.ts        # serializers, guards, domain logic
│       ├── store.ts            # Zustand store (routing, cart, wishlist)
│       ├── types.ts            # shared API contract types
│       └── seed-products.ts    # 36-product plants & home catalog
├── scripts/seed.ts             # database seeder (Indian users, ₹ orders)
├── public/products/            # product images (self-contained)
└── .env.example                # environment template
```

## Local development

### 1. Prerequisites
- Node.js 20+ (or [Bun](https://bun.sh) 1.1+)
- A MongoDB instance — either a local `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 2. Install & configure
```bash
npm install            # or: bun install
cp .env.example .env   # then edit .env
```

`.env`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/shopverse
JWT_SECRET=<openssl rand -hex 32>
```

### 3. Seed demo data (optional but recommended)
```bash
npm run seed           # or: bun run seed / npx tsx scripts/seed.ts
```

This creates 19 users, 36 products (8 categories — Indoor Plants, Outdoor & Garden, Planters & Pots, Home & Kitchen, Home Decor, Storage & Organization, Bedding & Bath, Cleaning & Essentials), 144 reviews and 18 orders across all statuses — everything in ₹ with Indian addresses.

**Demo accounts**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@shopverse.com` | `Admin123!` |
| Customer | `aarav@example.com` | `Password123!` |

### 4. Run
```bash
npm run dev            # http://localhost:3000
```

## Deploying to GitHub + Vercel + MongoDB Atlas

### 1. Create a MongoDB Atlas database (free)
1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) → create a free **M0** cluster
2. **Database Access** → add a database user (username + password)
3. **Network Access** → allow access from anywhere (`0.0.0.0/0`) — Vercel functions need this
4. **Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/shopverse?retryWrites=true&w=majority`

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "ShopVerse: plants & home essentials store"
git branch -M main
git remote add origin https://github.com/<you>/shopverse.git
git push -u origin main
```

### 3. Deploy on Vercel
1. [vercel.com/new](https://vercel.com/new) → **Import** your `shopverse` repository
2. Framework preset is auto-detected (**Next.js**) — keep defaults
3. **Environment Variables** → add:
   - `MONGODB_URI` = your Atlas connection string (from step 1)
   - `JWT_SECRET` = a long random string (`openssl rand -hex 32`)
4. **Deploy**

### 4. Seed your production database (optional)
Run the seeder once against Atlas from your machine:
```bash
MONGODB_URI="mongodb+srv://..." npm run seed
```

That's it — no other configuration is required. Product images live in `public/products/` (deployed with the app), and admin image uploads are stored in MongoDB and served via `/api/uploads/[id]`, so nothing depends on a writable filesystem.

## API overview

| Method & path | Auth | Description |
|---|---|---|
| `POST /api/auth/register` | — | Create customer account (always USER) |
| `POST /api/auth/login` / `logout` | — | Session cookie in/out |
| `GET/PUT /api/auth/me` | USER | Profile read/update |
| `PUT /api/auth/password` | USER | Change password |
| `GET /api/products` | — | Catalog with `search, category, brands, minPrice, maxPrice, minRating, inStock, deals, sort, page, limit, ids, mine` |
| `POST /api/products` | ADMIN | Create product |
| `PUT/DELETE /api/products/[id]` | ADMIN | Update/delete product |
| `GET /api/products/brands` | — | Distinct brands |
| `GET/POST/PUT/DELETE /api/cart` | USER | Server cart |
| `POST /api/cart/merge` | USER | Merge guest cart after login |
| `POST /api/orders` | USER | Checkout (validates stock, computes ₹ totals server-side) |
| `GET /api/orders` | USER | Own orders |
| `PATCH /api/orders/[id]` | USER (cancel) / ADMIN (status) | Cancel or update status + tracking |
| `GET /api/orders/all` | ADMIN | All orders with filters |
| `GET/POST /api/reviews` | — / USER | Reviews with aggregate recompute |
| `GET/POST /api/wishlist` | USER | Wishlist list/toggle |
| `POST /api/upload` | ADMIN | Image upload → MongoDB |
| `GET /api/uploads/[id]` | — | Serve uploaded image |
| `GET /api/admin/stats` | ADMIN | Store analytics |
| `GET /api/admin/users` | ADMIN | User list with order stats |
| `PUT /api/admin/users/[id]` | ADMIN | Change role |

## Business rules

- Prices, taxes (**18% GST**), shipping (**₹49 flat, free over ₹499**) and totals are computed **server-side** in Indian Rupees
- Stock decrements are atomic and rolled back automatically if any item fails — safe under concurrency without transactions
- Cancelling an order restocks items and flips paid payments to `REFUNDED`
- Only ADMIN can create, edit or delete products; customers can never escalate their own role

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm run seed` | Seed MongoDB with demo data |

---

Built as a complete, deploy-anywhere e-commerce starter. No proprietary services, no filesystem dependencies — just Next.js and MongoDB.
