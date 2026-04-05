import { db } from '../src/db';

async function migrate() {
  console.log("🚀 Creating missing tables for full Medusa parity...");

  const queries = [
    // 1. Product Tags
    `CREATE TABLE IF NOT EXISTS product_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      value VARCHAR(255) UNIQUE NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS product_tags_mapping (
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      tag_id UUID REFERENCES product_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, tag_id)
    )`,

    // 2. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name VARCHAR(255) NOT NULL,
      resource_type VARCHAR(255) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      to_email VARCHAR(255),
      data JSONB DEFAULT '{}',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 3. Claims
    `CREATE TABLE IF NOT EXISTS claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL, -- 'refund', 'replace'
      status VARCHAR(50) DEFAULT 'pending',
      reason TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // 4. Shipping Options
    `CREATE TABLE IF NOT EXISTS shipping_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
      provider_id VARCHAR(255) NOT NULL,
      price_type VARCHAR(50) DEFAULT 'calculated', -- 'flat_rate', 'calculated'
      amount NUMERIC(12,2),
      is_return BOOLEAN DEFAULT FALSE,
      admin_only BOOLEAN DEFAULT FALSE,
      metadata JSONB DEFAULT '{}'
    )`,

    // 5. Swaps
    `CREATE TABLE IF NOT EXISTS swaps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
      fulfillment_status VARCHAR(50) DEFAULT 'not_fulfilled',
      payment_status VARCHAR(50) DEFAULT 'not_paid',
      difference_due NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  ];

  for (const q of queries) {
    try {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    } catch (e: any) {
      console.warn(`⚠️ Query failed: ${e.message}`);
    }
  }

  console.log("✨ Missing tables created!");
  process.exit(0);
}

migrate();
