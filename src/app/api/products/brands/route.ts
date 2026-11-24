import { NextResponse } from "next/server";
import { Product, connectDB } from "@/lib/db";
import { jsonError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// GET /api/products/brands — distinct brands among active products
export async function GET() {
  try {
    await connectDB();
    const brands = await Product.distinct("brand", { isActive: true });
    return NextResponse.json({ brands: brands.sort((a, b) => a.localeCompare(b)) });
  } catch (err) {
    console.error("[api/products/brands]", err);
    return jsonError("Internal server error", 500);
  }
}
