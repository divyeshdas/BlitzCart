import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

function createClient(name: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    lazyConnect: true,
  });

  client.on('connect', () => logger.info({ client: name }, 'redis connected'));
  client.on('error', (err) => logger.error({ client: name, err }, 'redis error'));
  client.on('reconnecting', () => logger.warn({ client: name }, 'redis reconnecting'));

  return client;
}

// General-purpose client for commands
export const redis = createClient('main');

// Dedicated subscriber — cannot issue regular commands once subscribed
export const redisSub = createClient('subscriber');

export async function connectRedis(): Promise<void> {
  await Promise.all([redis.connect(), redisSub.connect()]);
}

export async function closeRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisSub.quit()]);
}
