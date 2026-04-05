import { db } from '../src/db';

async function migrate() {
  console.log("🏪 Segmenting Medusa features for Vendors (Discounts, Price Lists, Batch Jobs)...");

  try {
    const queries = [
      // 1. Link Discounts to Vendors
      `ALTER TABLE discounts ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE`,
      
      // 2. Link Price Lists to Vendors
      `ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE`,
      
      // 3. Link Gift Cards to Vendors
      `ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE`,

      // 4. Update order_items to include fulfillment_status if missing (it was in orders, but each item can have its own)
      `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'not_fulfilled'`,
      `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255)`,
      `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }

    console.log("✨ Vendor segmentation migration complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
