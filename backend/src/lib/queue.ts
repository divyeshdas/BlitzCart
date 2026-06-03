import { Queue, type ConnectionOptions } from 'bullmq';
import { env } from './env.js';

// BullMQ needs a plain options object, not an ioredis instance for Worker
// Parse the Redis URL into host/port/password so BullMQ creates its own connections
function parseRedisUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  const opts: ConnectionOptions = {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    maxRetriesPerRequest: null, // required by BullMQ
  };
  if (u.password) (opts as Record<string, unknown>)['password'] = decodeURIComponent(u.password);
  if (u.pathname && u.pathname !== '/') {
    (opts as Record<string, unknown>)['db'] = parseInt(u.pathname.slice(1), 10);
  }
  return opts;
}

export const redisConnection = parseRedisUrl(env.REDIS_URL);

export const orderQueue = new Queue('orders', { connection: redisConnection });

export type OrderJobData = {
  orderId: string;
  userId: string;
  saleId: string;
  productId: string;
  quantity: number;
  timestamp: number;
};
