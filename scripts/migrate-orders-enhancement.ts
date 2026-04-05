import { db } from '../src/db';

async function migrate() {
  console.log("📦 Enhancing Orders table with Medusa-like fields (Display ID, Fulfillment Status)...");

  try {
    // 1. Create fulfillment status type safely
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status') THEN
          CREATE TYPE fulfillment_status AS ENUM (
            'not_fulfilled', 'partially_fulfilled', 'fulfilled', 
            'partially_shipped', 'shipped', 'partially_returned', 'returned', 'canceled'
          );
        END IF;
      END $$;
    `);

    // 2. Add columns to orders
    const columns = [
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status fulfillment_status DEFAULT 'not_fulfilled'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_id SERIAL`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`
    ];

    for (const q of columns) {
      await db.query(q);
      console.log(`✅ Executed: ${q.split('\n')[0].substring(0, 50)}...`);
    }

    console.log("✨ Orders enhancement complete!");
  } catch (e: any) {
    console.error(`❌ Migration failed: ${e.message}`);
  }
  process.exit(0);
}

migrate();
