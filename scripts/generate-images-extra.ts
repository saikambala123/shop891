// ──────────────────────────────────────────────────────────────
// One-off: generate all product images for the marketplace
// expansion catalog (SEED_PRODUCTS_EXTRA) into
// public/products/{slug}-1.jpg — 5 images at a time.
// Run: bun scripts/generate-images-extra.ts
// ──────────────────────────────────────────────────────────────
import ZAI from "z-ai-web-dev-sdk";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { SEED_PRODUCTS_EXTRA } from "../src/lib/seed-products-new";

const OUT_DIR = join(process.cwd(), "public", "products");
const SIZE = "1024x1024";
const CONCURRENCY = 2;

// Detailed product-photography prompts, keyed by slug.
const PROMPTS: Record<string, string> = {
  // ── Mobiles & Tablets ──
  "voltra-v12-5g-smartphone":
    "Sleek modern 5G smartphone with glossy gradient blue back panel and a triple camera module, standing upright with the vivid 120Hz AMOLED screen glowing showing a colorful abstract wallpaper, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "zentech-tab-s11-tablet":
    "Modern 11-inch tablet with slim bezels displaying a colorful digital art canvas on screen, a stylus pen resting diagonally beside it and a folded magnetic stand, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "voltra-soundpods-tws":
    "Premium true wireless earbuds in a compact matte black charging case with the lid open showing both glossy earbuds with metallic accents, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Electronics & TV ──
  "aurex-43-4k-smart-tv":
    "43 inch 4K ultra HD smart LED television with slim bezel-less design displaying a vivid colorful nature documentary screen, standing on a minimal wooden media console, professional e-commerce product photography, soft studio lighting, clean light background, high quality, detailed",
  "sonique-boombar-200-soundbar":
    "Sleek black soundbar with fabric mesh grille and brushed metal accents placed on a wooden TV console with a compact wired subwoofer beside it, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "lumina-actioncam-4k-kit":
    "Compact rugged action camera with round lens and small screen, displayed with assorted mounts, spare battery and memory card neatly arranged around it, adventure gear product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Laptops & Computers ──
  "novabyte-ultrabook-14-i5":
    "Slim silver aluminium ultrabook laptop open at an angle showing a thin bezel display with a colorful screen and backlit keyboard, ultra-thin profile emphasised, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "novabyte-mk300-mechanical-keyboard-combo":
    "Compact tenkeyless mechanical keyboard with rainbow backlit keys and a honeycomb shell gaming mouse beside it, angled hero shot, gaming gear product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "novabyte-bolt-1tb-nvme-ssd":
    "M.2 NVMe solid state drive stick with black PCB, graphene heatsink label and visible gold connectors, macro tech product shot, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Men's Fashion ──
  "urbanthread-slim-fit-formal-shirt":
    "Neatly folded crisp white slim fit formal cotton shirt with semi-spread collar on a light wooden surface, a navy silk tie resting beside it, apparel product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "deckline-crew-tee-3-pack":
    "Three folded crew neck t-shirts in black, white and navy stacked neatly with the top one displayed flat showing its ribbed collar, apparel product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "urbanthread-stretch-chinos":
    "Pair of beige slim fit chino trousers neatly folded showing a flat front and clean stitching with a brown leather belt coiled on top, apparel product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Women's Fashion ──
  "mirai-rayon-anarkali-kurti":
    "Elegant flowing rayon Anarkali kurti in teal blue with printed floral pattern and a flared silhouette displayed on a mannequin, Indian ethnic fashion photography, soft studio lighting, clean light background, high quality, detailed",
  "rangoli-weaves-kanjivaram-saree":
    "Elegant Kanjivaram art silk saree in deep magenta with golden zari border and woven pallu, neatly folded with a matching blouse piece displayed beside it, Indian ethnic product photography, soft studio lighting, clean light background, high quality, detailed",
  "mirai-georgette-maxi-dress":
    "Flowy floral georgette maxi dress in pastel yellow with smocked waist on a slim mannequin, women's fashion product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Footwear & Bags ──
  "cloudstep-memory-foam-runners":
    "Pair of modern running shoes in grey and neon green with breathable knit upper and thick cushioned white sole, three-quarter angle shot, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "stepwise-vegan-sneakers":
    "Pair of clean white vegan leather low-top sneakers with minimalist design on a light grey surface, side angle shot, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "urbancarry-25l-laptop-backpack":
    "Modern grey water-resistant laptop backpack with USB charging port, padded shoulder straps and multiple compartments standing upright, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Watches & Jewellery ──
  "chronos-skeleton-automatic-watch":
    "Luxury skeleton dial automatic wrist watch with rose gold case, visible mechanical gears through the open-heart dial and a brown leather strap, macro hero shot, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "chronos-pulsefit-smartwatch":
    "Modern smartwatch with bright square AMOLED display showing fitness rings and heart rate stats, metal case and black silicone strap, professional e-commerce product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "aurelia-sterling-silver-studs":
    "Pair of small 925 sterling silver stud earrings with brilliant round cubic zirconia stones sparkling, macro jewellery photography on a white display card, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Beauty & Personal Care ──
  "glownest-vitamin-c-serum":
    "Amber glass dropper bottle of vitamin C face serum with minimal white label, fresh orange slice and a glass dropper beside it, clean skincare product photography, soft studio lighting, clean light background, high quality, detailed",
  "veda-bloom-kumkumadi-oil":
    "Traditional Ayurvedic kumkumadi face oil in an amber glass dropper bottle with saffron strands, sandalwood pieces and dried rose petals arranged around it, warm spa-style product photography, soft lighting, clean light background, high quality, detailed",
  "glownest-3in1-hair-styler":
    "3-in-1 hair styler kit with a hair dryer, ceramic plate straightener and curling tong arranged neatly in an open travel case, personal care product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Health & Wellness ──
  "vitalroot-whey-isolate-1kg":
    "Large black whey protein powder tub with rich chocolate labelling and a shaker bottle of chocolate protein shake beside it, sports nutrition product photography, soft studio lighting, clean light background, high quality, detailed",
  "vitalroot-multivitamin-90":
    "White multivitamin supplement bottle with a few golden soft tablets spilling beside it on a clean surface, health supplement product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "vitalroot-bp-monitor":
    "Digital blood pressure monitor with a large easy-read display showing readings and an upper arm cuff neatly coiled beside the main unit, home healthcare product photography, soft studio lighting, clean light background, high quality, detailed",

  // ── Grocery & Gourmet ──
  "farmfresh-groundnut-oil-5l":
    "Large 5 litre can of golden cold-pressed groundnut cooking oil with fresh peanuts scattered in front and a steel ladle beside it, Indian kitchen product photography, soft studio lighting, clean light background, high quality, detailed",
  "spiceroute-organic-garam-masala":
    "Glass jar of organic garam masala powder with whole Indian spices like cinnamon sticks, cardamom pods, cloves and star anise arranged around it, Indian spice product photography, soft studio lighting, warm tones, clean background, high quality, detailed",
  "farmfresh-sonamasuri-rice-5kg":
    "Premium sonamasuri brown rice grains spilling from a jute sack with a wooden bowl of uncooked rice in front, Indian pantry product photography, soft studio lighting, clean light background, high quality, detailed",

  // ── Books & Media ──
  "cartographers-daughter-hardcover":
    "Elegant hardcover novel with gold foil stamped cover showing a vintage map of India design, propped upright with a soft shadow, book product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "atomic-focus-paperback":
    "Modern minimalist paperback book with bold typography and abstract geometric cover design standing upright on a clean desk with reading glasses beside it, book product photography, soft studio lighting, clean light background, high quality, detailed",
  "little-explorers-encyclopedia":
    "Colorful children's illustrated encyclopedia open showing vivid illustrations of dinosaurs and planets, with the bright hardcover visible, kids book product photography, soft studio lighting, clean light background, high quality, detailed",

  // ── Toys & Games ──
  "playforge-magnetic-tiles-100":
    "Colorful translucent magnetic building tiles in red, blue, yellow and green arranged with a small castle structure built from them on a white table, educational toy product photography, soft studio lighting, clean light background, high quality, detailed",
  "brightbee-montessori-puzzle-set":
    "Wooden Montessori puzzle boards with chunky colorful animal and shape pieces made of smooth polished wood arranged on a light table, educational wooden toy photography, soft studio lighting, clean light background, high quality, detailed",
  "playforge-rc-stunt-car":
    "Red and black RC stunt car with oversized rubber tires and a game-controller-style remote control beside it, dynamic toy product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Baby & Kids ──
  "tinytots-cotton-baby-wraps-3":
    "Three soft cotton muslin baby swaddle wraps in pastel blue, mint and yellow neatly folded and stacked with one partially opened, baby essentials product photography, soft studio lighting, clean light background, high quality, detailed",
  "softnest-3in1-high-chair":
    "Modern wooden 3-in-1 convertible baby high chair in natural beech wood with a white tray and padded cushion displayed in high chair mode, baby furniture product photography, soft studio lighting, clean light background, high quality, detailed",
  "tinytots-silicone-feeding-set":
    "BPA-free silicone baby feeding set with a divided suction plate in soft pastel colors, an open training cup and soft spoons arranged on a light table, baby product photography, soft studio lighting, clean minimal light background, high quality, detailed",

  // ── Sports & Fitness ──
  "ironpeak-adjustable-dumbbells-20kg":
    "Pair of adjustable chrome dumbbells with black rubber-coated weight plates and star lock collars resting on a home gym floor, fitness equipment product photography, soft studio lighting, clean light background, high quality, detailed",
  "flexfit-antislip-yoga-mat":
    "Purple anti-slip yoga mat partially unrolled showing a textured surface with alignment lines, with a second mat rolled up and a carry strap beside it, yoga product photography, soft studio lighting, clean light background, high quality, detailed",
  "ironpeak-cricket-bat-kashmir":
    "Full size kashmir willow cricket bat with natural wood finish standing upright with a red leather cricket ball resting at its base, sports equipment product photography, soft studio lighting, clean light background, high quality, detailed",

  // ── Pet Supplies ──
  "pawpal-grainfree-dog-food-5kg":
    "Large resealable bag of premium grain-free chicken dog food with a ceramic bowl of kibble in front of it, pet food product photography, soft studio lighting, clean light background, high quality, detailed",
  "whisker-cat-tree-tower":
    "Multi-level cat tree tower with beige plush platforms, sisal rope scratching posts and cozy condo houses, displayed as a full floor-to-ceiling tower, pet furniture product photography, soft studio lighting, clean light background, high quality, detailed",
  "pawpal-orthopedic-pet-bed":
    "Large orthopedic memory foam pet bed with soft grey plush bolstered sides and a removable cover displayed open on the floor, pet product photography, soft studio lighting, clean light background, high quality, detailed",

  // ── Stationery & Office ──
  "scriptlab-gel-pens-20":
    "Twenty black gel pens with 0.5mm needle tips and blue accents neatly arranged in a fanned layout, stationery product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "papertrail-a5-dotted-journal":
    "A5 hardcover dotted journal in deep teal vegan leather with elastic closure and ribbon bookmark, lying open showing dotted grid pages, stationery product photography, soft studio lighting, clean light background, high quality, detailed",
  "scriptlab-study-lamp-usb":
    "Modern LED study lamp clamped to a desk edge with a flexible gooseneck casting bright white light on an open notebook, minimalist black design, product photography, soft studio lighting, clean light background, high quality, detailed",

  // ── Tools & DIY ──
  "handyforge-108pc-tool-kit":
    "Open 108-piece tool kit case showing organised chrome-vanadium tools including sockets, wrenches, pliers, hammer and screwdriver bits in a red blow-moulded case, tool product photography, studio lighting, clean background, high quality, detailed",
  "handyforge-cordless-screwdriver":
    "Compact cordless screwdriver in black and orange with a rubber grip and assorted screwdriver bits arranged beside it, power tool product photography, soft studio lighting, clean minimal light background, high quality, detailed",
  "handyforge-laser-level-combo":
    "Green cross-line laser level device projecting bright green horizontal and vertical lines onto a wall, with a yellow magnetic tape measure beside it, tool product photography, soft studio lighting, clean background, high quality, detailed",

  // ── Musical Instruments ──
  "soundstring-acoustic-guitar-38":
    "38-inch acoustic guitar with natural gloss spruce top, rosewood fretboard and cutaway body displayed on a wooden stand with a gig bag and clip-on tuner beside it, musical instrument product photography, soft studio lighting, clean light background, high quality, detailed",
  "melodycraft-61key-keyboard":
    "61-key portable electronic keyboard in black with a display screen and control buttons, set on a sturdy keyboard stand with sheet music, musical instrument product photography, soft studio lighting, clean light background, high quality, detailed",
  "melodycraft-tabla-set":
    "Traditional Indian tabla set with a wooden sheesham dayan drum and a copper bayan drum with black syahi circles on the heads, placed on embroidered cushions with a tuning hammer beside it, Indian classical instrument photography, warm soft lighting, clean background, high quality, detailed",
};

async function main() {
  const zai = await ZAI.create();
  let ok = 0;
  let skipped = 0;
  const failures: string[] = [];

  // Safety: every seed product must have a prompt defined.
  const missing = SEED_PRODUCTS_EXTRA.filter((p) => !PROMPTS[p.slug]);
  if (missing.length) {
    console.error("Missing prompts for: " + missing.map((m) => m.slug).join(", "));
    process.exit(1);
  }

  const queue = [...SEED_PRODUCTS_EXTRA];

  async function worker(): Promise<void> {
    for (;;) {
      const product = queue.shift();
      if (!product) return;

      const file = join(OUT_DIR, `${product.slug}-1.jpg`);
      if (existsSync(file)) {
        skipped++;
        continue;
      }

      let done = false;
      for (let attempt = 1; attempt <= 6 && !done; attempt++) {
        try {
          const res = await zai.images.generations.create({
            prompt: PROMPTS[product.slug],
            size: SIZE as never,
          });
          const b64 = res.data?.[0]?.base64;
          if (!b64) throw new Error("empty response");
          writeFileSync(file, Buffer.from(b64, "base64"));
          ok++;
          console.log(`[${ok + skipped}/${SEED_PRODUCTS_EXTRA.length}] ${product.slug}-1.jpg`);
          done = true;
        } catch (e) {
          const msg = (e as Error).message || "";
          const is429 = msg.includes("429") || msg.toLowerCase().includes("too many");
          console.error(`  ! ${product.slug} attempt ${attempt}: ${msg.slice(0, 120)}`);
          // long backoff on rate-limit, short otherwise
          await new Promise((r) => setTimeout(r, is429 ? 20000 + attempt * 10000 : 3000 * attempt));
        }
      }
      if (!done) failures.push(product.slug);
      // gentle pacing between requests to respect API rate limits
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`Done. Generated: ${ok}, skipped (existing): ${skipped}, failed: ${failures.length}`);
  if (failures.length) console.log("Failed slugs:", failures.join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
