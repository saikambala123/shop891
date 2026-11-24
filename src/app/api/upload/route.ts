import { NextRequest, NextResponse } from "next/server";
import { Upload, connectDB, idOf } from "@/lib/db";
import { authenticate, jsonError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// POST /api/upload — multipart image upload (ADMIN).
// Images are stored in MongoDB and served from /api/uploads/[id],
// so this works on read-only serverless filesystems (e.g. Vercel).
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req, ["ADMIN"]);
    if (auth.error) return auth.error;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonError("Invalid form data", 400);
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return jsonError("No file provided", 400);
    }

    if (!ALLOWED_TYPES[file.type]) {
      return jsonError("Invalid file type", 400);
    }
    if (file.size > MAX_SIZE) {
      return jsonError("File too large (max 5MB)", 400);
    }

    await connectDB();
    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await Upload.create({
      data: buffer,
      contentType: file.type,
    });

    return NextResponse.json({ url: `/api/uploads/${idOf(doc._id)}` });
  } catch (err) {
    console.error("[api/upload]", err);
    return jsonError("Internal server error", 500);
  }
}
