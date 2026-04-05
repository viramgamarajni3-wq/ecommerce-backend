import { db } from '../src/db';

async function migrate() {
  console.log("🚚 Setting up Fulfillments, Returns, and Invitations...");

  try {
    const queries = [
      // 1. Fulfillments
      `CREATE TABLE IF NOT EXISTS fulfillments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        tracking_number VARCHAR(255),
        shipped_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        canceled_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Returns
      `CREATE TABLE IF NOT EXISTS returns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'requested', -- 'requested', 'received', 'canceled'
        refund_amount NUMERIC(12,2) DEFAULT 0,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 3. Admin/Staff Invitations
      `CREATE TABLE IF NOT EXISTS invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_accepted BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 4. Store Global Settings
      `CREATE TABLE IF NOT EXISTS store_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) DEFAULT 'My Custom Medusa Store',
        default_currency VARCHAR(10) DEFAULT 'INR',
        swap_link_template TEXT,
        payment_link_template TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }

    // Insert initial store settings if not exists
    await db.query(`
      INSERT INTO store_settings (name) 
      SELECT 'My Custom Medusa Store' 
      WHERE NOT EXISTS (SELECT 1 FROM store_settings)
    `);
    
    console.log("✨ Logistics system migration complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
