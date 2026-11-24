// ──────────────────────────────────────────────────────────────
// ShopVerse — Catalog view (product listing with filters, sort,
// search, and load-more pagination)
// ──────────────────────────────────────────────────────────────
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  LayoutGrid,
  Leaf,
  Loader2,
  PackageSearch,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiProducts } from "@/lib/api";
import { CATEGORY_META, SORT_OPTIONS, categoryMeta } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { useAppStore, type Route } from "@/lib/store";
import { ProductCard } from "@/components/shared/product-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product, ProductQueryParams, ProductSort } from "@/lib/types";

// ── Types & constants ─────────────────────────────────────────

type CatalogRoute = Extract<Route, { name: "catalog" }>;

interface Filters {
  category: string; // "" = all categories
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock: boolean;
  sort: ProductSort;
}

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const DEFAULT_FILTERS: Filters = {
  category: "",
  brands: [],
  minPrice: undefined,
  maxPrice: undefined,
  minRating: undefined,
  inStock: false,
  sort: "popular",
};

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;

const SCROLLBAR =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent";

function filtersFromRoute(route: CatalogRoute, sort: ProductSort): Filters {
  return {
    ...DEFAULT_FILTERS,
    sort,
    category: route.category ?? "",
  };
}

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.category === b.category &&
    a.inStock === b.inStock &&
    a.minPrice === b.minPrice &&
    a.maxPrice === b.maxPrice &&
    a.minRating === b.minRating &&
    a.sort === b.sort &&
    a.brands.length === b.brands.length &&
    a.brands.every((brand) => b.brands.includes(brand))
  );
}

// ── Main component ────────────────────────────────────────────

export function CatalogView() {
  const route = useAppStore((s) => s.route);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);

  const [filters, setFilters] = useState<Filters>(() =>
    route.name === "catalog"
      ? filtersFromRoute(route, DEFAULT_FILTERS.sort)
      : DEFAULT_FILTERS
  );
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce the search so the fetch fires 400ms after typing stops.
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(
      () => setDebouncedSearch(searchQuery),
      SEARCH_DEBOUNCE_MS
    );
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Re-read catalog params whenever the route object changes (e.g. the
  // user clicks a category in the navbar while already on the catalog).
  useEffect(() => {
    if (route.name !== "catalog") return;
    setFilters((prev) => {
      const next = filtersFromRoute(route, prev.sort);
      return filtersEqual(prev, next) ? prev : next;
    });
    setMinPriceInput("");
    setMaxPriceInput("");
    const { searchQuery: currentSearch } = useAppStore.getState();
    if (typeof route.search === "string" && route.search !== currentSearch) {
      setSearchQuery(route.search);
    }
  }, [route, setSearchQuery]);

  // Fetch the brand list once for the filter sidebar.
  useEffect(() => {
    let cancelled = false;
    apiProducts
      .brands()
      .then((res) => {
        if (!cancelled) setBrands(res.brands);
      })
      .catch(() => {
        /* brands filter simply stays empty on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Filter mutation helpers ──

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      return filtersEqual(prev, next) ? prev : next;
    });
  }, []);

  const toggleBrand = useCallback((brand: string) => {
    setFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  }, []);

  const applyPrice = useCallback(() => {
    const parse = (raw: string): number | undefined => {
      const trimmed = raw.trim();
      if (trimmed === "") return undefined;
      const value = Number(trimmed);
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    };
    let min = parse(minPriceInput);
    let max = parse(maxPriceInput);
    if (min !== undefined && max !== undefined && min > max) {
      [min, max] = [max, min];
    }
    updateFilters({ minPrice: min, maxPrice: max });
  }, [minPriceInput, maxPriceInput, updateFilters]);

  const clearPrice = useCallback(() => {
    setMinPriceInput("");
    setMaxPriceInput("");
    updateFilters({ minPrice: undefined, maxPrice: undefined });
  }, [updateFilters]);

  const clearAll = useCallback(() => {
    setFilters((prev) => ({ ...DEFAULT_FILTERS, sort: prev.sort }));
    setMinPriceInput("");
    setMaxPriceInput("");
    setSearchQuery("");
  }, [setSearchQuery]);

  // ── Data fetching ──

  const requestIdRef = useRef(0);

  const buildParams = useCallback(
    (targetPage: number): ProductQueryParams => ({
      search: debouncedSearch || undefined,
      category: filters.category || undefined,
      brands: filters.brands.length > 0 ? filters.brands : undefined,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minRating: filters.minRating,
      inStock: filters.inStock || undefined,
      sort: filters.sort,
      page: targetPage,
      limit: PAGE_SIZE,
    }),
    [filters, debouncedSearch]
  );

  // First page: re-fetched whenever filters / sort / debounced search change.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setPage(1);
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const res = await apiProducts.list(buildParams(1));
        if (requestId !== requestIdRef.current) return;
        setProducts(res.products);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load products. Please try again."
        );
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    };
    void load();
  }, [buildParams, reloadKey]);

  const loadMore = async () => {
    if (loadingMore || loading || page >= totalPages) return;
    const requestId = requestIdRef.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await apiProducts.list(buildParams(nextPage));
      if (requestId === requestIdRef.current) {
        setProducts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...res.products.filter((p) => !seen.has(p.id))];
        });
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setPage(nextPage);
      }
    } catch (err) {
      toast({
        title: "Could not load more products",
        description:
          err instanceof Error ? err.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Derived UI values ──

  const title = filters.category
    ? categoryMeta(filters.category).label
    : searchQuery
      ? `Results for "${searchQuery}"`
      : "All Products";

  const countLine = loading
    ? "Loading products…"
    : error
      ? ""
      : total > 0
        ? `Showing 1–${Math.min(products.length, total).toLocaleString()} of ${total.toLocaleString()} results`
        : "No results found";

  const chips: ActiveChip[] = [];
  if (filters.category) {
    chips.push({
      key: "category",
      label: categoryMeta(filters.category).label,
      onRemove: () => updateFilters({ category: "" }),
    });
  }
  for (const brand of filters.brands) {
    chips.push({
      key: `brand-${brand}`,
      label: brand,
      onRemove: () =>
        updateFilters({ brands: filters.brands.filter((b) => b !== brand) }),
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const from =
      filters.minPrice !== undefined ? formatCurrency(filters.minPrice) : formatCurrency(0);
    const to =
      filters.maxPrice !== undefined
        ? formatCurrency(filters.maxPrice)
        : "any price";
    chips.push({ key: "price", label: `${from} – ${to}`, onRemove: clearPrice });
  }
  if (filters.minRating !== undefined) {
    chips.push({
      key: "rating",
      label: `${filters.minRating} stars & up`,
      onRemove: () => updateFilters({ minRating: undefined }),
    });
  }
  if (filters.inStock) {
    chips.push({
      key: "inStock",
      label: "In stock only",
      onRemove: () => updateFilters({ inStock: false }),
    });
  }

  const hasMore = page < totalPages;

  const panelProps = {
    filters,
    brands,
    minPriceInput,
    maxPriceInput,
    onMinPriceInput: setMinPriceInput,
    onMaxPriceInput: setMaxPriceInput,
    onApplyPrice: applyPrice,
    onToggleBrand: toggleBrand,
    onUpdateFilters: updateFilters,
    onClear: clearAll,
  };

  // ── Render ──

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex items-start gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block" aria-label="Product filters">
          <div
            className={cn(
              "glass sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto rounded-2xl p-5 shadow-card-3d",
              SCROLLBAR
            )}
          >
            <FilterPanel {...panelProps} />
          </div>
        </aside>

        {/* Listing column */}
        <div className="min-w-0 flex-1">
          {/* Header row: title + search (md+) + filters (mobile) + sort */}
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                <Leaf size={13} /> Shop
              </p>
              <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {countLine && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {countLine}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                className="hidden w-56 md:block lg:w-64"
              />
              <Button
                variant="outline"
                className="rounded-full border-primary/25 hover:border-primary/50 hover:bg-primary/10 hover:text-primary lg:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                Filters
                {chips.length > 0 && (
                  <Badge className="min-w-5 justify-center rounded-full bg-gradient-primary px-1.5 text-primary-foreground">
                    {chips.length}
                  </Badge>
                )}
              </Button>
              <Select
                value={filters.sort}
                onValueChange={(value) =>
                  updateFilters({ sort: value as ProductSort })
                }
              >
                <SelectTrigger
                  aria-label="Sort products"
                  className="w-[170px] rounded-xl shadow-sm"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile search */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            className="mt-3 md:hidden"
          />

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <Badge
                  key={chip.key}
                  asChild
                  variant="secondary"
                  className="gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="cursor-pointer transition-colors hover:bg-primary/20"
                  >
                    {chip.label}
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Product grid / states */}
          <div className="mt-6">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertCircle className="size-4" />
                <AlertTitle>Failed to load products</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  <span>{error}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setReloadKey((k) => k + 1)}
                  >
                    <RotateCcw className="size-3.5" />
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : products.length === 0 ? (
              <EmptyCatalog onClear={clearAll} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                        style={{ width: `${(products.length / total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Showing {products.length.toLocaleString()} of {total.toLocaleString()}
                    </p>
                    <Button
                      variant="outline"
                      className="rounded-full border-primary/30 px-6 shadow-card-3d transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      {loadingMore
                        ? "Loading…"
                        : `Load more (${(total - products.length).toLocaleString()} left)`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[300px] gap-0 p-0 sm:max-w-[300px]">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base font-extrabold tracking-tight">
              <SlidersHorizontal size={16} className="text-primary" /> Filters
            </SheetTitle>
            <SheetDescription>Narrow down the product list</SheetDescription>
          </SheetHeader>
          <div className={cn("flex-1 overflow-y-auto px-4 py-4", SCROLLBAR)}>
            <FilterPanel {...panelProps} />
          </div>
          <SheetFooter className="border-t px-4 py-3">
            <Button
              className="shine-host w-full rounded-xl bg-gradient-primary font-semibold shadow-md hover:brightness-110"
              onClick={() => setFiltersOpen(false)}
            >
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="h-10 rounded-full pl-9 pr-9 shadow-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface FilterPanelProps {
  filters: Filters;
  brands: string[];
  minPriceInput: string;
  maxPriceInput: string;
  onMinPriceInput: (value: string) => void;
  onMaxPriceInput: (value: string) => void;
  onApplyPrice: () => void;
  onToggleBrand: (brand: string) => void;
  onUpdateFilters: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

function FilterPanel({
  filters,
  brands,
  minPriceInput,
  maxPriceInput,
  onMinPriceInput,
  onMaxPriceInput,
  onApplyPrice,
  onToggleBrand,
  onUpdateFilters,
  onClear,
}: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Category */}
      <FilterSection title="Category">
        <RadioGroup
          value={filters.category}
          onValueChange={(value) => onUpdateFilters({ category: value })}
          className="gap-2"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="" />
            <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
            <span>All categories</span>
          </label>
          <div className={cn("max-h-64 space-y-2 overflow-y-auto pr-1", SCROLLBAR)}>
            {CATEGORY_META.map((category) => (
              <label
                key={category.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <RadioGroupItem value={category.id} />
                <category.icon className="size-4 shrink-0 text-primary/70" />
                <span>{category.label}</span>
              </label>
            ))}
          </div>
        </RadioGroup>
      </FilterSection>

      {/* Brand */}
      <FilterSection title="Brand">
        {brands.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No brands available right now.
          </p>
        ) : (
          <div className={cn("max-h-48 space-y-2 overflow-y-auto pr-1", SCROLLBAR)}>
            {brands.map((brand) => (
              <label
                key={brand}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={filters.brands.includes(brand)}
                  onCheckedChange={() => onToggleBrand(brand)}
                />
                <span className="truncate">{brand}</span>
              </label>
            ))}
          </div>
        )}
      </FilterSection>

      {/* Price */}
      <FilterSection title="Price">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onApplyPrice();
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Min"
              aria-label="Minimum price"
              value={minPriceInput}
              onChange={(e) => onMinPriceInput(e.target.value)}
              className="h-9 rounded-xl"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Max"
              aria-label="Maximum price"
              value={maxPriceInput}
              onChange={(e) => onMaxPriceInput(e.target.value)}
              className="h-9 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="rounded-full bg-gradient-primary font-semibold shadow-md hover:brightness-110"
          >
            Apply
          </Button>
        </form>
      </FilterSection>

      {/* Rating */}
      <FilterSection title="Rating">
        <RadioGroup
          value={
            filters.minRating === undefined ? "any" : String(filters.minRating)
          }
          onValueChange={(value) =>
            onUpdateFilters({
              minRating: value === "any" ? undefined : Number(value),
            })
          }
          className="gap-2"
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="any" />
            <span>Any rating</span>
          </label>
          {[4, 3].map((stars) => (
            <label
              key={stars}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <RadioGroupItem value={String(stars)} />
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span>{stars} stars &amp; up</span>
            </label>
          ))}
        </RadioGroup>
      </FilterSection>

      {/* Availability */}
      <FilterSection title="Availability">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={filters.inStock}
            onCheckedChange={(checked) =>
              onUpdateFilters({ inStock: checked === true })
            }
          />
          <span>In stock only</span>
        </label>
      </FilterSection>

      <Button
        variant="ghost"
        className="w-full rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
        onClick={onClear}
      >
        <X className="size-4" />
        Clear filters
      </Button>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card-3d">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3.5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-1 h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

function EmptyCatalog({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center shadow-card-3d">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
        <PackageSearch className="size-8" />
      </div>
      <h3 className="mt-4 text-lg font-bold tracking-tight">No products found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try adjusting your filters or search terms to find what you are looking
        for.
      </p>
      <Button
        variant="outline"
        className="mt-5 rounded-full border-primary/30 px-6 shadow-card-3d transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        onClick={onClear}
      >
        <RotateCcw className="size-4" />
        Clear filters
      </Button>
    </div>
  );
}
