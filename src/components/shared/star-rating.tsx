// ──────────────────────────────────────────────────────────────
// ShopVerse — Star rating display (with optional review count)
// ──────────────────────────────────────────────────────────────
"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  value,
  count,
  size = 14,
  showValue = false,
  className,
}: StarRatingProps) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-0.5" aria-label={`Rated ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <Star
              key={i}
              width={size}
              height={size}
              className={cn(
                "shrink-0",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : half
                    ? "fill-amber-400/50 text-amber-400"
                    : "fill-muted text-muted-foreground/30"
              )}
            />
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-foreground">{value.toFixed(1)}</span>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
}
