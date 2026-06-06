import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

async function runMigrations(): Promise<void> {
  const db = drizzle(pool);
  // __dirname resolves to dist/db/ in production, src/db/ in dev — migrations live next to this file
  const migrationsFolder = join(__dirname, 'migrations');
  await migrate(db, { migrationsFolder });
  process.stdout.write('Migrations complete\n');
  await pool.end();
}

runMigrations().catch((err) => {
  process.stderr.write(`Migration failed: ${String(err)}\n`);
  process.exit(1);
});
