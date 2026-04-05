import { db } from "../src/db";

async function check() {
  try {
    const sku = "NAM IMPEDIT NON SIM-S-YELLOW";
    const res = await db.query("SELECT id, title, product_id FROM product_variants WHERE sku = $1", [sku]);
    console.log("SKU search result:", JSON.stringify(res.rows, null, 2));
  } catch (e: any) {
    console.error(e); 
  } finally {
    await db.end();
  }
}

check();
