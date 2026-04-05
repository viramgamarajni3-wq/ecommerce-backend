import { db } from '../src/db';

async function migrate() {
  console.log("🚀 Starting Bulk Medusa Feature Migration (Price Lists, Sales Channels, Tax Rates)...");

  try {
    const queries = [
      // 1. Price Lists
      `CREATE TABLE IF NOT EXISTS price_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'sale', -- 'sale' or 'override'
        status VARCHAR(50) DEFAULT 'active',
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS price_list_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        currency_code VARCHAR(10) DEFAULT 'INR',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Sales Channels
      `CREATE TABLE IF NOT EXISTS sales_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_disabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS product_sales_channels (
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        sales_channel_id UUID REFERENCES sales_channels(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, sales_channel_id)
      )`,

      // 3. Tax Rates (per region)
      `CREATE TABLE IF NOT EXISTS tax_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rate NUMERIC(10,2) NOT NULL,
        code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 4. API Keys (for backend access)
      `CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) UNIQUE NOT NULL,
        label VARCHAR(255),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }

    // Add a default Sales Channel if none exists
    const sc = await db.query("SELECT id FROM sales_channels WHERE name = 'Default Store' LIMIT 1");
    if (sc.rows.length === 0) {
      await db.query("INSERT INTO sales_channels (name, description) VALUES ('Default Store', 'Your main online storefront')");
      console.log("🏪 Created Default Sales Channel.");
    }

    console.log("✨ All tables created! Database is now a full Medusa-style engine.");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
