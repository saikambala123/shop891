// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard / Product create & edit dialog
// Full product form: pricing, stock, digital switch, highlights,
// specs, tags, multi-image management (parallel upload with
// client-side compression, cover reordering) and homepage
// placement curation (offers, arrivals, launches, top rated).
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgePercent,
  Check,
  ImagePlus,
  Loader2,
  PackageOpen,
  Pencil,
  Plus,
  Rocket,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiProducts, apiUpload } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";
import { CATEGORY_META } from "@/lib/constants";
import { PLACEMENT_META } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Placement, Product, ProductSpec } from "@/lib/types";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSaved: () => void;
}

const PLACEMENT_ICONS: Record<string, typeof BadgePercent> = {
  "discount-offer": BadgePercent,
  "newly-arrived": PackageOpen,
  "just-launched": Rocket,
  "top-rated": Star,
};

const PLACEMENT_ACCENTS: Record<string, string> = {
  "discount-offer": "text-orange-500 bg-orange-500/10 group-data-[on=true]:bg-orange-500 group-data-[on=true]:text-white",
  "newly-arrived": "text-teal-600 bg-teal-500/10 group-data-[on=true]:bg-teal-600 group-data-[on=true]:text-white",
  "just-launched": "text-emerald-600 bg-emerald-500/10 group-data-[on=true]:bg-emerald-600 group-data-[on=true]:text-white",
  "top-rated": "text-amber-500 bg-amber-500/10 group-data-[on=true]:bg-amber-500 group-data-[on=true]:text-white",
};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductFormDialogProps) {
  // ── form state ───────────────────────────────────────────
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [stock, setStock] = useState("10");
  const [isDigital, setIsDigital] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [placements, setPlacements] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill whenever the dialog opens (create resets, edit prefills)
  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setBrand(product?.brand ?? "");
    setCategory(product?.category ?? "");
    setPrice(product ? String(product.price) : "");
    setCompareAtPrice(
      product?.compareAtPrice != null ? String(product.compareAtPrice) : ""
    );
    setDiscountPct(
      product?.compareAtPrice && product.compareAtPrice > product.price
        ? String(
            Math.round(
              ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
            )
          )
        : ""
    );
    setStock(product ? String(product.stock) : "10");
    setIsDigital(product?.isDigital ?? false);
    setIsActive(product?.isActive ?? true);
    setDescription(product?.description ?? "");
    setHighlights(product?.highlights?.length ? [...product.highlights] : [""]);
    setSpecs(product?.specs?.length ? product.specs.map((s) => ({ ...s })) : []);
    setTags(product?.tags?.length ? product.tags.join(", ") : "");
    setImages(product?.images?.length ? [...product.images] : []);
    setPlacements(product?.placements?.length ? [...product.placements] : []);
    setImageUrl("");
    setErrors({});
    setUploading(false);
    setUploadProgress(null);
    setSaving(false);
  }, [open, product]);

  // ── images ───────────────────────────────────────────────
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });
    let done = 0;
    try {
      // Compress + upload every file in parallel; keep result order.
      const results = await Promise.all(
        list.map(async (file) => {
          try {
            const optimized = await compressImage(file);
            return await apiUpload.image(optimized);
          } catch (err) {
            return { error: err instanceof Error ? err.message : "Upload failed", name: file.name };
          } finally {
            done += 1;
            setUploadProgress({ done, total: list.length });
          }
        })
      );
      const urls = results.filter((r): r is string => typeof r === "string");
      const failures = results.filter((r) => typeof r !== "string") as {
        error: string;
        name: string;
      }[];
      if (urls.length > 0) {
        setImages((prev) => [...prev, ...urls]);
        toast({
          title: `${urls.length} image${urls.length === 1 ? "" : "s"} uploaded`,
          description: urls.length === 1 ? "Set as cover — drag order can be changed below." : "The first image is the cover photo.",
        });
      }
      if (failures.length > 0) {
        toast({
          title: `${failures.length} upload${failures.length === 1 ? "" : "s"} failed`,
          description: failures.map((f) => `${f.name}: ${f.error}`).join(" · "),
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    // Allow absolute http(s) links or site-relative paths (e.g. /products/x.jpg)
    if (!/^(https?:)?\/\//.test(url) && !/^\/[^/]/.test(url)) {
      toast({
        title: "Invalid image URL",
        description: "Paste a valid http(s) image link or a site path like /products/name.jpg.",
        variant: "destructive",
      });
      return;
    }
    setImages((prev) => [...prev, url]);
    setImageUrl("");
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /** Promote an image to position 0 (the cover photo). */
  const makeCover = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [img] = next.splice(index, 1);
      next.unshift(img);
      return next;
    });
  };

  /** Set the offer as a percentage — computes the compare-at price. */
  const applyDiscountPct = (pct: string) => {
    setDiscountPct(pct);
    const p = parseFloat(price);
    const v = parseFloat(pct);
    if (!Number.isFinite(v) || v <= 0 || v >= 100) {
      if (pct.trim() === "") setCompareAtPrice("");
      return;
    }
    if (Number.isFinite(p) && p > 0) {
      const compare = Math.round((p / (1 - v / 100)) * 100) / 100;
      setCompareAtPrice(String(compare));
    }
  };

  /** Editing the compare-at price directly recomputes the % label. */
  const applyCompareAt = (value: string) => {
    setCompareAtPrice(value);
    const p = parseFloat(price);
    const c = parseFloat(value);
    if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p <= 0 || c <= p) {
      setDiscountPct("");
      return;
    }
    setDiscountPct(String(Math.round(((c - p) / c) * 100)));
  };

  const togglePlacement = (id: Placement) => {
    setPlacements((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // ── dynamic lists ────────────────────────────────────────
  const updateHighlight = (index: number, value: string) => {
    setHighlights((prev) => prev.map((h, i) => (i === index ? value : h)));
  };
  const removeHighlight = (index: number) => {
    setHighlights((prev) => prev.filter((_, i) => i !== index));
  };
  const updateSpec = (index: number, patch: Partial<ProductSpec>) => {
    setSpecs((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const removeSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  // ── validation & save ────────────────────────────────────
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Product name is required.";
    if (!brand.trim()) next.brand = "Brand is required.";
    if (!category) next.category = "Select a category.";
    const priceNum = parseFloat(price);
    if (!price.trim() || Number.isNaN(priceNum) || priceNum <= 0) {
      next.price = "Enter a price greater than 0.";
    }
    if (compareAtPrice.trim()) {
      const cmp = parseFloat(compareAtPrice);
      if (Number.isNaN(cmp) || cmp <= 0) {
        next.compareAtPrice = "Compare-at price must be greater than 0.";
      }
    }
    if (!isDigital) {
      const stockNum = parseInt(stock, 10);
      if (stock.trim() === "" || Number.isNaN(stockNum) || stockNum < 0) {
        next.stock = "Enter a stock count of 0 or more.";
      }
    }
    if (!description.trim()) next.description = "Description is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (saving || uploading) return;
    if (!validate()) {
      toast({
        title: "Please fix the highlighted fields",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const compareNum = compareAtPrice.trim() ? parseFloat(compareAtPrice) : 0;
    const stockNum = isDigital ? 999 : parseInt(stock, 10) || 0;
    const payload = {
      name: name.trim(),
      brand: brand.trim(),
      category,
      price: parseFloat(price),
      compareAtPrice: compareNum > 0 ? compareNum : null,
      stock: stockNum,
      isDigital,
      isActive,
      description: description.trim(),
      highlights: highlights.map((h) => h.trim()).filter(Boolean),
      specs: specs
        .map((s) => ({ name: s.name.trim(), value: s.value.trim() }))
        .filter((s) => s.name && s.value),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      images,
      placements,
    };
    try {
      if (product) {
        await apiProducts.update(product.id, payload);
        toast({ title: "Product updated", description: payload.name });
      } else {
        await apiProducts.create(payload);
        toast({
          title: "Product created",
          description: payload.name,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: product ? "Could not update product" : "Could not create product",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-xs font-medium text-destructive">{errors[key]}</p>
    ) : null;

  // ── render ───────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {product ? (
              <Pencil className="size-4 text-orange-600" />
            ) : (
              <Plus className="size-4 text-orange-600" />
            )}
            {product ? "Edit product" : "New product"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Update the listing details below."
              : "Fill in the details to publish a new listing."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {/* ── basics ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Name</Label>
              <Input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aurora Wireless Headphones"
                aria-invalid={!!errors.name}
              />
              {fieldError("name")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-brand">Brand</Label>
              <Input
                id="pf-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. TechHaven"
                aria-invalid={!!errors.brand}
              />
              {fieldError("brand")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="pf-category" className="w-full" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_META.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("category")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">Price (₹)</Label>
              <Input
                id="pf-price"
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="49.99"
                aria-invalid={!!errors.price}
              />
              {fieldError("price")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-compare">Compare-at price / offer %</Label>
              <div className="flex gap-2">
                <Input
                  id="pf-compare"
                  type="number"
                  min={0}
                  step={0.01}
                  value={compareAtPrice}
                  onChange={(e) => applyCompareAt(e.target.value)}
                  placeholder="69.99"
                  aria-invalid={!!errors.compareAtPrice}
                  className="flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={discountPct}
                    onChange={(e) => applyDiscountPct(e.target.value)}
                    placeholder="—"
                    aria-label="Offer percentage"
                    className="h-full pr-7"
                  />
                  <span
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-primary"
                    aria-hidden
                  >
                    %
                  </span>
                </div>
              </div>
              {fieldError("compareAtPrice") ?? (
                <p className="text-xs text-muted-foreground">
                  {compareAtPrice && parseFloat(compareAtPrice) > parseFloat(price)
                    ? `Customers see a ${discountPct || "…"}% off badge`
                    : "Type a % to auto-fill, or set the MRP directly"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">Stock</Label>
              <Input
                id="pf-stock"
                type="number"
                min={0}
                step={1}
                value={isDigital ? "" : stock}
                onChange={(e) => setStock(e.target.value)}
                disabled={isDigital}
                placeholder={isDigital ? "—" : "25"}
                aria-invalid={!!errors.stock}
              />
              {isDigital ? (
                <p className="text-xs text-muted-foreground">
                  Unlimited for digital products
                </p>
              ) : (
                fieldError("stock")
              )}
            </div>
          </div>

          {/* ── switches ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label htmlFor="pf-digital">Digital product</Label>
                <p className="text-xs text-muted-foreground">
                  Delivered via license key
                </p>
              </div>
              <Switch
                id="pf-digital"
                checked={isDigital}
                onCheckedChange={setIsDigital}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label htmlFor="pf-active">Visible in store</Label>
                <p className="text-xs text-muted-foreground">
                  Hidden products are not listed
                </p>
              </div>
              <Switch
                id="pf-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {/* ── description ── */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-description">Description</Label>
            <Textarea
              id="pf-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this product great?"
              aria-invalid={!!errors.description}
            />
            {fieldError("description")}
          </div>

          <Separator />

          {/* ── homepage placements ── */}
          <div className="space-y-3">
            <div>
              <Label>Homepage placement</Label>
              <p className="text-xs text-muted-foreground">
                Curate which home-page rails this product appears in. New
                products can appear instantly in these cards.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PLACEMENT_META.map((pl) => {
                const Icon = PLACEMENT_ICONS[pl.id] ?? Star;
                const on = placements.includes(pl.id);
                return (
                  <div
                    key={pl.id}
                    role="button"
                    tabIndex={0}
                    data-on={on}
                    aria-pressed={on}
                    onClick={() => togglePlacement(pl.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        togglePlacement(pl.id);
                      }
                    }}
                    className={cn(
                      "group flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.98]",
                      on
                        ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                        : "hover:border-primary/30 hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        PLACEMENT_ACCENTS[pl.id] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                        {pl.label}
                        {on && <Check className="size-3.5 text-primary" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                        {pl.description}
                      </span>
                    </span>
                    <Switch
                      checked={on}
                      tabIndex={-1}
                      onCheckedChange={() => togglePlacement(pl.id)}
                      aria-hidden
                      className="pointer-events-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* ── highlights ── */}
          <div className="space-y-2">
            <div>
              <Label>Highlights</Label>
              <p className="text-xs text-muted-foreground">
                Short bullet points shown on the product page
              </p>
            </div>
            <div className="space-y-2">
              {highlights.map((highlight, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={highlight}
                    onChange={(e) => updateHighlight(i, e.target.value)}
                    placeholder="e.g. 30-hour battery life"
                    aria-label={`Highlight ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeHighlight(i)}
                    aria-label={`Remove highlight ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setHighlights((prev) => [...prev, ""])}
            >
              <Plus /> Add highlight
            </Button>
          </div>

          {/* ── specs ── */}
          <div className="space-y-2">
            <div>
              <Label>Specifications</Label>
              <p className="text-xs text-muted-foreground">
                Name / value pairs such as “Weight — 250g”
              </p>
            </div>
            <div className="space-y-2">
              {specs.map((spec, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={spec.name}
                    onChange={(e) => updateSpec(i, { name: e.target.value })}
                    placeholder="Name (e.g. Weight)"
                    aria-label={`Specification ${i + 1} name`}
                    className="flex-1"
                  />
                  <Input
                    value={spec.value}
                    onChange={(e) => updateSpec(i, { value: e.target.value })}
                    placeholder="Value (e.g. 250g)"
                    aria-label={`Specification ${i + 1} value`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSpec(i)}
                    aria-label={`Remove specification ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setSpecs((prev) => [...prev, { name: "", value: "" }])}
            >
              <Plus /> Add specification
            </Button>
          </div>

          {/* ── tags ── */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-tags">Tags</Label>
            <Input
              id="pf-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="wireless, audio, over-ear"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated keywords used by store search
            </p>
          </div>

          <Separator />

          {/* ── images ── */}
          <div className="space-y-3">
            <div>
              <Label>Images</Label>
              <p className="text-xs text-muted-foreground">
                Upload multiple photos or paste links — the first image is the
                cover. Large photos are compressed automatically.
              </p>
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((image, i) => (
                  <div key={`${image}-${i}`} className="group relative">
                    <img
                      src={image}
                      alt={`Product image ${i + 1}`}
                      className="h-20 w-20 rounded-lg border object-cover"
                    />
                    {i === 0 ? (
                      <span className="absolute bottom-1 left-1 rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeCover(i)}
                        aria-label={`Make image ${i + 1} the cover`}
                        className="absolute inset-x-1 bottom-1 rounded bg-zinc-900/75 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-zinc-900 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        Set cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-white shadow-sm transition-transform hover:scale-110"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {uploading && uploadProgress && (
                  <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-[10px] font-semibold tabular-nums">
                      {uploadProgress.done}/{uploadProgress.total}
                    </span>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div
              role="button"
              tabIndex={0}
              aria-label="Upload product images"
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !uploading) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
                uploading
                  ? "border-primary/40 bg-primary/[0.03] opacity-70"
                  : "hover:border-primary/50 hover:bg-primary/[0.03]"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <p className="text-xs font-semibold">
                    Uploading {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : ""} images…
                  </p>
                </>
              ) : (
                <>
                  <Upload className="size-5 text-primary" />
                  <p className="text-xs font-semibold">
                    Tap to upload multiple images
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    PNG, JPG, WebP or GIF — compressed automatically
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  placeholder="Paste an image URL…"
                  aria-label="Add image by URL"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={handleAddUrl}
                  disabled={!imageUrl.trim()}
                >
                  <ImagePlus /> Add
                </Button>
              </div>
            </div>
            <p className={cn("text-xs", images.length === 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
              {images.length === 0
                ? "No images yet — listings with a cover image convert better."
                : `${images.length} image${images.length === 1 ? "" : "s"} attached.`}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : product ? (
              <Save />
            ) : (
              <Plus />
            )}
            {saving ? "Saving…" : product ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
