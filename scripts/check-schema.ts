import { db } from "../src/db";
import fs from "fs";

async function check() {
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tables = res.rows.map(r => r.table_name);
    let output = "Tables: " + tables.join(", ") + "\n\n";
    
    if (tables.includes('collections')) {
        const colRes = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'collections'");
        output += "Collection Columns:\n" + JSON.stringify(colRes.rows, null, 2);
    } else {
        output += "Table 'collections' DOES NOT EXIST.";
    }
    
    fs.writeFileSync("schema_dump.json", output);
    console.log("Dumped to schema_dump.json");
  } catch (e: any) {
    fs.writeFileSync("schema_dump.json", e.message);
  } finally {
    await db.end();
  }
}

check();
