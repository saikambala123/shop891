// ──────────────────────────────────────────────────────────────
// shop-891 — Admin dashboard / Coupons tab
// Full coupon management: create percent or flat-₹ coupons, set
// minimum order value, discount caps and expiry — and change any
// of it at any time. Toggling a coupon live instantly controls
// what customers can redeem at checkout.
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgePercent,
  CalendarClock,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  Save,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
  X,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiCoupons } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CouponDTO, CouponType } from "@/lib/types";
import { EmptyState, ErrorState } from "./shared";

// ── Form dialog ───────────────────────────────────────────────

interface CouponFormValues {
  code: string;
  description: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  expiresAt: string;
  isActive: boolean;
  firstOrderOnly: boolean;
}

const emptyForm: CouponFormValues = {
  code: "",
  description: "",
  type: "PERCENT",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "",
  expiresAt: "",
  isActive: true,
  firstOrderOnly: false,
};

function CouponFormDialog({
  open,
  onOpenChange,
  coupon,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: CouponDTO | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CouponFormValues>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      coupon
        ? {
            code: coupon.code,
            description: coupon.description,
            type: coupon.type,
            value: String(coupon.value),
            minOrderAmount: String(coupon.minOrderAmount ?? 0),
            maxDiscountAmount:
              coupon.maxDiscountAmount != null
                ? String(coupon.maxDiscountAmount)
                : "",
            expiresAt: coupon.expiresAt
              ? new Date(coupon.expiresAt).toISOString().slice(0, 10)
              : "",
            isActive: coupon.isActive,
            firstOrderOnly: Boolean(coupon.firstOrderOnly),
          }
        : { ...emptyForm }
    );
    setErrors({});
    setSaving(false);
  }, [open, coupon]);

  const set = <K extends keyof CouponFormValues>(
    key: K,
    value: CouponFormValues[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) {
      e.code = "3-24 characters — letters, numbers and dashes.";
    }
    const value = parseFloat(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      e.value = "Enter a value greater than 0.";
    } else if (form.type === "PERCENT" && value > 90) {
      e.value = "Percent discount cannot exceed 90%.";
    }
    const minOrder = parseFloat(form.minOrderAmount);
    if (form.minOrderAmount.trim() !== "" && (!Number.isFinite(minOrder) || minOrder < 0)) {
      e.minOrderAmount = "Minimum order must be 0 or more.";
    }
    if (form.maxDiscountAmount.trim() !== "") {
      const cap = parseFloat(form.maxDiscountAmount);
      if (!Number.isFinite(cap) || cap <= 0) {
        e.maxDiscountAmount = "Cap must be greater than 0.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Partial<CouponDTO> = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      value: parseFloat(form.value),
      minOrderAmount: parseFloat(form.minOrderAmount) || 0,
      maxDiscountAmount: form.maxDiscountAmount.trim()
        ? parseFloat(form.maxDiscountAmount)
        : null,
      expiresAt: form.expiresAt ? form.expiresAt : null,
      isActive: form.isActive,
      firstOrderOnly: form.firstOrderOnly,
    };
    try {
      if (coupon) {
        await apiCoupons.update(coupon.id, payload);
        toast({ title: "Coupon updated", description: payload.code });
      } else {
        await apiCoupons.create(payload);
        toast({ title: "Coupon created", description: payload.code });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: coupon ? "Could not update coupon" : "Could not create coupon",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {coupon ? (
              <Pencil className="size-4 text-primary" />
            ) : (
              <Plus className="size-4 text-primary" />
            )}
            {coupon ? "Edit coupon" : "New coupon"}
          </DialogTitle>
          <DialogDescription>
            {coupon
              ? "Change any detail — updates apply to customers instantly."
              : "Create a discount code customers can redeem at checkout."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cp-code">Code</Label>
              <Input
                id="cp-code"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="font-mono uppercase tracking-wide"
                aria-invalid={!!errors.code}
              />
              {fieldError("code")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-type">Discount type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set("type", v as CouponType)}
              >
                <SelectTrigger id="cp-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage off</SelectItem>
                  <SelectItem value="FIXED">Flat ₹ amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-value">
                {form.type === "PERCENT" ? "Discount (%)" : "Discount (₹)"}
              </Label>
              <Input
                id="cp-value"
                type="number"
                min={0}
                step={form.type === "PERCENT" ? 1 : 0.01}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                aria-invalid={!!errors.value}
              />
              {fieldError("value")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-min">Minimum order (₹)</Label>
              <Input
                id="cp-min"
                type="number"
                min={0}
                step={0.01}
                value={form.minOrderAmount}
                onChange={(e) => set("minOrderAmount", e.target.value)}
                aria-invalid={!!errors.minOrderAmount}
              />
              {fieldError("minOrderAmount")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-cap">Max discount (₹, optional)</Label>
              <Input
                id="cp-cap"
                type="number"
                min={0}
                step={0.01}
                value={form.maxDiscountAmount}
                onChange={(e) => set("maxDiscountAmount", e.target.value)}
                placeholder="No cap"
                disabled={form.type === "FIXED"}
                aria-invalid={!!errors.maxDiscountAmount}
              />
              {form.type === "FIXED" ? (
                <p className="text-xs text-muted-foreground">
                  Only applies to percentage coupons
                </p>
              ) : (
                fieldError("maxDiscountAmount")
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-expiry">Expiry date (optional)</Label>
              <Input
                id="cp-expiry"
                type="date"
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-desc">Description (shown to customers)</Label>
            <Input
              id="cp-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. 10% off your first order"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label htmlFor="cp-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive coupons can&apos;t be redeemed at checkout
              </p>
            </div>
            <Switch
              id="cp-active"
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label htmlFor="cp-first-order">First order only</Label>
              <p className="text-xs text-muted-foreground">
                Each customer can redeem it only on their very first order
              </p>
            </div>
            <Switch
              id="cp-first-order"
              checked={form.firstOrderOnly}
              onCheckedChange={(v) => set("firstOrderOnly", v)}
            />
          </div>
        </div>

        <DialogFooter className="mt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : coupon ? (
              <Save />
            ) : (
              <Plus />
            )}
            {saving ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tab ────────────────────────────────────────────────────────

export function CouponsTab() {
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CouponDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCoupons.list();
      setCoupons(res.coupons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (coupon: CouponDTO) => {
    if (togglingId) return;
    setTogglingId(coupon.id);
    const next = !coupon.isActive;
    // optimistic update
    setCoupons((list) =>
      list.map((c) => (c.id === coupon.id ? { ...c, isActive: next } : c))
    );
    try {
      await apiCoupons.update(coupon.id, { isActive: next });
      toast({
        title: next ? "Coupon activated" : "Coupon deactivated",
        description: coupon.code,
      });
    } catch (err) {
      // revert
      setCoupons((list) =>
        list.map((c) => (c.id === coupon.id ? { ...c, isActive: coupon.isActive } : c))
      );
      toast({
        title: "Could not update coupon",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (coupon: CouponDTO) => {
    if (deletingId) return;
    setDeletingId(coupon.id);
    try {
      await apiCoupons.remove(coupon.id);
      setCoupons((list) => list.filter((c) => c.id !== coupon.id));
      toast({ title: "Coupon deleted", description: coupon.code });
    } catch (err) {
      toast({
        title: "Could not delete coupon",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const isExpired = (c: CouponDTO) =>
    !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();

  const activeCount = coupons.filter((c) => c.isActive && !isExpired(c)).length;

  return (
    <div className="space-y-5">
      {/* header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Coupons &amp; offers</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading coupons…"
              : `${activeCount} active of ${coupons.length} total — customers see these instantly at checkout.`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> New coupon
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No coupons yet"
          description="Create your first discount code — percentage off or a flat ₹ amount — and customers can redeem it at checkout."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus /> Create coupon
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coupon</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min order</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-center">Redeemed</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const expired = isExpired(c);
                return (
                  <TableRow key={c.id} className={cn(expired && "opacity-60")}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            c.isActive && !expired
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Tag size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-bold uppercase tracking-wide">
                            {c.code}
                            {c.firstOrderOnly && (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px font-sans text-[10px] font-semibold normal-case tracking-normal text-emerald-700 dark:text-emerald-300">
                                First order only
                              </span>
                            )}
                          </p>
                          <p className="max-w-52 truncate text-xs text-muted-foreground">
                            {c.description || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold">
                        {c.type === "PERCENT" ? (
                          <>
                            <BadgePercent size={14} className="text-primary" />
                            {c.value}%
                            {c.maxDiscountAmount ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                (max {formatCurrency(c.maxDiscountAmount)})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <IndianRupee size={14} className="text-primary" />
                            {c.value} off
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.minOrderAmount > 0
                        ? formatCurrency(c.minOrderAmount)
                        : "None"}
                    </TableCell>
                    <TableCell>
                      {c.expiresAt ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium",
                            expired ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          <CalendarClock size={13} />
                          {new Date(c.expiresAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {expired && " · expired"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No expiry</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <TrendingUp size={13} />
                        {c.usageCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.isActive}
                        disabled={togglingId === c.id}
                        onCheckedChange={() => toggleActive(c)}
                        aria-label={`Toggle ${c.code}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setEditing(c);
                            setDialogOpen(true);
                          }}
                          aria-label={`Edit ${c.code}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${c.code}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete coupon {c.code}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Customers will no longer be able to redeem this
                                code. Existing orders keep their discounts.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => handleDelete(c)}
                              >
                                {deletingId === c.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <X className="size-4" />
                                )}
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

      <CouponFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coupon={editing}
        onSaved={load}
      />
    </div>
  );
}
