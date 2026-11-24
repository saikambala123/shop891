import { NextRequest, NextResponse } from "next/server";
import { Order, Product, User, connectDB, idOf, oid } from "@/lib/db";
import {
  authenticate,
  firstImage,
  initSalesByDay,
  jsonError,
  round2,
  serializeOrder,
  toDayKey,
} from "@/lib/api-utils";
import type { AdminStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["PENDING", "PROCESSING", "SHIPPED"];

function topCategories(catMap: Map<string, number>) {
  return [...catMap.entries()]
    .map(([category, revenue]) => ({ category, revenue: round2(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

function topProductsList(
  prodMap: Map<string, { units: number; revenue: number; product: any }>
) {
  return [...prodMap.values()]
    .map((e) => ({
      id: idOf(e.product._id),
      name: e.product.name,
      units: e.units,
      revenue: round2(e.revenue),
      image: firstImage(e.product),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, 5);
}

/** Load the products referenced by order items in one query. */
async function productsForItems(items: { product?: unknown }[]) {
  const ids = [
    ...new Set(
      items
        .map((i) => idOf(i.product))
        .filter((id): id is string => Boolean(id))
    ),
  ].map((id) => oid(id)!);
  if (ids.length === 0) return new Map<string, any>();
  const products = await Product.find({ _id: { $in: ids } }).lean();
  return new Map(products.map((p: any) => [String(p._id), p]));
}

// GET /api/admin/stats — ADMIN scope: whole-store analytics (₹ INR)
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    await connectDB();

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    const salesByDay = initSalesByDay(14);
    const dayIndex = new Map(salesByDay.map((d) => [d.date, d]));

    const [orders, customerCount, productCount, lowStock] = await Promise.all([
      Order.find({})
        .sort({ createdAt: -1 })
        .populate("user", "name email")
        .lean(),
      User.countDocuments({ role: "USER" }),
      Product.countDocuments({}),
      Product.find({
        stock: { $lte: 5 },
        isDigital: false,
        isActive: true,
      })
        .sort({ stock: 1 })
        .limit(6)
        .lean(),
    ]);
    const lowStockCount = await Product.countDocuments({
      stock: { $lte: 5 },
      isDigital: false,
      isActive: true,
    });

    const productMap = await productsForItems(orders.flatMap((o: any) => o.items));

    const revenue = round2(
      orders
        .filter((o: any) => o.status !== "CANCELLED")
        .reduce((s: number, o: any) => s + o.total, 0)
    );
    const activeOrders = orders.filter((o: any) =>
      ACTIVE_STATUSES.includes(o.status)
    ).length;

    for (const o of orders as any[]) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
      if (o.status === "CANCELLED") continue;
      const entry = dayIndex.get(toDayKey(o.createdAt));
      if (entry) {
        entry.revenue += o.total;
        entry.orders += 1;
      }
    }

    const catMap = new Map<string, number>();
    const prodMap = new Map<
      string,
      { units: number; revenue: number; product: any }
    >();
    for (const o of orders as any[]) {
      if (o.status === "CANCELLED") continue;
      for (const item of o.items) {
        const p = productMap.get(idOf(item.product));
        if (!p) continue;
        catMap.set(
          p.category,
          (catMap.get(p.category) ?? 0) + item.price * item.quantity
        );
        const key = String(p._id);
        const e = prodMap.get(key) ?? { units: 0, revenue: 0, product: p };
        e.units += item.quantity;
        e.revenue += item.price * item.quantity;
        prodMap.set(key, e);
      }
    }

    const stats: AdminStats = {
      scope: "ADMIN",
      revenue,
      orderCount: orders.length,
      activeOrders,
      productCount,
      customerCount,
      lowStockCount,
      lowStockProducts: (lowStock as any[]).map((p) => ({
        id: idOf(p._id),
        name: p.name,
        stock: p.stock,
        image: firstImage(p),
      })),
      salesByDay: salesByDay.map((d) => ({ ...d, revenue: round2(d.revenue) })),
      statusCounts,
      categoryRevenue: topCategories(catMap),
      topProducts: topProductsList(prodMap),
      recentOrders: (orders as any[]).slice(0, 6).map(serializeOrder),
    };

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[api/admin/stats]", err);
    return jsonError("Internal server error", 500);
  }
}
