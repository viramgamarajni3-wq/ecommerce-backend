import { db } from '../src/db';

async function run() {
  const vendors = await db.query("SELECT id, store_name, user_id FROM vendors LIMIT 10");
  const categories = await db.query("SELECT id, name FROM categories LIMIT 10");
  const collections = await db.query("SELECT id, title FROM collections LIMIT 10");

  console.log('--- VENDORS ---');
  console.log(JSON.stringify(vendors.rows, null, 2));

  console.log('\n--- CATEGORIES ---');
  console.log(JSON.stringify(categories.rows, null, 2));

  console.log('\n--- COLLECTIONS ---');
  console.log(JSON.stringify(collections.rows, null, 2));

  process.exit(0);
}

run();
