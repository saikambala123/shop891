// ──────────────────────────────────────────────────────────────
// One-off: generate all product images for the plants & home
// essentials catalog into public/products/{slug}-1.jpg
// Run: bun scripts/generate-images.ts
// ──────────────────────────────────────────────────────────────
import ZAI from "z-ai-web-dev-sdk";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const OUT_DIR = join(process.cwd(), "public", "products");

const STYLE = "professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed";

interface Img {
  slug: string;
  prompt: string;
  size?: string;
}

const IMAGES: Img[] = [
  // ── Indoor Plants ──
  { slug: "monstera-deliciosa-plant", prompt: "Healthy monstera deliciosa swiss cheese plant with glossy split leaves in a white ceramic pot, professional plant nursery photography, soft studio lighting, clean light background, high quality" },
  { slug: "snake-plant-sansevieria", prompt: "Snake plant sansevieria with upright variegated green and yellow sword leaves in a matte grey ceramic pot, professional plant photography, soft studio lighting, clean light background, high quality" },
  { slug: "golden-pothos-money-plant", prompt: "Golden pothos money plant with trailing variegated heart-shaped leaves in a white hanging pot, professional plant photography, soft studio lighting, clean light background, high quality" },
  { slug: "peace-lily-spathiphyllum", prompt: "Peace lily spathiphyllum with elegant white spathes and lush dark green leaves in a cream ceramic pot, professional plant photography, soft studio lighting, clean light background, high quality" },
  { slug: "areca-palm-dypsis", prompt: "Areca palm with feathery arching green fronds in a terracotta pot, professional plant photography, soft studio lighting, clean light background, high quality" },
  { slug: "jade-plant-crassula", prompt: "Jade plant crassula ovata with thick glossy oval green leaves in a small terracotta pot, professional plant photography, soft studio lighting, clean light background, high quality" },
  // ── Outdoor & Garden ──
  { slug: "hybrid-rose-plant-pack-2", prompt: "Two potted desi hybrid rose plants with vibrant red and pink blooms in nursery pots side by side, professional plant nursery photography, soft studio lighting, clean background, high quality" },
  { slug: "vegetable-seeds-kit-12", prompt: "Kitchen garden vegetable seeds kit with colorful seed packets and fresh tomatoes, carrots, chilies and coriander arranged around, flat lay photography, clean light background, high quality" },
  { slug: "marigold-genda-flower-seeds", prompt: "Bright orange marigold genda flowers with a kraft seed packet beside them, product photography, clean light background, high quality" },
  { slug: "garden-tool-set-5", prompt: "Five piece stainless steel garden tool set with wooden handles, trowel, pruner, rake and spade in a canvas tote bag, product photography, clean light background, high quality" },
  { slug: "cocopeat-potting-mix-5kg", prompt: "Bag of organic cocopeat potting mix with a scoop of brown coco peat and a small seedling beside it, product photography, clean background, high quality" },
  // ── Planters & Pots ──
  { slug: "ceramic-planter-set-3", prompt: "Set of three matte glaze ceramic planters in sage green, cream and terracotta tones with small green plants inside, product photography, soft studio lighting, clean background, high quality" },
  { slug: "terracotta-pot-set-6", prompt: "Set of six traditional terracotta clay plant pots in assorted sizes in an artful arrangement, product photography, warm natural light, clean background, high quality" },
  { slug: "hanging-macrame-planters-2", prompt: "Two cotton macrame hanging planters with woven knot details holding small trailing potted plants, boho style product photography, clean light background, high quality" },
  { slug: "self-watering-planter-xl", prompt: "Large XL self-watering planter pot in modern white and green design with water level indicator and a healthy green plant, product photography, clean background, high quality" },
  // ── Home & Kitchen ──
  { slug: "triply-steel-cookware-5", prompt: "Premium triply stainless steel cookware set of five pots and pans with glass lids and black handles, product photography, studio lighting, clean white background, high quality" },
  { slug: "nonstick-dosa-tawa-30", prompt: "Non-stick dosa tawa flat griddle pan with a perfect golden crispy dosa crepe and batter bowl beside it, Indian kitchen product photography, clean light background, high quality" },
  { slug: "ceramic-dinner-set-24", prompt: "Hand-painted ceramic dinner set with blue and white floral pattern, plates, bowls and serving dishes arranged on a wooden table, product photography, high quality" },
  { slug: "insulated-casserole-set-3", prompt: "Set of three insulated casserole serving pots in pastel mint, cream and pink with stainless steel interiors and gentle steam, product photography, clean light background, high quality" },
  { slug: "airtight-storage-jars-10", prompt: "Set of ten airtight glass storage jars with bamboo lids filled with pulses, rice, pasta and colorful spices on an organized kitchen shelf, product photography, high quality" },
  // ── Home Decor ──
  { slug: "brass-diya-set-6", prompt: "Set of six traditional Indian brass diya oil lamps with glowing warm flames arranged in a row, festive product photography, warm light, clean dark background, high quality" },
  { slug: "mandala-wall-tapestry", prompt: "Colorful mandala printed wall tapestry in orange, teal and pink hanging on a white wall above a bed with cushions, boho home decor photography, high quality" },
  { slug: "soy-candle-trio-set", prompt: "Three luxury scented soy wax candles in amber glass jars with wooden lids and dried lavender beside them, product photography, cozy warm lighting, high quality" },
  { slug: "himalayan-salt-lamp", prompt: "Natural Himalayan pink salt lamp with warm orange glow on a wooden base, product photography, cozy dark background, high quality" },
  { slug: "ceramic-bud-vase-trio", prompt: "Three matte ceramic bud vases in cream, sage and blush tones each holding a single dried flower stem, minimalist home decor product photography, high quality" },
  // ── Storage & Organization ──
  { slug: "bamboo-bathroom-shelf", prompt: "Three tier bamboo bathroom organizer shelf with folded towels, small plants and toiletries, spa-like bathroom product photography, high quality" },
  { slug: "under-bed-storage-bags-2", prompt: "Two large vacuum-seal under-bed storage bags, one compressed with comforters and clothes, tidy bedroom product photography, high quality" },
  { slug: "wardrobe-organizer-set-6", prompt: "Set of six fabric wardrobe organizer storage boxes with label windows and neatly folded clothes inside an organized closet, product photography, high quality" },
  { slug: "shoe-rack-5-tier", prompt: "Modern five tier open shoe rack with sneakers and formal shoes neatly arranged, entryway furniture product photography, clean background, high quality" },
  // ── Bedding & Bath ──
  { slug: "cotton-bedsheet-queen-300tc", prompt: "Luxurious 300 thread count pure cotton bedsheet set in sage green with matching pillow covers on a queen bed, cozy bedroom photography, soft natural light, high quality" },
  { slug: "microfiber-comforter-queen", prompt: "Fluffy reversible microfiber comforter in teal and grey draped on a queen bed with pillows, cozy bedroom product photography, high quality" },
  { slug: "cotton-towel-set-6", prompt: "Neatly folded stack of six combed cotton bath towels in warm beige, terracotta and white tones, spa style product photography, high quality" },
  { slug: "memory-foam-pillow-2", prompt: "Two contour memory foam pillows with breathable mesh covers arranged on a bed, product photography, clean bedroom, high quality" },
  // ── Cleaning & Essentials ──
  { slug: "microfiber-cleaning-cloth-12", prompt: "Rolled and stacked colorful microfiber cleaning cloths in green, blue, yellow and pink, product photography, clean light background, high quality" },
  { slug: "spin-mop-360-system", prompt: "360 degree spin mop with bucket and foot-pedal wringer system and microfiber mop head, home cleaning product photography, clean background, high quality" },
  { slug: "natural-dishwash-refill-2", prompt: "Two large natural dishwash liquid refill bottles with lemon and neem botanical extracts, with a sponge and fresh lemons, product photography, clean background, high quality" },
  // ── Hero / lifestyle ──
  { slug: "hero-living-room", size: "1440x720", prompt: "Bright airy modern living room with lush indoor plants, monstera and areca palms in ceramic planters, rattan furniture, warm sunlight through sheer curtains, cream and terracotta tones with green accents, interior design photography, high quality" },
  { slug: "hero-kitchen", size: "864x1152", prompt: "Warm modern kitchen corner with ceramic planters of fresh herbs, aloe vera and pothos on open wooden shelves, terracotta and cream tones, soft morning light, interior photography, high quality" },
];

async function main() {
  const zai = await ZAI.create();
  let ok = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const img of IMAGES) {
    const file = join(OUT_DIR, `${img.slug}-1.jpg`);
    if (existsSync(file)) {
      skipped++;
      continue;
    }
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const res = await zai.images.generations.create({
          prompt: img.prompt,
          size: (img.size ?? "1024x1024") as never,
        });
        const b64 = res.data?.[0]?.base64;
        if (!b64) throw new Error("empty response");
        writeFileSync(file, Buffer.from(b64, "base64"));
        ok++;
        console.log(`[${ok + skipped}/${IMAGES.length}] ${img.slug}-1.jpg`);
        done = true;
      } catch (e) {
        console.error(`  ! ${img.slug} attempt ${attempt}: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (!done) failures.push(img.slug);
  }

  console.log(`Done. Generated: ${ok}, skipped (existing): ${skipped}, failed: ${failures.length}`);
  if (failures.length) console.log("Failed slugs:", failures.join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
