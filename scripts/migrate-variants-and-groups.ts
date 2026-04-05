import { db } from '../src/db';

async function migrate() {
  console.log("👗 Setting up Advanced Variants and Customer Groups...");

  try {
    const queries = [
      // 1. Product Options (e.g., 'Size', 'Color')
      `CREATE TABLE IF NOT EXISTS product_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Product Option Values (Linked to variants)
      `CREATE TABLE IF NOT EXISTS product_option_values (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        value VARCHAR(255) NOT NULL,
        option_id UUID REFERENCES product_options(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 3. Customer Groups (VIP, Wholesale, etc.)
      `CREATE TABLE IF NOT EXISTS customer_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 4. Customer Group Membership (Join table)
      `CREATE TABLE IF NOT EXISTS customer_group_customers (
        customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        customer_group_id UUID REFERENCES customer_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (customer_id, customer_group_id)
      )`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }
    
    console.log("✨ Variants and Groups system migration complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
