import { db } from '../src/db';
async function run() {
  const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
  console.log(res.rows.map((r: any) => r.column_name));
  process.exit(0);
}
run();
