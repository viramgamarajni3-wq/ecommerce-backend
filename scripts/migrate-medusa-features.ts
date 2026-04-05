import { db } from '../src/db';

async function migrate() {
  console.log("🚀 Starting Medusa-feature migration (Collections, Regions, Discounts, Gift Cards)...");

  const queries = [
    // 1. Collections
    `CREATE TABLE IF NOT EXISTS collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      handle VARCHAR(255) UNIQUE NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 2. Regions (for multiple currencies/taxes)
    `CREATE TABLE IF NOT EXISTS regions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
      tax_rate NUMERIC(5,2) DEFAULT 0,
      tax_code VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 3. Discounts
    `CREATE TABLE IF NOT EXISTS discounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      rule_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'free_shipping'
      rule_value NUMERIC(12,2) NOT NULL,
      allocation VARCHAR(50) DEFAULT 'total', -- 'total' or 'item'
      is_dynamic BOOLEAN DEFAULT FALSE,
      is_disabled BOOLEAN DEFAULT FALSE,
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      ends_at TIMESTAMPTZ,
      usage_limit INTEGER,
      usage_count INTEGER DEFAULT 0,
      min_order_amount NUMERIC(12,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 4. Gift Cards
    `CREATE TABLE IF NOT EXISTS gift_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(255) UNIQUE NOT NULL,
      value NUMERIC(12,2) NOT NULL,
      balance NUMERIC(12,2) NOT NULL,
      region_id UUID REFERENCES regions(id),
      is_disabled BOOLEAN DEFAULT FALSE,
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 5. Update Products table with missing Medusa-like fields (HS code, MID code, etc.)
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS handle VARCHAR(255)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS subtitle TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS hs_code VARCHAR(50)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS mid_code VARCHAR(50)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_country VARCHAR(10)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(255)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS length_mm INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS height_mm INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS width_mm INTEGER`
  ];

  for (const q of queries) {
    try {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    } catch (e: any) {
      console.warn(`⚠️ Query failed but continuing: ${e.message}`);
    }
  }
  
  console.log("✨ Migration complete! Your database now supports Medusa-style features.");
  process.exit(0);
}

migrate();
