import { db } from '../src/db';
async function run() {
  try {
    const res = await db.query(
      "SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers"
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
