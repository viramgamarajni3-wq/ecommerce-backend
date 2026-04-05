import { db } from '../src/db';

async function check() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_tags'
    `);
    console.log("product_tags table columns:");
    res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));
  } catch (e: any) {
    console.error(e.message);
  }
  process.exit(0);
}

check();
