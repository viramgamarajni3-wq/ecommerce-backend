import { db } from '../src/db';
async function run() {
  const res = await db.query("SELECT id, name, slug, status FROM products ORDER BY created_at DESC LIMIT 5");
  console.log('Recent products:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
