// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard entry (AdminView)
// Renders the Admin Console with Overview / Products / Orders /
// Customers tabs. Tab state is driven by the global route:
// { name: "admin", tab }.
// ──────────────────────────────────────────────────────────────
"use client";

import {
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore, type AdminTab } from "@/lib/store";
import type { SessionUser } from "@/lib/types";
import { CouponsTab } from "./coupons-tab";
import { CustomersTab } from "./customers-tab";
import { OrdersTab } from "./orders-tab";
import { OverviewTab } from "./overview-tab";
import { ProductsTab } from "./products-tab";

export function AdminView({ user }: { user: SessionUser }) {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);

  // Desired tab comes from the global route (falls back to overview).
  const activeTab: AdminTab =
    route.name === "admin" && route.tab ? route.tab : "overview";

  // Tabs are fully controlled by the global route ({ name: "admin", tab }),
  // so they stay in sync automatically with navigate() / deep links.
  const handleTabChange = (tab: string) => {
    navigate({ name: "admin", tab: tab as AdminTab });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ── header ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-wide sm:text-2xl">
              shop<span className="text-primary">-891</span> · Admin Console
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor the store and manage users
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="size-3" />
            Full access
          </Badge>
        </div>
      </header>

      {/* ── tabs ───────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6 gap-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1">
            <TabsTrigger value="overview" className="gap-1.5 px-3 py-1.5">
              <LayoutDashboard className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 px-3 py-1.5">
              <Package className="size-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 px-3 py-1.5">
              <ShoppingCart className="size-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1.5 px-3 py-1.5">
              <Users className="size-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-1.5 px-3 py-1.5">
              <Ticket className="size-4" />
              Coupons
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab onGoToProducts={() => handleTabChange("products")} />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersTab user={user} />
        </TabsContent>
        <TabsContent value="coupons">
          <CouponsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
