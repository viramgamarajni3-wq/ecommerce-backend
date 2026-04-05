import { db } from '../src/db';

async function check() {
  try {
    const q1 = "CREATE TABLE IF NOT EXISTS product_tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), value VARCHAR(255) UNIQUE NOT NULL)";
    const q2 = "CREATE TABLE IF NOT EXISTS product_tags_mapping (product_id UUID REFERENCES products(id), tag_id UUID REFERENCES product_tags(id), PRIMARY KEY (product_id, tag_id))";
    
    await db.query(q1);
    console.log("product_tags OK");
    await db.query(q2);
    console.log("product_tags_mapping OK");
  } catch (e: any) {
    console.error("FAILED:", e.message);
  }
  process.exit(0);
}

check();
