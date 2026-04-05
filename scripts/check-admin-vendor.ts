import { db } from '../src/db';
async function run() {
  const res = await db.query("SELECT id FROM vendors WHERE user_id = 'a7c2cce3-dabf-47de-9e76-fad70612cfef'");
  console.log('Admin vendor id:', res.rows[0]?.id);
  process.exit(0);
}
run();
