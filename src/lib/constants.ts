// ──────────────────────────────────────────────────────────────
// ShopVerse — Shared UI constants
// ──────────────────────────────────────────────────────────────
import {
  Baby,
  BedDouble,
  BookOpen,
  Boxes,
  Brush,
  CookingPot,
  Dumbbell,
  Flower,
  Footprints,
  Gamepad2,
  Guitar,
  Hammer,
  HeartPulse,
  Lamp,
  Laptop,
  NotebookPen,
  PawPrint,
  Scissors,
  ShoppingBasket,
  Shirt,
  Smartphone,
  Sparkles,
  Sprout,
  TreeDeciduous,
  Tv,
  Watch,
  type LucideIcon,
} from "lucide-react";
import type { ProductSort } from "@/lib/types";

export interface CategoryMeta {
  id: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

// Amazon-style department list — 26 categories, ordered by popularity.
export const CATEGORY_META: CategoryMeta[] = [
  { id: "Mobiles & Tablets", label: "Mobiles & Tablets", icon: Smartphone, blurb: "Latest 5G phones, tablets & audio" },
  { id: "Electronics & TV", label: "Electronics & TV", icon: Tv, blurb: "Smart TVs, soundbars & cameras" },
  { id: "Laptops & Computers", label: "Laptops & Computers", icon: Laptop, blurb: "Ultrabooks, SSDs & peripherals" },
  { id: "Men's Fashion", label: "Men's Fashion", icon: Shirt, blurb: "Shirts, tees & trousers" },
  { id: "Women's Fashion", label: "Women's Fashion", icon: Scissors, blurb: "Kurtis, sarees & dresses" },
  { id: "Footwear & Bags", label: "Footwear & Bags", icon: Footprints, blurb: "Sneakers, runners & backpacks" },
  { id: "Watches & Jewellery", label: "Watches & Jewellery", icon: Watch, blurb: "Timepieces & silver jewels" },
  { id: "Beauty & Personal Care", label: "Beauty & Personal Care", icon: Brush, blurb: "Skincare, haircare & styling" },
  { id: "Health & Wellness", label: "Health & Wellness", icon: HeartPulse, blurb: "Nutrition, vitamins & monitors" },
  { id: "Home & Kitchen", label: "Home & Kitchen", icon: CookingPot, blurb: "Cook, serve & dine in style" },
  { id: "Home Decor", label: "Home Decor", icon: Lamp, blurb: "Lighting, accents & art" },
  { id: "Storage & Organization", label: "Storage & Organization", icon: Boxes, blurb: "Declutter every corner" },
  { id: "Bedding & Bath", label: "Bedding & Bath", icon: BedDouble, blurb: "Cozy comfort & soft towels" },
  { id: "Cleaning & Essentials", label: "Cleaning & Essentials", icon: Sparkles, blurb: "Everyday care for your home" },
  { id: "Indoor Plants", label: "Indoor Plants", icon: Sprout, blurb: "Air-purifying greens for every room" },
  { id: "Outdoor & Garden", label: "Outdoor & Garden", icon: TreeDeciduous, blurb: "Seeds, tools & garden care" },
  { id: "Planters & Pots", label: "Planters & Pots", icon: Flower, blurb: "Ceramic, terracotta & hanging" },
  { id: "Grocery & Gourmet", label: "Grocery & Gourmet", icon: ShoppingBasket, blurb: "Oils, rice, masalas & more" },
  { id: "Books & Media", label: "Books & Media", icon: BookOpen, blurb: "Novels, guides & encyclopedias" },
  { id: "Toys & Games", label: "Toys & Games", icon: Gamepad2, blurb: "Building sets, puzzles & RC" },
  { id: "Baby & Kids", label: "Baby & Kids", icon: Baby, blurb: "Wraps, high chairs & feeding" },
  { id: "Sports & Fitness", label: "Sports & Fitness", icon: Dumbbell, blurb: "Gym gear, yoga & cricket" },
  { id: "Pet Supplies", label: "Pet Supplies", icon: PawPrint, blurb: "Food, beds & cat trees" },
  { id: "Stationery & Office", label: "Stationery & Office", icon: NotebookPen, blurb: "Pens, journals & desk lamps" },
  { id: "Tools & DIY", label: "Tools & DIY", icon: Hammer, blurb: "Tool kits, screwdrivers & levels" },
  { id: "Musical Instruments", label: "Musical Instruments", icon: Guitar, blurb: "Guitars, keyboards & tabla" },
];

export function categoryMeta(id: string): CategoryMeta {
  return (
    CATEGORY_META.find((c) => c.id === id) ?? {
      id,
      label: id,
      icon: Sparkles,
      blurb: "",
    }
  );
}

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "popular", label: "Popularity" },
  { value: "newest", label: "Newest arrivals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Avg. customer rating" },
];

export const PLACEHOLDER_IMAGE = "/placeholder.svg";

/**
 * Compact variant of a product image for cards, rails and hero tiles.
 * Maps /products/foo.jpg → /products/thumbs/foo.jpg (480px, ~73% lighter);
 * anything else (uploads, placeholders) is returned untouched.
 * Run `bun scripts/make-thumbs.ts` after adding new product images.
 */
export function productThumb(image: string | undefined | null): string {
  if (!image) return PLACEHOLDER_IMAGE;
  const m = image.match(/^\/products\/(.+)\.(jpe?g|png|webp)$/i);
  if (!m) return image;
  return `/products/thumbs/${m[1]}.jpg`;
}
