import { db } from '../src/db';
async function run() {
  const adminUserId = 'a7c2cce3-dabf-47de-9e76-fad70612cfef'; // From user curl token
  const slug = `admin-store-${Date.now()}`;
  
  try {
    const res = await db.query(
      "INSERT INTO vendors (user_id, store_name, store_slug, status) VALUES ($1, $2, $3, 'approved') RETURNING id",
      [adminUserId, 'Admin Store', slug]
    );
    console.log('Successfully created Admin Vendor with ID:', res.rows[0].id);
  } catch (err: any) {
    console.error('Failed to create Admin Vendor:', err.message);
  }
  process.exit(0);
}
run();
