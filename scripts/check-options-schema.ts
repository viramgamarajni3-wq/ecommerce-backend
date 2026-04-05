import { db } from "../src/db";
import fs from "fs";

async function check() {
  try {
    const tables = ['product_option', 'product_option_value', 'product_options', 'product_option_values'];
    let output = "";
    
    for (const table of tables) {
        const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = $1", [table]);
        if (res.rows.length > 0) {
            const colRes = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
            output += `Table ${table} Columns:\n` + JSON.stringify(colRes.rows, null, 2) + "\n\n";
        }
    }
    
    fs.writeFileSync("options_schema.json", output);
    console.log("Dumped to options_schema.json");
  } catch (e: any) {
    console.error(e);
  } finally {
    await db.end();
  }
}

check();
