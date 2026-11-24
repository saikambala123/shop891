// ──────────────────────────────────────────────────────────────
// shop-891 — Saved addresses (address book)
// Rendered inside the profile "Your account" section: customers
// add, edit, delete and default shipping addresses here so
// checkout is one tap instead of a form.
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { apiAddresses, ApiError } from "@/lib/api";
import { errorFieldClass, focusFirstError } from "@/lib/form-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AddressBookEntry } from "@/lib/types";

const MAX_ADDRESSES = 6;

type AddressForm = {
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

const emptyForm: AddressForm = {
  label: "Home",
  fullName: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",
};

function LabelIcon({ label }: { label: string }) {
  if (label === "Office") return <Building2 size={15} />;
  return <Home size={15} />;
}

export function AddressBook() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const addresses = user?.addresses ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // synchronous lock — a rapid double-tap must not create two addresses
  const savingRef = useRef(false);

  // Close/reset the form whenever the user signs out
  useEffect(() => {
    if (!user) {
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    }
  }, [user]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, fullName: user?.name ?? "" });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (a: AddressBookEntry) => {
    setEditingId(a.id);
    setForm({
      label: a.label,
      fullName: a.fullName,
      phone: a.phone,
      street: a.street,
      city: a.city,
      state: a.state,
      zipCode: a.zipCode,
      country: a.country || "India",
    });
    setErrors({});
    setFormOpen(true);
  };

  const set = (key: keyof AddressForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    // live-fix: clear the field's error as soon as it's edited
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const ADDRESS_ERROR_FIELDS = [
    { key: "fullName", id: "ab-name" },
    { key: "phone", id: "ab-phone" },
    { key: "zipCode", id: "ab-zip" },
    { key: "street", id: "ab-street" },
    { key: "city", id: "ab-city" },
    { key: "state", id: "ab-state" },
  ];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!/^[+\d][\d\s()-]{6,}$/.test(form.phone.trim()))
      e.phone = "Enter a valid phone number";
    if (!form.street.trim()) e.street = "Street address is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.state.trim()) e.state = "State is required";
    if (!/^[0-9A-Za-z\s-]{3,10}$/.test(form.zipCode.trim()))
      e.zipCode = "Enter a valid PIN code";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      focusFirstError(e, ADDRESS_ERROR_FIELDS);
      toast({
        title: "Please complete the highlighted fields",
        description: `${Object.keys(e).length} field${Object.keys(e).length === 1 ? "" : "s"} in this address need${Object.keys(e).length === 1 ? "s" : ""} attention.`,
        variant: "destructive",
      });
    }
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving || savingRef.current) return;
    if (!validate()) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        address: {
          label: form.label,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zipCode: form.zipCode.trim(),
          country: form.country.trim() || "India",
        },
        // keep the default default; new first address becomes default
        isDefault: editingId ? undefined : addresses.length === 0 ? true : undefined,
      };
      const res = editingId
        ? await apiAddresses.update(editingId, payload)
        : await apiAddresses.add(payload);
      setUser(res.user);
      toast({
        title: editingId ? "Address updated" : "Address saved",
        description: `${payload.address.label} · ${payload.address.city}`,
      });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      toast({
        title: "Could not save address",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleSetDefault = async (a: AddressBookEntry) => {
    if (busyId || a.isDefault) return;
    setBusyId(a.id);
    try {
      const res = await apiAddresses.setDefault(a.id);
      setUser(res.user);
      toast({ title: "Default address updated", description: `${a.label} · ${a.city}` });
    } catch (err) {
      toast({
        title: "Could not set default",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || busyId) return;
    setBusyId(deleteId);
    try {
      const res = await apiAddresses.remove(deleteId);
      setUser(res.user);
      toast({ title: "Address removed" });
      if (editingId === deleteId) {
        setFormOpen(false);
        setEditingId(null);
      }
    } catch (err) {
      toast({
        title: "Could not remove address",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setDeleteId(null);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-xs text-red-600 dark:text-red-400">{errors[key]}</p>
    ) : null;

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-card-3d sm:p-6"
      aria-label="Saved addresses"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <MapPin size={18} />
            </span>
            Saved addresses
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Save addresses once and pick them at checkout — no retyping.
          </p>
        </div>
        {/* Header CTA hidden while the list is empty — the empty state
            below already carries its own "Add your first address"
            button, and showing both at once is redundant/competing. */}
        {!formOpen && addresses.length > 0 && (
          <Button
            type="button"
            onClick={openAdd}
            disabled={addresses.length >= MAX_ADDRESSES}
            className="shine-host rounded-xl bg-gradient-primary font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Plus size={15} /> Add address
          </Button>
        )}
      </div>

      {/* address list */}
      {addresses.length === 0 && !formOpen ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed px-4 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <MapPin size={20} />
          </span>
          <p className="mt-3 text-sm font-semibold">No saved addresses yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Add your home or office address — it&apos;ll be ready to select
            every time you check out.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={openAdd}
            className="mt-4 rounded-xl bg-gradient-primary font-bold"
          >
            <Plus size={14} /> Add your first address
          </Button>
        </div>
      ) : (
        addresses.length > 0 && (
          <ul className="mt-5 space-y-3">
            {addresses.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "relative rounded-2xl border p-4 transition-all",
                  a.isDefault
                    ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                    : "hover:border-primary/25"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1 border-primary/30 bg-primary/10 text-primary"
                  >
                    <LabelIcon label={a.label} /> {a.label}
                  </Badge>
                  {a.isDefault && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      <Star size={11} /> Default
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm font-bold">{a.fullName}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {a.street}, {a.city}, {a.state} {a.zipCode}
                  <br />
                  {a.country} · {a.phone}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!a.isDefault && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === a.id}
                      onClick={() => handleSetDefault(a)}
                      className="h-8 rounded-lg border-primary/25 px-2.5 text-xs font-bold hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                    >
                      {busyId === a.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Star size={13} />
                      )}
                      Set default
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(a)}
                    className="h-8 rounded-lg px-2.5 text-xs font-bold"
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => setDeleteId(a.id)}
                    className="h-8 rounded-lg border-red-500/30 px-2.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 size={13} /> Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {/* add / edit form */}
      {formOpen && (
        <form
          onSubmit={handleSave}
          className="mt-5 space-y-4 rounded-2xl border bg-muted/30 p-4"
        >
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold">
              <MapPin size={15} className="text-primary" />
              {editingId ? "Edit address" : "New address"}
            </p>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
              aria-label="Close address form"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ab-label">Save as</Label>
              <Select value={form.label} onValueChange={(v) => set("label", v)}>
                <SelectTrigger id="ab-label" className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-name">Full name</Label>
              <Input
                id="ab-name"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Aarav Sharma"
                aria-invalid={!!errors.fullName}
                className={cn("h-11 rounded-xl", errorFieldClass(!!errors.fullName))}
              />
              {fieldError("fullName")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-phone">Phone</Label>
              <Input
                id="ab-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 98765 43210"
                aria-invalid={!!errors.phone}
                className={cn("h-11 rounded-xl", errorFieldClass(!!errors.phone))}
              />
              {fieldError("phone")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-zip">PIN code</Label>
              <Input
                id="ab-zip"
                value={form.zipCode}
                onChange={(e) => set("zipCode", e.target.value)}
                placeholder="560001"
                aria-invalid={!!errors.zipCode}
                className={cn("h-11 rounded-xl", errorFieldClass(!!errors.zipCode))}
              />
              {fieldError("zipCode")}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ab-street">Street address</Label>
              <Input
                id="ab-street"
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
                placeholder="2847 MG Road, Apt 4B"
                aria-invalid={!!errors.street}
                className={cn("h-11 rounded-xl", errorFieldClass(!!errors.street))}
              />
              {fieldError("street")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-city">City</Label>
              <Input
                id="ab-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Bengaluru"
                aria-invalid={!!errors.city}
                className={cn("h-11 rounded-xl", errorFieldClass(!!errors.city))}
              />
              {fieldError("city")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-state">State</Label>
              <Input
                id="ab-state"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="Karnataka"
                aria-invalid={!!errors.state}
                className={cn("h-11 rounded-xl", errorFieldClass(!!errors.state))}
              />
              {fieldError("state")}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ab-country">Country</Label>
              <Input
                id="ab-country"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              type="submit"
              disabled={saving}
              className="shine-host h-11 rounded-xl bg-gradient-primary px-5 font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {editingId ? "Save changes" : "Save address"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
              className="h-11 rounded-xl px-5 font-bold"
            >
              Cancel
            </Button>
            {addresses.length >= MAX_ADDRESSES && !editingId && (
              <p className="w-full text-xs text-muted-foreground">
                Address book is full ({MAX_ADDRESSES}/{MAX_ADDRESSES}) — remove
                one to add another.
              </p>
            )}
          </div>
        </form>
      )}

      {/* delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="max-w-[320px] gap-3 rounded-xl p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <Trash2 size={15} />
              </span>
              Remove this address?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              It will no longer be available at checkout. Your past orders
              keep their delivery details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9 rounded-lg px-3 text-xs font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition-all hover:bg-red-700 focus-visible:ring-red-500/60"
            >
              {busyId === deleteId ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
