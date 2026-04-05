import { db } from "../src/db";
import fs from "fs";

async function check() {
  try {
    const res = await db.query("SELECT COUNT(*) FROM collections");
    const count = res.rows[0].count;
    fs.writeFileSync("collection_count.txt", "Collection Count: " + count);
    console.log("Counted:", count);
  } catch (e: any) {
    fs.writeFileSync("collection_count.txt", e.message);
  } finally {
    await db.end();
  }
}

check();
