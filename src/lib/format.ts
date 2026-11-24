// ──────────────────────────────────────────────────────────────
// ShopVerse — Formatting helpers (Indian Rupees / en-IN)
// ──────────────────────────────────────────────────────────────

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** ₹1,499.00 style (trailing ".00" trimmed for whole rupees). */
export function formatCurrency(value: number): string {
  return inr.format(value).replace(/\.00$/, "");
}

/** Compact Indian notation: ₹1.2k / ₹3.5L / ₹1.2Cr. */
export function formatCompactCurrency(value: number): string {
  if (value >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(value >= 10_00_00_000 ? 0 : 1)}Cr`;
  }
  if (value >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(value >= 10_00_000 ? 0 : 1)}L`;
  }
  if (value >= 1_000) {
    return `₹${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return formatCurrency(value);
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function discountPercent(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
