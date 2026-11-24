import { NextRequest, NextResponse } from "next/server";
import { Product, Review, connectDB, oid } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  asString,
  jsonError,
  readJson,
  round2,
  serializeProduct,
  serializeReview,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// ── GET /api/reviews?productId=... — public, newest first ─────

export async function GET(req: NextRequest) {
  try {
    const productId = req.nextUrl.searchParams.get("productId")?.trim();
    if (!productId) return jsonError("productId is required", 400);

    await connectDB();
    const productOid = oid(productId);
    if (!productOid) {
      return NextResponse.json({ reviews: [] });
    }
    const reviews = await Review.find({ product: productOid })
      .sort({ createdAt: -1 })
      .populate("user", "name")
      .lean();
    return NextResponse.json({ reviews: reviews.map(serializeReview) });
  } catch (err) {
    console.error("[api/reviews GET]", err);
    return jsonError("Internal server error", 500);
  }
}

// ── POST /api/reviews — create or update the caller's review ─

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return jsonError("Not authenticated", 401);

    const body = await readJson(req);
    if (!body || typeof body !== "object") {
      return jsonError("Invalid JSON body", 400);
    }

    const productId = asString((body as any).productId).trim();
    if (!productId) return jsonError("productId is required", 400);

    const rating = Math.trunc(Number((body as any).rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return jsonError("Rating must be between 1 and 5", 400);
    }

    const comment = asString((body as any).comment).trim();
    if (!comment) return jsonError("Comment is required", 400);

    const title = asString((body as any).title).trim() || null;

    await connectDB();
    const productOid = oid(productId);
    const product = productOid
      ? await Product.findById(productOid).lean()
      : null;
    if (!product) return jsonError("Product not found", 404);

    const userId = oid(session.userId)!;
    const review = await Review.findOneAndUpdate(
      { product: product._id, user: userId },
      { $set: { rating, title, comment } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    )
      .populate("user", "name")
      .lean();

    // Recompute product aggregates
    const agg = await Review.aggregate<{ _id: null; avg: number; count: number }>([
      { $match: { product: product._id } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      {
        $set: {
          rating: round2(agg[0]?.avg || 0),
          reviewCount: agg[0]?.count ?? 0,
        },
      },
      { returnDocument: "after" }
    ).lean();

    return NextResponse.json({
      review: serializeReview(review),
      product: serializeProduct(updatedProduct),
    });
  } catch (err) {
    console.error("[api/reviews POST]", err);
    return jsonError("Internal server error", 500);
  }
}
