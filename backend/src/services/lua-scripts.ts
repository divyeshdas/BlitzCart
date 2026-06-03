import { readFileSync } from 'fs';
import { join } from 'path';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

// __dirname is CJS-native — tsconfig targets commonjs
const scriptsDir = join(__dirname, '..', 'scripts');

let atomicBuySha = '';
let rateLimitSha = '';

export async function loadLuaScripts(): Promise<void> {
  const atomicBuy = readFileSync(join(scriptsDir, 'atomic_buy.lua'), 'utf8');
  const rateLimit = readFileSync(join(scriptsDir, 'rate_limit.lua'), 'utf8');

  atomicBuySha = await redis.script('LOAD', atomicBuy) as string;
  rateLimitSha = await redis.script('LOAD', rateLimit) as string;

  logger.info({ atomicBuySha, rateLimitSha }, 'lua scripts loaded');
}

// Returns remaining stock (>= 0), -1 = sold out, -2 = sale not found/active
export async function evalAtomicBuy(inventoryKey: string, qty = 1): Promise<number> {
  const result = await redis.evalsha(atomicBuySha, 1, inventoryKey, String(qty));
  return result as number;
}

// Returns 1 = allowed, 0 = blocked
export async function evalRateLimit(
  userId: string,
  maxTokens = 5,
  windowSeconds = 10,
): Promise<number> {
  const key = `ratelimit:${userId}`;
  const result = await redis.evalsha(rateLimitSha, 1, key, String(maxTokens), String(windowSeconds));
  return result as number;
}
