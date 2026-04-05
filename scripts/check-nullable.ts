import { db } from '../src/db';
async function run() {
  const res = await db.query("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'vendor_id'");
  console.log('vendor_id column info:', JSON.stringify(res.rows[0], null, 2));
  process.exit(0);
}
run();
