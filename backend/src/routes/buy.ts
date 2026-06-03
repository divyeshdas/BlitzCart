import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { orders } from '../db/schema/index.js';
import { evalAtomicBuy, evalRateLimit } from '../services/lua-scripts.js';
import { orderQueue } from '../lib/queue.js';
import { requireAuth } from '../middleware/auth.js';
import { buyRequestsTotal, buyLatencyMs, inventoryGauge } from '../lib/metrics.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const router = Router();

const buySchema = z.object({
  productId: z.string().uuid(),
});

router.post('/:saleId/buy', requireAuth, async (req, res) => {
  const start = Date.now();

  const result = buySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', requestId: req.id });
    return;
  }

  const { saleId } = req.params as { saleId: string };
  const { productId } = result.data;
  const userId = req.user!.sub;

  // Rate limit check — 5 attempts per user per 10s window
  const allowed = await evalRateLimit(userId);
  if (allowed === 0) {
    buyRequestsTotal.inc({ result: 'rate_limited' });
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      requestId: req.id,
    });
    res.setHeader('Retry-After', '10');
    return;
  }

  // Atomic inventory decrement via Lua EVALSHA — no race condition possible
  const inventoryKey = `inventory:${saleId}:${productId}`;
  const remaining = await evalAtomicBuy(inventoryKey, 1);

  if (remaining === -2) {
    buyRequestsTotal.inc({ result: 'not_found' });
    res.status(404).json({ error: 'Sale not active', code: 'NOT_FOUND', requestId: req.id });
    return;
  }

  if (remaining === -1) {
    buyRequestsTotal.inc({ result: 'sold_out' });
    res.status(410).json({ error: 'Sold out', code: 'SOLD_OUT', requestId: req.id });
    return;
  }

  // Inventory decremented — create a pending order row then enqueue
  const orderId = uuidv4();

  await db.insert(orders).values({
    id: orderId,
    userId,
    productId,
    saleId,
    status: 'pending',
  });

  await orderQueue.add(
    'confirm-order',
    { orderId, userId, saleId, productId, quantity: 1, timestamp: Date.now() },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
    },
  );

  inventoryGauge.set({ sale_id: saleId, product_id: productId }, remaining);
  buyRequestsTotal.inc({ result: 'accepted' });
  buyLatencyMs.observe(Date.now() - start);

  // Publish before responding — WS broadcast is fire-and-forget
  void redis.publish(
    `inventory-update:${saleId}`,
    JSON.stringify({ productId, remaining, ts: Date.now() }),
  );

  logger.info({ orderId, userId, saleId, productId, remaining }, 'buy accepted');

  res.status(202).json({ orderId, remaining, position: await orderQueue.getWaitingCount() });
});

export default router;
