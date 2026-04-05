import { db } from '../src/db';

async function migrate() {
  console.log("📸 Adding Variant-Specific Image Support (Medusa Visuals)...");

  try {
    const queries = [
      // 1. Add thumbnail_url to product_variants for quick access
      `ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(255)`,

      // 2. Junction table to link multiple gallery images to a specific variant (Enterprise Feature)
      `CREATE TABLE IF NOT EXISTS product_variant_images (
        variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
        image_id UUID REFERENCES product_images(id) ON DELETE CASCADE,
        PRIMARY KEY(variant_id, image_id)
      )`,

      // 3. Metadata for extra flexibility
      `ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed Image Upgrade Step...`);
    }

    console.log("✨ Variant-Wise Image Support complete!");
  } catch (e: any) {
    console.error(`❌ Visuals Upgrade Error: ${e.message}`);
  }
  process.exit(0);
}

migrate();
