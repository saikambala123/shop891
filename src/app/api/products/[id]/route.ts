import { NextRequest, NextResponse } from "next/server";
import {
  CartItem,
  Order,
  Product,
  Review,
  WishlistItem,
  connectDB,
  oid,
} from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  asString,
  generateUniqueSlug,
  jsonError,
  readJson,
  serializeProduct,
  toPlacementsArray,
  toSpecsArray,
  toStringArray,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadProduct(idOrSlug: string) {
  // Try ObjectId first, then fall back to slug.
  const byId = oid(idOrSlug);
  if (byId) {
    const p = await Product.findById(byId).lean();
    if (p) return p;
  }
  return Product.findOne({ slug: idOrSlug }).lean();
}

// ── GET /api/products/[id] — by id or slug ────────────────────

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await connectDB();
    const { id } = await ctx.params;
    const product = await loadProduct(id);
    if (!product) return jsonError("Product not found", 404);
    return NextResponse.json({ product: serializeProduct(product) });
  } catch (err) {
    console.error("[api/products/[id] GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── PUT /api/products/[id] — update (ADMIN only) ──────────────

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const productOid = oid(id);
    const product = productOid
      ? await Product.findById(productOid).lean()
      : null;
    if (!product) return jsonError("Product not found", 404);

    if (session.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const data: Record<string, unknown> = {};

    const name = asString((body as any).name).trim();
    if ("name" in (body as any)) {
      if (!name) return jsonError("Name is required", 400);
      data.name = name;
    }
    if ("description" in (body as any)) {
      const description = asString((body as any).description).trim();
      if (!description) return jsonError("Description is required", 400);
      data.description = description;
    }
    if ("category" in (body as any)) {
      const category = asString((body as any).category).trim();
      if (!category) return jsonError("Category is required", 400);
      data.category = category;
    }
    if ("brand" in (body as any)) {
      const brand = asString((body as any).brand).trim();
      if (!brand) return jsonError("Brand is required", 400);
      data.brand = brand;
    }
    if ("price" in (body as any)) {
      const price = Number((body as any).price);
      if (!Number.isFinite(price) || price <= 0) {
        return jsonError("Price must be greater than 0", 400);
      }
      data.price = price;
    }
    if ("compareAtPrice" in (body as any)) {
      const raw = (body as any).compareAtPrice;
      if (raw === null || raw === undefined || raw === "") {
        data.compareAtPrice = null;
      } else {
        const compareAtPrice = Number(raw);
        if (!Number.isFinite(compareAtPrice) || compareAtPrice <= 0) {
          return jsonError("Compare-at price must be greater than 0", 400);
        }
        data.compareAtPrice = compareAtPrice;
      }
    }
    if ("stock" in (body as any)) {
      const stock = Math.trunc(Number((body as any).stock));
      if (!Number.isFinite(stock) || stock < 0) {
        return jsonError("Stock must be 0 or more", 400);
      }
      data.stock = stock;
    }
    if ("isDigital" in (body as any)) data.isDigital = Boolean((body as any).isDigital);
    if ("isActive" in (body as any)) data.isActive = Boolean((body as any).isActive);
    if ("images" in (body as any)) data.images = toStringArray((body as any).images);
    if ("highlights" in (body as any)) data.highlights = toStringArray((body as any).highlights);
    if ("specs" in (body as any)) data.specs = toSpecsArray((body as any).specs);
    if ("tags" in (body as any)) data.tags = toStringArray((body as any).tags);
    if ("placements" in (body as any)) data.placements = toPlacementsArray((body as any).placements);

    // Regenerate the slug only when the name actually changes.
    if (typeof data.name === "string" && data.name !== product.name) {
      data.slug = await generateUniqueSlug(data.name, String(product._id));
    }

    const updated = await Product.findByIdAndUpdate(
      product._id,
      { $set: data },
      { returnDocument: "after" }
    ).lean();

    return NextResponse.json({ product: serializeProduct(updated) });
  } catch (err) {
    console.error("[api/products/[id] PUT]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── DELETE /api/products/[id] — hard delete (ADMIN only) ──────

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    await connectDB();
    const productOid = oid(id);
    const product = productOid
      ? await Product.findById(productOid).lean()
      : null;
    if (!product) return jsonError("Product not found", 404);

    if (session.role !== "ADMIN") {
      return jsonError("Forbidden", 403);
    }

    // Cascade: carts / wishlists / reviews reference the product;
    // order items keep their snapshot but drop the product link.
    await Product.deleteOne({ _id: product._id });
    await Promise.all([
      CartItem.deleteMany({ product: product._id }),
      WishlistItem.deleteMany({ product: product._id }),
      Review.deleteMany({ product: product._id }),
      Order.updateMany(
        { "items.product": product._id },
        { $set: { "items.$[elem].product": null } },
        { arrayFilters: [{ "elem.product": product._id }] }
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/products/[id] DELETE]", err);
    return jsonError("Internal server error", 500);
  }
}
