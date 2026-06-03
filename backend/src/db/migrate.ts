import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

async function runMigrations(): Promise<void> {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  process.stdout.write('Migrations complete\n');
  await pool.end();
}

runMigrations().catch((err) => {
  process.stderr.write(`Migration failed: ${String(err)}\n`);
  process.exit(1);
});
