import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders } from '../db/schema/index.js';
import { redis } from '../lib/redis.js';
import { redisConnection, orderQueue, type OrderJobData } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { queueDepthGauge } from '../lib/metrics.js';

export function startOrderWorker(): Worker<OrderJobData> {
  const worker = new Worker<OrderJobData>(
    'orders',
    async (job) => {
      const { orderId, userId, saleId } = job.data;

      await db
        .update(orders)
        .set({ status: 'confirmed' })
        .where(eq(orders.id, orderId));

      logger.info({ orderId, userId, saleId }, 'order confirmed');
    },
    {
      connection: redisConnection,
      concurrency: 10,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { orderId, productId, saleId, quantity } = job.data;

    logger.error({ orderId, err: err.message, attempts: job.attemptsMade }, 'order job failed');

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await db.update(orders).set({ status: 'failed' }).where(eq(orders.id, orderId));
      await redis.incrby(`inventory:${saleId}:${productId}`, quantity);
      logger.warn({ orderId, productId }, 'inventory restored after job failure');
    }
  });

  worker.on('error', (err) => logger.error({ err }, 'worker error'));

  // Poll queue depth every 5s for the Prometheus gauge
  setInterval(() => {
    void orderQueue.getJobCounts('waiting', 'active').then((counts: Record<string, number>) => {
      queueDepthGauge.set((counts['waiting'] ?? 0) + (counts['active'] ?? 0));
    });
  }, 5000);

  logger.info('order worker started');
  return worker;
}
