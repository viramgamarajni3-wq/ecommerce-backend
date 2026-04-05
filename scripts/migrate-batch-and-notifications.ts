import { db } from '../src/db';

async function migrate() {
  console.log("🚀 Setting up Batch Jobs and Notification Logs...");

  try {
    const queries = [
      // 1. Batch Jobs (for Import/Export)
      `CREATE TABLE IF NOT EXISTS batch_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL, -- 'product-import', 'product-export', 'order-export'
        status VARCHAR(50) DEFAULT 'created', -- 'created', 'processing', 'completed', 'failed', 'canceled'
        context JSONB DEFAULT '{}', -- input data, filename etc.
        result JSONB DEFAULT '{}', -- stats, errors etc.
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // 2. Notifications (Email/SMS logs)
      `CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(255) NOT NULL, -- 'order.placed', 'customer.created'
        resource_type VARCHAR(50) NOT NULL, -- 'order', 'customer', 'fulfillment'
        resource_id UUID NOT NULL,
        customer_id UUID REFERENCES users(id),
        to_address VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
        data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    for (const q of queries) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }
    
    console.log("✨ Batch and Notification system migration complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
