import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from './schema/index.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

async function seed(): Promise<void> {
  const db = drizzle(pool);

  const adminEmail = 'admin@blitzcart.dev';
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash('admin_dev_pass_123', 12);
    await db.insert(users).values({ email: adminEmail, passwordHash, role: 'admin' });
    process.stdout.write(`Admin seeded: ${adminEmail}\n`);
  } else {
    process.stdout.write('Admin already exists, skipping\n');
  }

  await pool.end();
}

seed().catch((err) => {
  process.stderr.write(`Seed failed: ${String(err)}\n`);
  process.exit(1);
});
