// One-off: localize seed product images into public/products/ so the
// deployed app is fully self-contained (no external CDN dependency).
// Rewrites src/lib/seed-images.json to point at the local copies.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { extname, join } from "path";

const ROOT = "/home/z/my-project";
const OUT_DIR = join(ROOT, "public", "products");
const MAP_FILE = join(ROOT, "src", "lib", "seed-images.json");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const seedImages: Record<string, string[]> = JSON.parse(
  readFileSync(MAP_FILE, "utf-8")
);

const result: Record<string, string[]> = {};
let ok = 0;
let failed = 0;

for (const [slug, urls] of Object.entries(seedImages)) {
  const localPaths: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let ext = extname(new URL(url).pathname).toLowerCase() || ".jpg";
    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) ext = ".jpg";
    const file = join(OUT_DIR, `${slug}-${i + 1}${ext}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 1000) throw new Error("suspiciously small");
      writeFileSync(file, buf);
      localPaths.push(`/products/${slug}-${i + 1}${ext}`);
      ok++;
    } catch (e) {
      // Keep the remote URL as a fallback so seeding never breaks.
      console.error(`  ! ${slug}-${i + 1}: ${(e as Error).message} (keeping remote URL)`);
      localPaths.push(url);
      failed++;
    }
  }
  result[slug] = localPaths;
}

writeFileSync(MAP_FILE, JSON.stringify(result, null, 2));
console.log(`Localized ${ok} images (${failed} kept as remote fallbacks).`);
