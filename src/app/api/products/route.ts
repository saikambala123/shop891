import { NextRequest, NextResponse } from "next/server";
import { Product, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  asString,
  authenticate,
  containsRegex,
  generateUniqueSlug,
  jsonError,
  parsePositiveFloat,
  readJson,
  serializeProduct,
  toPlacementsArray,
  toSpecsArray,
  toStringArray,
} from "@/lib/api-utils";
import { PLACEMENTS } from "@/lib/types";

export const dynamic = "force-dynamic";

// ── GET /api/products — public catalog listing ────────────────

function sortOrderBy(sort: string | null | undefined): Record<string, 1 | -1> {
  switch (sort) {
    case "newest":
      return { createdAt: -1 };
    case "price_asc":
      return { price: 1 };
    case "price_desc":
      return { price: -1 };
    case "rating":
      return { rating: -1, reviewCount: -1 };
    case "popular":
    default:
      return { soldCount: -1, reviewCount: -1 };
  }
}

function csvList(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const search = sp.get("search")?.trim() || undefined;
    const category = sp.get("category")?.trim() || undefined;
    const brands = csvList(sp.get("brands"));
    const minPrice = parsePositiveFloat(sp.get("minPrice"));
    const maxPrice = parsePositiveFloat(sp.get("maxPrice"));
    const minRating = parsePositiveFloat(sp.get("minRating"));
    const inStock = sp.get("inStock") === "true";
    const placementRaw = sp.get("placement")?.trim() || undefined;
    const placement =
      placementRaw && (PLACEMENTS as readonly string[]).includes(placementRaw)
        ? placementRaw
        : undefined;
    const sort = sp.get("sort");
    const mine = sp.get("mine") === "true";
    const ids = csvList(sp.get("ids"));

    const and: Record<string, unknown>[] = [];

    if (mine) {
      // Admin dashboard: everything incl. inactive.
      // `ids` is ignored when mine=true.
      const session = await getSession(req);
      if (!session) return jsonError("Not authenticated", 401);
      if (session.role !== "ADMIN") {
        return jsonError("Forbidden", 403);
      }
    } else {
      and.push({ isActive: true });
      if (ids) {
        // Exact id fetch: no pagination. Invalid/stale ids are skipped.
        and.push({ _id: { $in: ids.map((i) => oid(i)).filter(Boolean) } });
      }
    }

    if (search) {
      const re = containsRegex(search);
      and.push({ $or: [{ name: re }, { description: re }, { brand: re }, { tags: re }] });
    }
    if (category) and.push({ category });
    if (brands) and.push({ brand: { $in: brands } });
    if (minPrice !== null) and.push({ price: { $gte: minPrice } });
    if (maxPrice !== null) and.push({ price: { $lte: maxPrice } });
    if (minRating !== null) and.push({ rating: { $gte: minRating } });
    if (inStock) and.push({ stock: { $gt: 0 } });
    if (placement) and.push({ placements: placement });

    const where = and.length ? { $and: and } : {};

    let page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1);
    let limit = Number.parseInt(sp.get("limit") || "12", 10) || 12;
    if (limit < 1) limit = 12;
    limit = Math.min(500, limit);

    if (ids && !mine) {
      // Exact id fetch: no pagination.
      limit = ids.length;
      page = 1;
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(where),
      Product.find(where)
        .sort(sortOrderBy(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      products: products.map(serializeProduct),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
    });
  } catch (err) {
    console.error("[api/products GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/products — create (ADMIN only) ─────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const name = asString((body as any).name).trim();
    if (!name) return jsonError("Name is required", 400);
    const description = asString((body as any).description).trim();
    if (!description) return jsonError("Description is required", 400);
    const category = asString((body as any).category).trim();
    if (!category) return jsonError("Category is required", 400);
    const brand = asString((body as any).brand).trim();
    if (!brand) return jsonError("Brand is required", 400);

    const price = Number((body as any).price);
    if (!Number.isFinite(price) || price <= 0) {
      return jsonError("Price must be greater than 0", 400);
    }

    let compareAtPrice: number | null = null;
    if ((body as any).compareAtPrice !== undefined && (body as any).compareAtPrice !== null) {
      compareAtPrice = Number((body as any).compareAtPrice);
      if (!Number.isFinite(compareAtPrice) || compareAtPrice <= 0) {
        return jsonError("Compare-at price must be greater than 0", 400);
      }
    }

    const stock =
      (body as any).stock === undefined || (body as any).stock === null
        ? 0
        : Math.trunc(Number((body as any).stock));
    if (!Number.isFinite(stock) || stock < 0) {
      return jsonError("Stock must be 0 or more", 400);
    }

    const isDigital = Boolean((body as any).isDigital);
    const images = toStringArray((body as any).images);
    const highlights = toStringArray((body as any).highlights);
    const specs = toSpecsArray((body as any).specs);
    const tags = toStringArray((body as any).tags);
    const placements = toPlacementsArray((body as any).placements);
    const isActive =
      (body as any).isActive === undefined
        ? true
        : Boolean((body as any).isActive);

    await connectDB();

    const slug = await generateUniqueSlug(name);

    await Product.create({
      slug,
      name,
      description,
      category,
      brand,
      price,
      compareAtPrice,
      images,
      highlights,
      specs,
      tags,
      stock,
      isDigital,
      isActive,
      placements,
    });

    const created = await Product.findOne({ slug }).lean();

    return NextResponse.json(
      { product: serializeProduct(created) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/products POST]", err);
    return jsonError("Internal server error", 500);
  }
}
