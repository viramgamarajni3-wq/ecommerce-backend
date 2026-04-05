import { db } from "../src/db";
import fs from "fs";

async function check() {
  try {
    const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_variants'");
    let output = "product_variants Columns:\n" + JSON.stringify(res.rows, null, 2);
    fs.writeFileSync("variants_columns.json", output);
    console.log("Dumped to variants_columns.json");
  } catch (e: any) {
    console.error(e);
  } finally {
    await db.end();
  }
}

check();
