import { db } from "../src/db";
import fs from "fs";

async function check() {
  try {
    const pid = "a3467e1c-f753-4a2e-af3f-4a7c2d09173e";
    const res = await db.query("SELECT id, title, thumbnail_url, image_url FROM product_variants WHERE product_id = $1", [pid]);
    fs.writeFileSync("variants_check.json", JSON.stringify(res.rows, null, 2));
    console.log("Varianted:", res.rows.length);
  } catch (e: any) {
    fs.writeFileSync("variants_check.json", e.message);
  } finally {
    await db.end();
  }
}

check();
