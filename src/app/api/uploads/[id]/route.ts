import { NextRequest, NextResponse } from "next/server";
import { Upload, connectDB, oid } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Normalize the binary value stored in MongoDB into raw bytes.
 * Depending on the driver path, the value arrives either as a Node
 * Buffer (hydrated doc) or as a BSON Binary ({ buffer, position }) —
 * both must be handled or the response body ends up empty.
 */
function toBytes(value: unknown): Uint8Array | null {
  if (!value) return null;
  // Node Buffer — has byteOffset / byteLength over a (possibly pooled) ArrayBuffer.
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    );
  }
  // BSON Binary — `buffer` holds the bytes, `position` is the used length.
  const bin = value as { buffer?: Uint8Array | ArrayBuffer; position?: number };
  let buf = bin.buffer;
  if (!buf) return null;
  if (buf instanceof ArrayBuffer) buf = new Uint8Array(buf);
  const end =
    typeof bin.position === "number" && bin.position > 0
      ? Math.min(bin.position, buf.byteLength)
      : buf.byteLength;
  return buf.slice(0, end);
}

// GET /api/uploads/[id] — serve an image stored in MongoDB.
// Immutable content-addressable caching keeps this cheap on CDNs.
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const uploadOid = oid(id);
    if (!uploadOid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await connectDB();
    const doc = await Upload.findById(uploadOid).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = toBytes(doc.data);
    if (!body || body.byteLength === 0) {
      console.error("[api/uploads/[id]] empty image payload for", id);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": doc.contentType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[api/uploads/[id]]", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
