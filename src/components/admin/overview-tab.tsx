// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard / Overview tab
// Stat cards, revenue charts, status breakdown, top & low stock
// product lists and recent orders.
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  CheckCircle2,
  DollarSign,
  Package,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiAdmin } from "@/lib/api";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
import { formatCompactCurrency, formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/types";
import type { AdminStats } from "@/lib/types";
import { ErrorState, ORDER_STATUS_META, OrderStatusBadge } from "./shared";

// Warm brand palette (no indigo / blue / violet)
const CATEGORY_PALETTE = [
  "#ea580c",
  "#f59e0b",
  "#d97706",
  "#b45309",
  "#f97316",
  "#78350f",
  "#fb923c",
  "#c2410c",
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.12)",
};

export function OverviewTab({
  onGoToProducts,
}: {
  onGoToProducts?: () => void;
}) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdmin.stats();
      setStats(res.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <OverviewSkeleton />;
  if (error || !stats) return <ErrorState message={error ?? undefined} onRetry={load} />;

  const periodRevenue = stats.salesByDay.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Stat cards ─────────────────────────────────────── */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={formatCurrency(stats.revenue)}
          sub="Gross store sales"
          iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <StatCard
          icon={Package}
          label="Active orders"
          value={String(stats.activeOrders)}
          sub={`${stats.activeOrders} of ${stats.orderCount} total`}
          iconClassName="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
        />
        <StatCard
          icon={Boxes}
          label="Products"
          value={String(stats.productCount)}
          sub="in the catalog"
          iconClassName="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
        />
        <StatCard
          icon={Users}
          label="Customers"
          value={String(stats.customerCount ?? 0)}
          sub="registered shoppers"
          iconClassName="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
        />
      </section>

      {/* ── Charts ─────────────────────────────────────────── */}
      <section aria-label="Revenue charts" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="gap-0 p-5 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4 text-orange-600" />
                Revenue — last 14 days
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatCurrency(periodRevenue)} in this period
              </p>
            </div>
          </div>
          <div className="mt-4 h-[260px]">
            {stats.salesByDay.length === 0 ? (
              <ChartPlaceholder label="No revenue recorded yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="svRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ea580c" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#a1a1aa"
                    strokeOpacity={0.25}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => format(new Date(value), "MMM d")}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground"
                    dy={6}
                  />
                  <YAxis
                    tickFormatter={(value: number) => formatCompactCurrency(value)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground"
                    width={54}
                  />
                  <Tooltip
                    cursor={{ stroke: "#ea580c", strokeOpacity: 0.35 }}
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(value) => format(new Date(String(value)), "MMM d, yyyy")}
                    formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    fill="url(#svRevenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="gap-0 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Revenue by category</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">All-time sales split</p>
          <div className="mt-4 h-[260px]">
            {stats.categoryRevenue.length === 0 ? (
              <ChartPlaceholder label="No category sales yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.categoryRevenue}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#a1a1aa"
                    strokeOpacity={0.25}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value: number) => formatCompactCurrency(value)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={100}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    cursor={{ fill: "rgb(0 0 0 / 0.05)" }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
                    {stats.categoryRevenue.map((entry, i) => (
                      <Cell key={entry.category} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      {/* ── Order status breakdown ─────────────────────────── */}
      <section aria-label="Orders by status">
        <Card className="gap-0 p-5">
          <h3 className="text-sm font-semibold">Orders by status</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {ORDER_STATUSES.map((status) => {
              const meta = ORDER_STATUS_META[status];
              return (
                <div key={status} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xl font-bold tabular-nums">
                    {stats.statusCounts[status] ?? 0}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* ── Top products & low stock ───────────────────────── */}
      <section
        aria-label="Top products and low stock"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <Card className="gap-0 p-5">
          <h3 className="text-sm font-semibold">Top products</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Best sellers by units sold</p>
          {stats.topProducts.length === 0 ? (
            <ChartPlaceholder label="No sales yet — top products will appear here." />
          ) : (
            <ul className="mt-3 space-y-1">
              {stats.topProducts.slice(0, 5).map((product, i) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <img
                    src={product.image || PLACEHOLDER_IMAGE}
                    alt={product.name}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-md border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.units} sold</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(product.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-0 p-5">
          <h3 className="text-sm font-semibold">Low stock alerts</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Physical items running low — tap to manage in Products
          </p>
          {stats.lowStockProducts.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">All stock levels look healthy</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-1">
              {stats.lowStockProducts.slice(0, 5).map((product) => (
                <li
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onGoToProducts?.()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onGoToProducts?.();
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <img
                    src={product.image || PLACEHOLDER_IMAGE}
                    alt={product.name}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-md border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">Current stock</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      product.stock <= 0
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    )}
                  >
                    {product.stock <= 0 ? "Out" : `${product.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ── Recent orders ──────────────────────────────────── */}
      <section aria-label="Recent orders">
        <Card className="gap-0 p-5">
          <h3 className="text-sm font-semibold">Recent orders</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Latest activity in the store</p>
          {stats.recentOrders.length === 0 ? (
            <ChartPlaceholder label="No orders yet." />
          ) : (
            <ul className="mt-2 divide-y">
              {stats.recentOrders.slice(0, 6).map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3"
                >
                  <span className="font-mono text-xs font-semibold">{order.orderNumber}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {order.userName ?? "Customer"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(order.total)}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  iconClassName: string;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function ChartPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed">
      <p className="px-4 text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────
function OverviewSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[360px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-[130px] rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
      <Skeleton className="h-[240px] rounded-xl" />
    </div>
  );
}
