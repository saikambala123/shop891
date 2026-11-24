// ──────────────────────────────────────────────────────────────
// ShopVerse — Client-side image compression for uploads
// Phone photos are often 3–8MB. Serverless platforms cap request
// bodies (~4.5MB) and mobile networks are slow, so big photos are
// downscaled to ≤1600px JPEG before they ever hit /api/upload.
// GIFs are skipped (animation), as are files that are already small.
// ──────────────────────────────────────────────────────────────

const MAX_DIMENSION = 1600;
const QUALITY = 0.85;
/** Files below this size are uploaded untouched. */
const SKIP_BELOW_BYTES = 300 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size <= SKIP_BELOW_BYTES) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Unsupported format (e.g. HEIC on Chrome) or decode failure —
    // hand the original to the server and let it decide.
    return file;
  }
}
