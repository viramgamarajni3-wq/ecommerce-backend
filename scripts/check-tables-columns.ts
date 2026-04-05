import { db } from '../src/db';
async function run() {
  const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'product_option_values'");
  res.rows.forEach((r: any) => console.log(r.column_name));
  process.exit(0);
}
run();
