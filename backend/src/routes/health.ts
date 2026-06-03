import { Router } from 'express';
import { db } from '../db/index.js';
import { redis } from '../lib/redis.js';
import { sql } from 'drizzle-orm';

const router = Router();
const startTime = Date.now();

router.get('/', async (_req, res) => {
  let postgresStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    postgresStatus = 'error';
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = 'error';
  }

  const status = postgresStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';
  const statusCode = status === 'ok' ? 200 : 503;

  res.status(statusCode).json({
    status,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    redis: redisStatus,
    postgres: postgresStatus,
  });
});

export default router;
