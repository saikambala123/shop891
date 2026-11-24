// ──────────────────────────────────────────────────────────────
// ShopVerse — Admin dashboard / Customers tab (ADMIN only)
// Debounced server-side user search, summary strip and a user
// table with role management (admin escalation guarded).
// ──────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Loader2, Search, ShieldCheck, Users, UsersRound } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiAdmin } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/types";
import type { AdminUser, Role, SessionUser } from "@/lib/types";
import { EmptyState, ErrorState, RoleBadge } from "./shared";

const ROLE_LABELS: Record<Role, string> = {
  USER: "Customer",
  ADMIN: "Admin",
};

export function CustomersTab({ user }: { user: SessionUser }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState<AdminUser | null>(null);

  // debounce the search box → server-side search param
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdmin.users(q || undefined);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(debouncedSearch);
  }, [load, debouncedSearch]);

  const customerCount = useMemo(
    () => users.filter((u) => u.role === "USER").length,
    [users]
  );
  const adminCount = useMemo(
    () => users.filter((u) => u.role === "ADMIN").length,
    [users]
  );

  const applyRole = async (target: AdminUser, role: Role) => {
    if (busyId) return;
    setBusyId(target.id);
    try {
      await apiAdmin.updateUserRole(target.id, role);
      toast({
        title: "Role updated",
        description: `${target.name} is now ${role === "ADMIN" ? "an admin" : "a customer"}.`,
      });
      await load(debouncedSearch);
    } catch (err) {
      toast({
        title: "Could not update role",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setConfirmAdmin(null);
    }
  };

  const handleRoleSelect = (target: AdminUser, role: Role) => {
    if (role === target.role) return;
    if (role === "ADMIN") {
      setConfirmAdmin(target);
      return;
    }
    applyRole(target, role);
  };

  return (
    <div className="space-y-4">
      {/* ── header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customers</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${users.length} registered account${users.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users"
            className="w-full pl-8"
          />
        </div>
      </div>

      {/* ── summary strip ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={UsersRound}
          label="Total accounts"
          value={String(users.length)}
          iconClassName="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
        />
        <SummaryCard
          icon={Users}
          label="Customers"
          value={String(customerCount)}
          iconClassName="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Admins"
          value={String(adminCount)}
          iconClassName="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
        />
      </div>

      {/* ── users table ────────────────────────────────────── */}
      {loading ? (
        <CustomersSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(debouncedSearch)} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={debouncedSearch ? "No matching accounts" : "No registered users"}
          description={
            debouncedSearch
              ? `Nothing matches “${debouncedSearch}”. Try a different name or email.`
              : "User accounts will appear here as people sign up."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Change role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === user.id;
                const busy = busyId === u.id;
                return (
                  <TableRow key={u.id} className={cn(busy && "opacity-60")}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 border">
                          <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 max-w-[240px]">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            <span className="truncate">{u.name}</span>
                            {isSelf && (
                              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{u.orderCount}</TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums">
                      {formatCurrency(u.totalSpent)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={u.role}
                          onValueChange={(v) => handleRoleSelect(u, v as Role)}
                          disabled={isSelf || busy}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-32"
                            aria-label={`Change role for ${u.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {busy && <Loader2 className="size-4 animate-spin text-orange-600" />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── admin escalation confirm ───────────────────────── */}
      <AlertDialog
        open={confirmAdmin !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAdmin(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-red-600" />
              Grant admin access?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAdmin?.name} ({confirmAdmin?.email}) will gain full control of the
              shop-891 store, including user management, products and orders.
              This is a high-privilege action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => confirmAdmin && applyRole(confirmAdmin, "ADMIN")}
            >
              Grant admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  iconClassName: string;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          iconClassName
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </div>
    </Card>
  );
}

// ── Loading skeleton ──────────────────────────────────────────
function CustomersSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading users">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="hidden h-5 w-16 sm:block" />
            <Skeleton className="hidden h-4 w-10 md:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-4 w-24 lg:block" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
