// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard / Products tab
// Searchable product table with create, edit and delete actions,
// a homepage curation summary and one-tap placement toggles so
// every home-page rail (offers, arrivals, launches, top rated) is
// fully managed from here.
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Download,
  PackageOpen,
  PackagePlus,
  Pencil,
  Plus,
  Rocket,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiProducts } from "@/lib/api";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Placement, Product } from "@/lib/types";
import { StarRating } from "@/components/shared/star-rating";
import { EmptyState, ErrorState } from "./shared";
import { ProductFormDialog } from "./product-form-dialog";

const PLACEMENT_COLUMNS: {
  id: Placement;
  label: string;
  short: string;
  icon: typeof Rocket;
  on: string;
}[] = [
  {
    id: "discount-offer",
    label: "Discount & offer",
    short: "Offer",
    icon: BadgePercent,
    on: "bg-orange-500 text-white shadow-sm",
  },
  {
    id: "newly-arrived",
    label: "Newly arrived",
    short: "New",
    icon: PackageOpen,
    on: "bg-teal-600 text-white shadow-sm",
  },
  {
    id: "just-launched",
    label: "Just launched",
    short: "Launch",
    icon: Rocket,
    on: "bg-emerald-600 text-white shadow-sm",
  },
  {
    id: "top-rated",
    label: "Top rated",
    short: "Top",
    icon: Star,
    on: "bg-amber-500 text-white shadow-sm",
  },
];

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiProducts.list({ mine: true, limit: 500 });
      setProducts(res.products);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }, [products, search]);

  const placementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      for (const pl of p.placements ?? []) {
        counts[pl] = (counts[pl] ?? 0) + 1;
      }
    }
    return counts;
  }, [products]);

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const handleDelete = async (product: Product) => {
    setDeletingId(product.id);
    try {
      await apiProducts.remove(product.id);
      toast({ title: "Product deleted", description: product.name });
      await load();
    } catch (err) {
      toast({
        title: "Could not delete product",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  /** One-tap homepage placement toggle with optimistic UI. */
  const togglePlacement = async (product: Product, placement: Placement) => {
    const key = `${product.id}:${placement}`;
    if (togglingKey === key) return;
    const next = (product.placements ?? []).includes(placement)
      ? (product.placements ?? []).filter((p) => p !== placement)
      : [...(product.placements ?? []), placement];

    const previous = products;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, placements: next } : p))
    );
    setTogglingKey(key);
    try {
      await apiProducts.update(product.id, { placements: next });
      const label = PLACEMENT_COLUMNS.find((c) => c.id === placement)?.label ?? placement;
      toast({
        title: next.includes(placement) ? `${label} — added` : `${label} — removed`,
        description: `${product.name} · homepage updated`,
      });
    } catch (err) {
      setProducts(previous); // revert
      toast({
        title: "Could not update homepage placement",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${total} product${total === 1 ? "" : "s"} in your catalog`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or brand"
              aria-label="Search products"
              className="w-full pl-8 sm:w-64"
            />
          </div>
          <Button
            onClick={handleAdd}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            <Plus /> Add product
          </Button>
        </div>
      </div>

      {/* ── homepage curation summary ──────────────────────── */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {PLACEMENT_COLUMNS.map((col) => {
            const count = placementCounts[col.id] ?? 0;
            return (
              <div
                key={col.id}
                className="flex items-center gap-2.5 rounded-xl border bg-card p-3"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    count > 0
                      ? col.on
                      : "bg-muted text-muted-foreground/60"
                  )}
                >
                  <col.icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none tabular-nums">{count}</p>
                  <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                    {col.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── content ────────────────────────────────────────── */}
      {loading ? (
        <ProductsSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="No products yet"
          description="Create your first listing and it will appear in the store immediately."
          action={
            <Button
              onClick={handleAdd}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              <Plus /> Add your first product
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching products"
          description={`Nothing matches “${search.trim()}”. Try a different name or brand.`}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Homepage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const deleting = deletingId === product.id;
                const outOfStock = !product.isDigital && product.stock <= 0;
                const lowStock = !product.isDigital && product.stock > 0 && product.stock <= 5;
                return (
                  <TableRow
                    key={product.id}
                    className={cn("transition-opacity", deleting && "pointer-events-none opacity-50")}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.images[0] ?? PLACEHOLDER_IMAGE}
                          alt={product.name}
                          loading="lazy"
                          className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                        />
                        <div className="min-w-0 max-w-[220px]">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.brand}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.category}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(product.price)}
                        </span>
                        {product.compareAtPrice != null &&
                          product.compareAtPrice > product.price && (
                            <span className="text-xs text-muted-foreground line-through tabular-nums">
                              {formatCurrency(product.compareAtPrice)}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.isDigital ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-bold text-teal-600 dark:text-teal-400">
                            ∞
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                            <Download className="size-3" /> Digital
                          </span>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                            outOfStock
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : lowStock
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          )}
                        >
                          {outOfStock
                            ? "Out"
                            : lowStock
                              ? `${product.stock} left`
                              : `${product.stock} in stock`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StarRating
                        value={product.rating}
                        count={product.reviewCount}
                        size={12}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {PLACEMENT_COLUMNS.map((col) => {
                          const on = (product.placements ?? []).includes(col.id);
                          const busy = togglingKey === `${product.id}:${col.id}`;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              title={on ? `Remove from ${col.label}` : `Add to ${col.label}`}
                              aria-label={`${on ? "Remove from" : "Add to"} ${col.label}: ${product.name}`}
                              aria-pressed={on}
                              disabled={deleting}
                              onClick={() => togglePlacement(product, col.id)}
                              className={cn(
                                "flex size-7 items-center justify-center rounded-md transition-all duration-200 active:scale-90",
                                on
                                  ? col.on
                                  : "bg-muted/70 text-muted-foreground/50 hover:bg-muted hover:text-foreground",
                                busy && "animate-pulse"
                              )}
                            >
                              <col.icon size={13} />
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.isActive ? (
                        <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          Hidden
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          aria-label={`Edit ${product.name}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deleting}
                              aria-label={`Delete ${product.name}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                              <AlertDialogDescription>
                                “{product.name}” will be permanently removed from the
                                store. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 text-white hover:bg-red-700"
                                onClick={() => handleDelete(product)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSaved={load}
      />
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────
function ProductsSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading products">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-20" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="size-12 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="hidden h-4 w-16 md:block" />
            <Skeleton className="hidden h-4 w-14 md:block" />
            <Skeleton className="h-4 w-12" />
            <div className="flex gap-1">
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
