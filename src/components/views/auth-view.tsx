// ──────────────────────────────────────────────────────────────
// shop-891 — Sign in / Create account (dedicated full page)
// A fresh page — not a popup — reached from every "Sign in"
// entry point. Includes the forgot-password flow (a real
// 6-digit code is emailed: email → code → new password).
// ──────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Heart,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Truck,
  UserCircle2,
  UserPlus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { ApiError, apiAuth } from "@/lib/api";
import {
  errorFieldClass,
  focusFirstError,
  type FieldErrors,
} from "@/lib/form-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Brand panel perks ────────────────────────────────────────

const PERKS = [
  {
    icon: Truck,
    title: "Free delivery over ₹499",
    text: "2–5 day tracked shipping across 19,000+ pin codes in India.",
  },
  {
    icon: ShieldCheck,
    title: "Secure checkout",
    text: "UPI, cards & wallets over an encrypted connection.",
  },
  {
    icon: Heart,
    title: "Wishlist that follows you",
    text: "Save favourites and sync them across every device.",
  },
  {
    icon: Bell,
    title: "Live order updates",
    text: "Status changes, shipping alerts and refunds — as they happen.",
  },
];

// ── View ──────────────────────────────────────────────────────

type Flow = "tabs" | "forgot-email" | "forgot-reset";

export function AuthView() {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const authMode = useAppStore((s) => s.authMode);
  const authMessage = useAppStore((s) => s.authMessage);
  const closeAuth = useAppStore((s) => s.closeAuth);
  const navigate = useAppStore((s) => s.navigate);
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);

  const [tab, setTab] = useState<"login" | "register">(authMode);
  const [flow, setFlow] = useState<Flow>("tabs");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Per-field validation errors — keyed by the input's DOM id so
  // the offending field can be highlighted, shaken and focused.
  const [errors, setErrors] = useState<FieldErrors>({});

  // Forgot-password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const clearFieldError = (id: string) =>
    setErrors((prev) => (prev[id] ? { ...prev, [id]: "" } : prev));

  const fieldErr = (id: string) =>
    errors[id] ? (
      <p className="text-xs font-medium text-destructive">{errors[id]}</p>
    ) : null;

  useEffect(() => {
    setTab(authMode);
    setError("");
    setErrors({});
  }, [authMode]);

  const switchTab = (v: string) => {
    setTab(v as "login" | "register");
    setError("");
    setErrors({});
  };

  // ── Sign in ──
  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: FieldErrors = {};
    if (!email.trim()) errs["login-email"] = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errs["login-email"] = "Enter a valid email address";
    if (!password) errs["login-password"] = "Password is required";
    setErrors(errs);
    if (
      focusFirstError(errs, [
        { key: "login-email", id: "login-email" },
        { key: "login-password", id: "login-password" },
      ])
    )
      return;
    setBusy(true);
    try {
      const u = await login(email, password);
      toast({ title: `Welcome back, ${u.name.split(" ")[0]}!` });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // ── Create account ──
  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: FieldErrors = {};
    if (name.trim().length < 2) errs["reg-name"] = "Enter your full name (2+ characters)";
    if (!email.trim()) errs["reg-email"] = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errs["reg-email"] = "Enter a valid email address";
    if (password.length < 8) errs["reg-password"] = "Password must be at least 8 characters";
    setErrors(errs);
    if (
      focusFirstError(errs, [
        { key: "reg-name", id: "reg-name" },
        { key: "reg-email", id: "reg-email" },
        { key: "reg-password", id: "reg-password" },
      ])
    )
      return;
    setBusy(true);
    try {
      const u = await register({ name: name.trim(), email, password });
      toast({
        title: `Welcome to shop-891, ${u.name.split(" ")[0]}!`,
        description: "Happy shopping!",
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot password: step 1 — request a code ──
  const submitForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: FieldErrors = {};
    if (!resetEmail.trim()) errs["forgot-email"] = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(resetEmail.trim()))
      errs["forgot-email"] = "Enter a valid email address";
    setErrors(errs);
    if (focusFirstError(errs, [{ key: "forgot-email", id: "forgot-email" }]))
      return;
    setBusy(true);
    try {
      const res = await apiAuth.forgotPassword(resetEmail);
      setFlow("forgot-reset");
      toast({
        title: "Reset code sent",
        description: res.message || `Check ${resetEmail} for the 6-digit code.`,
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't send a reset code. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot password: step 2 — verify code + set new password ──
  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: FieldErrors = {};
    if (!/^\d{6}$/.test(resetCode.trim()))
      errs["forgot-code"] = "Enter the 6-digit code from the email";
    if (newPassword.length < 8)
      errs["forgot-new"] = "New password must be at least 8 characters";
    setErrors(errs);
    if (
      focusFirstError(errs, [
        { key: "forgot-code", id: "forgot-code" },
        { key: "forgot-new", id: "forgot-new" },
      ])
    )
      return;
    setBusy(true);
    try {
      await apiAuth.resetPassword(resetEmail, resetCode.trim(), newPassword);
      toast({
        title: "Password updated",
        description: "Sign in with your new password.",
      });
      // Back to the sign-in form, email prefilled.
      setEmail(resetEmail);
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setFlow("tabs");
      setTab("login");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't reset the password. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // ── Already signed in ──
  if (authReady && user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <UserCircle2 size={30} />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
          You&apos;re already signed in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="font-semibold text-foreground">{user.email}</span>.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="shine-host h-11 rounded-xl bg-gradient-primary font-bold shadow-md hover:brightness-110"
            onClick={() => navigate({ name: "profile" })}
          >
            Go to profile
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 rounded-xl font-bold"
            onClick={() => navigate({ name: "home" })}
          >
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* back */}
      <button
        type="button"
        onClick={closeAuth}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft size={15} /> Back to shopping
      </button>

      <div className="mt-5 grid items-start gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        {/* ── Brand panel ── */}
        <aside className="hidden lg:block">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="shop-891 logo"
              className="h-12 w-12 rounded-xl object-cover"
            />
            <span className="font-display text-2xl font-semibold tracking-wide">
              shop<span className="text-primary">-891</span>
            </span>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight tracking-wide xl:text-4xl">
            {tab === "register" && flow === "tabs"
              ? "Create your account"
              : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            One account for orders, wishlists, saved addresses and refunds —
            across every device you shop on.
          </p>
          <ul className="mt-7 space-y-4">
            {PERKS.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <p.icon size={17} />
                </span>
                <div>
                  <p className="text-sm font-bold">{p.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {p.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Form card ── */}
        <div className="rounded-3xl border bg-card p-5 shadow-card-3d sm:p-7">
          {/* mobile brand row */}
          <div className="mb-4 flex items-center gap-2.5 lg:hidden">
            <img
              src="/logo.png"
              alt="shop-891 logo"
              className="h-10 w-10 rounded-xl object-cover"
            />
            <span className="font-display text-lg font-semibold tracking-wide">
              shop<span className="text-primary">-891</span>
            </span>
          </div>

          {authMessage && flow === "tabs" && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-sm text-primary">
              <Info size={15} className="mt-0.5 shrink-0" />
              {authMessage}
            </div>
          )}

          {flow === "tabs" ? (
            <Tabs value={tab} onValueChange={switchTab}>
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-full bg-muted p-1">
                <TabsTrigger
                  value="login"
                  className="rounded-full text-sm font-semibold data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-full text-sm font-semibold data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                >
                  Create account
                </TabsTrigger>
              </TabsList>

              {/* ── Login ── */}
              <TabsContent value="login">
                <form onSubmit={submitLogin} noValidate className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError("login-email");
                      }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-invalid={!!errors["login-email"]}
                      className={cn(
                        "h-11 rounded-xl",
                        errorFieldClass(!!errors["login-email"])
                      )}
                    />
                    {fieldErr("login-email")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError("login-password");
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      aria-invalid={!!errors["login-password"]}
                      className={cn(
                        "h-11 rounded-xl",
                        errorFieldClass(!!errors["login-password"])
                      )}
                    />
                    {fieldErr("login-password")}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setError("");
                        setErrors({});
                        setFlow("forgot-email");
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="shine-host h-11 w-full rounded-xl bg-gradient-primary text-sm font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              {/* ── Register ── */}
              <TabsContent value="register">
                <form onSubmit={submitRegister} noValidate className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Full name</Label>
                    <Input
                      id="reg-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldError("reg-name");
                      }}
                      placeholder="Jane Cooper"
                      autoComplete="name"
                      aria-invalid={!!errors["reg-name"]}
                      className={cn(
                        "h-11 rounded-xl",
                        errorFieldClass(!!errors["reg-name"])
                      )}
                    />
                    {fieldErr("reg-name")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError("reg-email");
                      }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-invalid={!!errors["reg-email"]}
                      className={cn(
                        "h-11 rounded-xl",
                        errorFieldClass(!!errors["reg-email"])
                      )}
                    />
                    {fieldErr("reg-email")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError("reg-password");
                      }}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      aria-invalid={!!errors["reg-password"]}
                      className={cn(
                        "h-11 rounded-xl",
                        errorFieldClass(!!errors["reg-password"])
                      )}
                    />
                    {fieldErr("reg-password")}
                  </div>
                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="shine-host h-11 w-full rounded-xl bg-gradient-primary text-sm font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Create account
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => switchTab("login")}
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          ) : flow === "forgot-email" ? (
            /* ── Forgot password · step 1 ── */
            <form onSubmit={submitForgotEmail} noValidate className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <KeyRound size={17} />
                  </span>
                  Reset your password
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Enter your account email — we&apos;ll send a 6-digit
                  verification code to set a fresh password.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    clearFieldError("forgot-email");
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!errors["forgot-email"]}
                  className={cn(
                    "h-11 rounded-xl",
                    errorFieldClass(!!errors["forgot-email"])
                  )}
                />
                {fieldErr("forgot-email")}
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button
                type="submit"
                disabled={busy}
                className="shine-host h-11 w-full rounded-xl bg-gradient-primary text-sm font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Send reset code
              </Button>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setFlow("tabs");
                }}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            </form>
          ) : (
            /* ── Forgot password · step 2 ── */
            <form onSubmit={submitReset} noValidate className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <LockKeyhole size={17} />
                  </span>
                  Set a new password
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We emailed a 6-digit code to{" "}
                  <span className="font-semibold text-foreground">{resetEmail}</span>. Enter
                  it below with your new password.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="forgot-code">Verification code</Label>
                <Input
                  id="forgot-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => {
                    setResetCode(e.target.value.replace(/\D/g, ""));
                    clearFieldError("forgot-code");
                  }}
                  placeholder="6-digit code"
                  aria-invalid={!!errors["forgot-code"]}
                  className={cn(
                    "h-11 rounded-xl tracking-[0.35em]",
                    errorFieldClass(!!errors["forgot-code"])
                  )}
                />
                {fieldErr("forgot-code")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-new">New password</Label>
                <Input
                  id="forgot-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearFieldError("forgot-new");
                  }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={!!errors["forgot-new"]}
                  className={cn(
                    "h-11 rounded-xl",
                    errorFieldClass(!!errors["forgot-new"])
                  )}
                />
                {fieldErr("forgot-new")}
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button
                type="submit"
                disabled={busy}
                className="shine-host h-11 w-full rounded-xl bg-gradient-primary text-sm font-bold shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Reset password
              </Button>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setFlow("forgot-email");
                }}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft size={13} /> Use a different email
              </button>
            </form>
          )}

          <Separator className="mt-6" />
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to shop-891&apos;s Terms of Service and
            Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
