// ──────────────────────────────────────────────────────────────
// One-off: generate additional gallery images (-2, -3) for a
// curated set of products so the detail-page gallery (thumbnails)
// has real multi-image content. Each extra shot shows the SAME
// product from a different angle (detail close-up / in-room
// lifestyle) so pictures never look merged or duplicated.
// Run: bun scripts/generate-gallery-extras.ts
// ──────────────────────────────────────────────────────────────
import ZAI from "z-ai-web-dev-sdk";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const OUT_DIR = join(process.cwd(), "public", "products");

interface Extra {
  slug: string;
  n: 2 | 3;
  prompt: string;
}

const EXTRAS: Extra[] = [
  // Monstera — leaf detail + living room
  {
    slug: "monstera-deliciosa-plant",
    n: 2,
    prompt:
      "Extreme close-up macro photograph of glossy monstera deliciosa leaves showing the iconic split swiss-cheese fenestrations and deep green veins, soft studio lighting, high quality, detailed",
  },
  {
    slug: "monstera-deliciosa-plant",
    n: 3,
    prompt:
      "Monstera deliciosa swiss cheese plant in a white ceramic pot standing in a bright modern living room corner beside a beige armchair, warm natural window light, interior styling photography, high quality",
  },
  // Snake plant — leaf detail + bedroom
  {
    slug: "snake-plant-sansevieria",
    n: 2,
    prompt:
      "Close-up of upright sansevieria snake plant sword leaves with sharp green and yellow variegated edges radiating from the base, matte grey ceramic pot, soft studio lighting, high quality",
  },
  {
    slug: "snake-plant-sansevieria",
    n: 3,
    prompt:
      "Snake plant sansevieria in a matte grey ceramic pot on a wooden bedside table next to a reading lamp in a cozy minimal bedroom, warm evening light, interior photography, high quality",
  },
  // Ceramic planter set — single planter detail + styled shelf
  {
    slug: "ceramic-planter-set-3",
    n: 2,
    prompt:
      "Close-up of a single matte sage green glaze ceramic planter pot with a small lush green plant inside, showing the drainage saucer and clean minimal form, product photography, soft studio lighting, high quality",
  },
  {
    slug: "ceramic-planter-set-3",
    n: 3,
    prompt:
      "Three matte glaze ceramic planters in sage green, cream and terracotta holding small plants arranged on a floating wooden shelf against a white wall, styled home decor photography, high quality",
  },
  // Cookware — pan detail + cooking scene
  {
    slug: "triply-steel-cookware-5",
    n: 2,
    prompt:
      "Close-up of a premium triply stainless steel saucepan showing the brushed steel body, riveted black handle and glass lid with steam vent, studio product photography, clean white background, high quality",
  },
  {
    slug: "triply-steel-cookware-5",
    n: 3,
    prompt:
      "Triply stainless steel cookware set in use on a modern induction cooktop with vegetables being sauteed in the pan, steam rising, warm kitchen photography, high quality",
  },
  // Salt lamp — glow detail + bedside scene
  {
    slug: "himalayan-salt-lamp",
    n: 2,
    prompt:
      "Close-up of natural Himalayan pink salt crystal lamp texture glowing warm orange from within, showing the crystalline surface detail on a wooden base, dark cozy background, high quality",
  },
  {
    slug: "himalayan-salt-lamp",
    n: 3,
    prompt:
      "Himalayan pink salt lamp glowing warmly on a wooden bedside table beside a stack of books and a candle in a cozy evening bedroom, warm ambient photography, high quality",
  },
  // Candles — single jar detail + lit scene
  {
    slug: "soy-candle-trio-set",
    n: 2,
    prompt:
      "Close-up of one luxury soy wax candle in an amber glass jar with wooden lid removed, showing the cream wax, cotton wick and dried lavender sprig beside it, warm cozy product photography, high quality",
  },
  {
    slug: "soy-candle-trio-set",
    n: 3,
    prompt:
      "Three amber glass soy candles with warm flames glowing, arranged on a wooden tray with dried lavender and a linen napkin, cozy hygge evening photography, high quality",
  },
  // Bedsheet — fabric detail + styled bed
  {
    slug: "cotton-bedsheet-queen-300tc",
    n: 2,
    prompt:
      "Macro close-up of sage green 300 thread count pure cotton bedsheet fabric showing the fine weave texture and soft natural folds, soft daylight, textile product photography, high quality",
  },
  {
    slug: "cotton-bedsheet-queen-300tc",
    n: 3,
    prompt:
      "Queen bed dressed in sage green pure cotton bedsheet set with matching pillow covers, morning sunlight across the fabric, cozy styled bedroom photography, high quality",
  },
  // Brass diya — single diya detail + festive scene
  {
    slug: "brass-diya-set-6",
    n: 2,
    prompt:
      "Close-up of a single traditional Indian brass diya oil lamp with a glowing cotton wick flame and marigold petals around it, warm festive light, dark background, high quality",
  },
  {
    slug: "brass-diya-set-6",
    n: 3,
    prompt:
      "Six brass diya oil lamps with warm glowing flames arranged in a neat row on a dark wooden table with scattered marigold flowers and rangoli pattern, Indian festival photography, high quality",
  },
];

async function main() {
  const zai = await ZAI.create();
  let ok = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const img of EXTRAS) {
    const file = join(OUT_DIR, `${img.slug}-${img.n}.jpg`);
    if (existsSync(file)) {
      skipped++;
      continue;
    }
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const res = await zai.images.generations.create({
          prompt: img.prompt,
          size: "1024x1024" as never,
        });
        const b64 = res.data?.[0]?.base64;
        if (!b64) throw new Error("empty response");
        writeFileSync(file, Buffer.from(b64, "base64"));
        ok++;
        console.log(`[${ok + skipped}/${EXTRAS.length}] ${img.slug}-${img.n}.jpg`);
        done = true;
      } catch (e) {
        console.error(`  ! ${img.slug}-${img.n} attempt ${attempt}: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (!done) failures.push(`${img.slug}-${img.n}`);
  }

  console.log(`Done. Generated: ${ok}, skipped: ${skipped}, failed: ${failures.length}`);
  if (failures.length) console.log("Failed:", failures.join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
