import { db } from '../src/db';

async function migrate() {
  console.log("🚚 Setting up Shipping Options system (Regions, Shipping Methods)...");

  try {
    const queries = [
      // 1. Regions (for multiple currencies/taxes)
      `CREATE TABLE IF NOT EXISTS regions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
        tax_rate NUMERIC(10,2) DEFAULT 0,
        tax_code VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Shipping Options (Linked to regions)
      `CREATE TABLE IF NOT EXISTS shipping_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
        price_type VARCHAR(50) DEFAULT 'flat_rate', -- 'flat_rate' or 'calculated'
        amount NUMERIC(12,2) DEFAULT 0,
        is_return BOOLEAN DEFAULT FALSE,
        admin_only BOOLEAN DEFAULT FALSE,
        data JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }

    console.log("✨ Shipping system migration complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
