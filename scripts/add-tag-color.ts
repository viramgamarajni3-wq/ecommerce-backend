import { db } from '../src/db';

async function migrate() {
  console.log("🎨 Adding color column to product_tags...");

  try {
    await db.query("ALTER TABLE product_tags ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'");
    // Actually, let's just add it as a column if the UI uses it.
    // Wait, the UI has color circles.
    await db.query("ALTER TABLE product_tags ADD COLUMN IF NOT EXISTS color VARCHAR(50)");
    console.log("✅ color column added.");
  } catch (e: any) {
    console.error("❌ Migration failed:", e.message);
  }
  process.exit(0);
}

migrate();
