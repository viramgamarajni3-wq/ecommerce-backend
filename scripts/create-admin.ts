import { db } from '../src/db';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  const email = 'admin@shophub.in';
  const password = 'adminpassword123';
  const firstName = 'Super';
  const lastName = 'Admin';

  const hash = await bcrypt.hash(password, 12);

  try {
    const result = await db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email",
      [email.toLowerCase(), hash, firstName, lastName, 'admin']
    );
    console.log('✅ Admin created successfully');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (e: any) {
    if (e.code === '23505') {
      console.log('⚠️ Admin user already exists');
    } else {
      console.error('❌ Error creating admin:', e);
    }
  } finally {
    process.exit(0);
  }
}

createAdmin();
