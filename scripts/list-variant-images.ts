import { db } from "../src/db";

async function check() {
  try {
    const pid = "a3467e1c-f753-4a2e-af3f-4a7c2d09173e";
    const res = await db.query("SELECT id, title, thumbnail_url, image_url FROM product_variants WHERE product_id = $1", [pid]);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e: any) {
    console.error(e);
  } finally {
    await db.end();
  }
}

check();
