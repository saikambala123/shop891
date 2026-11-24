// ──────────────────────────────────────────────────────────────
// shop-891 — Profile / account page
// The navbar avatar opens this dedicated page (like the cart):
// every account item is listed separately — quick-access tiles,
// personal details, password and a confirmed sign-out.
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  Package,
  Save,
  ShieldCheck,
  Sun,
  UserCircle2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { apiAuth, apiOrders, ApiError } from "@/lib/api";
import { errorFieldClass, focusFirstError, type FieldErrors } from "@/lib/form-utils";
import { formatDate } from "@/lib/format";
import { AddressBook } from "@/components/shared/address-book";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function ProfileView() {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const setUser = useAppStore((s) => s.setUser);
  const openAuth = useAppStore((s) => s.openAuth);
  const logout = useAppStore((s) => s.logout);
  const navigate = useAppStore((s) => s.navigate);
  const wishlistIds = useAppStore((s) => s.wishlistIds);
  const { resolvedTheme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  // Per-field errors — the offending input is highlighted, shaken
  // and scrolled/focused so the user sees exactly what to fix.
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});

  const clearErr = (
    setter: React.Dispatch<React.SetStateAction<FieldErrors>>,
    key: string
  ) => setter((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    apiOrders
      .mine()
      .then((r) => setOrderCount(r.orders.length))
      .catch(() => setOrderCount(0));
  }, [user]);

  if (!authReady) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <UserCircle2 size={32} />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Your profile</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sign in to manage your personal details and account security.
        </p>
        <Button
          size="lg"
          className="shine-host mt-6 rounded-2xl bg-gradient-primary font-bold shadow-pop-3d transition-all hover:brightness-110 active:scale-95"
          onClick={() => openAuth("login")}
        >
          Sign in
        </Button>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleBadge =
    user.role === "ADMIN"
      ? { label: "Administrator", cls: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300" }
      : { label: "Customer", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300" };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    if (name.trim().length < 2) errs.name = "Enter your full name (2+ characters)";
    setProfileErrors(errs);
    if (focusFirstError(errs, [{ key: "name", id: "pf-name" }])) return;
    setSavingProfile(true);
    try {
      const { user: updated } = await apiAuth.updateProfile({ name: name.trim(), phone: phone.trim() || undefined });
      setUser(updated);
      setProfileErrors({});
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    if (!currentPassword) errs.currentPassword = "Enter your current password";
    if (newPassword.length < 8) errs.newPassword = "New password must be at least 8 characters";
    if (newPassword !== confirmPassword)
      errs.confirmPassword = "Passwords don't match";
    setPasswordErrors(errs);
    if (
      focusFirstError(errs, [
        { key: "currentPassword", id: "pw-current" },
        { key: "newPassword", id: "pw-new" },
        { key: "confirmPassword", id: "pw-confirm" },
      ])
    )
      return;
    setSavingPassword(true);
    try {
      await apiAuth.changePassword(currentPassword, newPassword);
      toast({ title: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordErrors({});
    } catch (err) {
      toast({
        title: "Could not change password",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmSignOut = async () => {
    setSignOutOpen(false);
    await logout();
    navigate({ name: "home" });
  };

  const scrollToAddresses = () => {
    if (typeof document === "undefined") return;
    document
      .getElementById("saved-addresses")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const memberDays = Math.max(
    1,
    Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      {/* identity card — sign-out lives right below the profile info */}
      <section className="glass flex flex-col items-center gap-5 rounded-3xl p-6 text-center shadow-card-3d sm:flex-row sm:text-left">
        <span className="rounded-full bg-gradient-primary p-[3px] shadow-md">
          <Avatar className="h-20 w-20 border-4 border-background">
            <AvatarFallback className="bg-gradient-primary text-2xl font-extrabold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="text-xl font-extrabold tracking-tight">{user.name}</h1>
            <Badge variant="outline" className={roleBadge.cls}>
              {roleBadge.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground sm:justify-start">
            <CalendarDays size={12} /> Member since {formatDate(user.createdAt)} · {memberDays} day{memberDays === 1 ? "" : "s"}
          </p>
        </div>
        {/* sign out — directly below the profile details */}
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-5 py-2.5 text-sm font-bold text-red-600 transition-all hover:bg-red-500/[0.12] hover:shadow-md active:scale-[0.98] dark:text-red-400 sm:w-auto"
        >
          <LogOut size={15} /> Sign Out
        </button>
      </section>

      {/* ── account items — each entry opens its own destination ── */}
      <section className="rounded-3xl border bg-card p-2.5 shadow-card-3d sm:p-3">
        <h2 className="px-3 pb-1 pt-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Your account
        </h2>

        {/* My Orders */}
        <button
          type="button"
          onClick={() => navigate({ name: "orders" })}
          className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-primary/[0.07]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
            <Package size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">My Orders</span>
            <span className="block text-xs text-muted-foreground">
              {orderCount === null ? "Loading…" : `${orderCount} order${orderCount === 1 ? "" : "s"} · track, review & invoice`}
            </span>
          </span>
          <ArrowRight size={17} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </button>
        <div className="mx-3 h-px bg-border/60" />

        {/* Wishlist */}
        <button
          type="button"
          onClick={() => navigate({ name: "wishlist" })}
          className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-primary/[0.07]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-500 ring-1 ring-rose-500/20">
            <Heart size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Wishlist</span>
            <span className="block text-xs text-muted-foreground">
              {wishlistIds.length} saved item{wishlistIds.length === 1 ? "" : "s"} · move to cart anytime
            </span>
          </span>
          <ArrowRight size={17} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </button>
        <div className="mx-3 h-px bg-border/60" />

        {/* Saved addresses — scrolls to the address book card */}
        <button
          type="button"
          onClick={scrollToAddresses}
          className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-primary/[0.07]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            <MapPin size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Saved Addresses</span>
            <span className="block text-xs text-muted-foreground">
              {(user.addresses?.length ?? 0) === 0
                ? "Add addresses for faster checkout"
                : `${user.addresses?.length} saved · add, edit & set default`}
            </span>
          </span>
          <ArrowRight size={17} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </button>
        <div className="mx-3 h-px bg-border/60" />

        {/* Admin console — admins only */}
        {user.role === "ADMIN" && (
          <>
            <button
              type="button"
              onClick={() => navigate({ name: "admin", tab: "overview" })}
              className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-orange-500/[0.07]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-orange-500/5 text-orange-600 ring-1 ring-orange-500/20 dark:text-orange-400">
                <LayoutDashboard size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Admin Console</span>
                <span className="block text-xs text-muted-foreground">
                  Products, orders, customers &amp; coupons
                </span>
              </span>
              <ArrowRight size={17} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-orange-500" />
            </button>
            <div className="mx-3 h-px bg-border/60" />
          </>
        )}

        {/* Appearance — inline theme switch */}
        <div className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
            {resolvedTheme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Appearance</span>
            <span className="block text-xs text-muted-foreground">
              {resolvedTheme === "dark" ? "Dark mode is on" : "Light mode is on"}
            </span>
          </span>
          <Switch
            checked={resolvedTheme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            aria-label="Toggle dark mode"
          />
        </div>
      </section>

      {/* ── saved addresses — full address book manager ── */}
      <div id="saved-addresses" className="scroll-mt-24">
        <AddressBook />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* profile form */}
        <section className="rounded-3xl border bg-card p-5 shadow-card-3d sm:p-6">
          <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <UserCircle2 size={18} />
            </span>
            Personal details
          </h2>
          <form onSubmit={saveProfile} noValidate className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Full name</Label>
              <Input
                id="pf-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearErr(setProfileErrors, "name");
                }}
                aria-invalid={!!profileErrors.name}
                className={cn("h-11 rounded-xl", errorFieldClass(!!profileErrors.name))}
              />
              {profileErrors.name && (
                <p className="text-xs font-medium text-destructive">{profileErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-phone">Phone (optional)</Label>
              <Input
                id="pf-phone"
                value={phone ?? ""}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-email">Email</Label>
              <Input
                id="pf-email"
                value={user.email}
                disabled
                className="h-11 rounded-xl text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed in this demo.</p>
            </div>
            <Button
              type="submit"
              disabled={savingProfile}
              className="shine-host h-11 rounded-xl bg-gradient-primary font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save changes
            </Button>
          </form>
        </section>

        {/* password form */}
        <section className="rounded-3xl border bg-card p-5 shadow-card-3d sm:p-6">
          <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
              <KeyRound size={18} />
            </span>
            Change password
          </h2>
          <form onSubmit={changePassword} noValidate className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  clearErr(setPasswordErrors, "currentPassword");
                }}
                autoComplete="current-password"
                aria-invalid={!!passwordErrors.currentPassword}
                className={cn("h-11 rounded-xl", errorFieldClass(!!passwordErrors.currentPassword))}
              />
              {passwordErrors.currentPassword && (
                <p className="text-xs font-medium text-destructive">{passwordErrors.currentPassword}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">New password</Label>
                <Input
                  id="pw-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearErr(setPasswordErrors, "newPassword");
                  }}
                  autoComplete="new-password"
                  aria-invalid={!!passwordErrors.newPassword}
                  className={cn("h-11 rounded-xl", errorFieldClass(!!passwordErrors.newPassword))}
                />
                {passwordErrors.newPassword && (
                  <p className="text-xs font-medium text-destructive">{passwordErrors.newPassword}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-confirm">Confirm new</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearErr(setPasswordErrors, "confirmPassword");
                  }}
                  autoComplete="new-password"
                  aria-invalid={!!passwordErrors.confirmPassword}
                  className={cn("h-11 rounded-xl", errorFieldClass(!!passwordErrors.confirmPassword))}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-xs font-medium text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>
            </div>
            <Button
              type="submit"
              disabled={savingPassword}
              className="shine-host h-11 rounded-xl bg-gradient-primary font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Update password
            </Button>
          </form>
        </section>
      </div>

      {/* sign-out confirmation — compact panel */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent className="max-w-[300px] gap-3 rounded-xl p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <LogOut size={15} />
              </span>
              Sign out of shop-891?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              You&apos;ll need to sign in again to access your cart,
              orders and wishlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9 rounded-lg px-3 text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSignOut}
              className="h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition-all hover:bg-red-700 focus-visible:ring-red-500/60"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
