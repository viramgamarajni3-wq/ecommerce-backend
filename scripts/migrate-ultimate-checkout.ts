import { db } from '../src/db';

async function migrate() {
  console.log("🛒 Building the Ultimate Checkout & Cart System (Carts, Line Items)...");

  try {
    const queries = [
      // 1. Enhanced Cart Table (Standard Medusa Name)
      `CREATE TABLE IF NOT EXISTS carts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id UUID REFERENCES regions(id),
        customer_id UUID REFERENCES users(id),
        email VARCHAR(255),
        shipping_address JSONB DEFAULT '{}',
        payment_id VARCHAR(255),
        is_completed BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Line Items (Standard Medusa Name)
      `CREATE TABLE IF NOT EXISTS line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price NUMERIC(12,2),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 3. Link Cart Items if they were in a different table before
      `DO $$ 
       BEGIN 
         IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
           INSERT INTO line_items (cart_id, variant_id, quantity)
           SELECT cart_id, variant_id, quantity FROM cart_items
           ON CONFLICT DO NOTHING;
         END IF;
       END $$;`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }
    
    console.log("✨ Ultimate Checkout migration complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
