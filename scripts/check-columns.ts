import { db } from '../src/db';
async function run() {
  const res = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'product_variants'
  `);
  console.log('Columns of product_variants:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
