import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write('Invalid environment variables:\n');
  process.stderr.write(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2) + '\n');
  process.exit(1);
}

export const env = parsed.data;
