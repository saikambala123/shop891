// ──────────────────────────────────────────────────────────────
// shop-891 — Thumbnail generator
// Creates compact 480px-wide JPEG copies of every product image in
// public/products → public/products/thumbs. Product cards, rails and
// the home hero serve these thumbnails (≈6-10× smaller than the
// originals), which is the single biggest dashboard load-time win.
// Run with: bun scripts/make-thumbs.ts
// ──────────────────────────────────────────────────────────────
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC_DIR = path.join(process.cwd(), "public", "products");
const OUT_DIR = path.join(SRC_DIR, "thumbs");
const THUMB_WIDTH = 480;
const QUALITY = 78;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f)
  );

  let made = 0;
  let skipped = 0;
  let savedBytes = 0;

  for (const file of files) {
    const srcPath = path.join(SRC_DIR, file);
    const outName = file.replace(/\.(jpe?g|png|webp)$/i, ".jpg");
    const outPath = path.join(OUT_DIR, outName);

    // idempotent: skip when the thumb already exists and is fresh
    try {
      const [srcStat, outStat] = await Promise.all([stat(srcPath), stat(outPath)]);
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    } catch {
      // missing thumb → create it
    }

    const srcSize = (await stat(srcPath)).size;
    const buffer = await sharp(srcPath)
      .rotate() // respect EXIF orientation
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
      .toBuffer();

    await writeFile(outPath, buffer);
    made++;
    savedBytes += Math.max(0, srcSize - buffer.length);
  }

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log(`Thumbnails: ${made} created, ${skipped} up-to-date (saved ~${mb(savedBytes)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
