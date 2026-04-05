import { db } from '../src/db';

async function migrate() {
  console.log("🛠️ Fixing Tag system tables...");

  try {
    // 1. Check if product_tags is currently a mapping table
    const checkRes = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'product_tags' AND column_name = 'product_id'
    `);

    if (checkRes.rows.length > 0) {
      console.log("⚠️ renaming old mapping table...");
      await db.query("ALTER TABLE product_tags RENAME TO product_tag_links_old");
    }

    // 2. Create proper master tag table
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        value VARCHAR(255) UNIQUE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("✅ Proper product_tags table ensured.");

    // 3. Create mapping table
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_tag_links (
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        tag_id UUID REFERENCES product_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, tag_id)
      )
    `);
    console.log("✅ product_tag_links table ensured.");

  } catch (e: any) {
    console.error("❌ Fix failed:", e.message);
  }
  process.exit(0);
}

migrate();
