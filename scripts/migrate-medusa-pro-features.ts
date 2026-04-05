import { db } from '../src/db';

async function migrate() {
  console.log("🚀 Upgrading to Professional Medusa Parity (Advanced Fields)...");

  try {
    const queries = [
      // 1. Inventory Items (Multi-Location Architecture)
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku VARCHAR(255) UNIQUE,
        origin_country VARCHAR(100),
        hs_code VARCHAR(100),
        mid_code VARCHAR(100),
        material VARCHAR(255),
        weight INTEGER,
        length INTEGER,
        height INTEGER,
        width INTEGER,
        requires_shipping BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Mapping Variant -> Inventory
      `CREATE TABLE IF NOT EXISTS product_variant_inventory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
        inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
        required_quantity INTEGER DEFAULT 1,
        UNIQUE(variant_id, inventory_item_id)
      )`,

      // 2. Advanced Discount Conditions
      `CREATE TABLE IF NOT EXISTS discount_conditions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL, -- 'products', 'categories', 'customer_groups'
        discount_rule_id UUID REFERENCES discounts(id) ON DELETE CASCADE,
        operator VARCHAR(50) NOT NULL DEFAULT 'in', -- 'in' or 'not_in'
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 3. Customer Groups (Segmentation)
      `CREATE TABLE IF NOT EXISTS customer_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Link Customers to Groups
      `CREATE TABLE IF NOT EXISTS customer_group_customers (
        customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        customer_group_id UUID REFERENCES customer_groups(id) ON DELETE CASCADE,
        PRIMARY KEY(customer_id, customer_group_id)
      )`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed Upgrade Step...`);
    }

    console.log("✨ Medusa Pro Migration Complete!");
  } catch (e: any) {
    console.error(`❌ Pro Upgrade Error: ${e.message}`);
  }
  process.exit(0);
}

migrate();
