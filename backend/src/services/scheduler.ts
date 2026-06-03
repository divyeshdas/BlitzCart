import cron from 'node-cron';
import { and, eq, lte, gte, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sales, products } from '../db/schema/index.js';
import { seedInventory, snapshotAndClearInventory } from './inventory.js';
import { logger } from '../lib/logger.js';

async function activatePendingSales(): Promise<void> {
  const now = new Date();

  const toActivate = await db
    .select({ id: sales.id, endsAt: sales.endsAt })
    .from(sales)
    .where(and(eq(sales.status, 'draft'), lte(sales.startsAt, now), gte(sales.endsAt, now)));

  for (const sale of toActivate) {
    const saleProducts = await db
      .select({ id: products.id, quantity: products.quantity })
      .from(products)
      .where(eq(products.saleId, sale.id));

    await seedInventory(sale.id, saleProducts, sale.endsAt);
    await db.update(sales).set({ status: 'active' }).where(eq(sales.id, sale.id));
    logger.info({ saleId: sale.id }, 'sale activated');
  }
}

async function endExpiredSales(): Promise<void> {
  const now = new Date();

  const toEnd = await db
    .select({ id: sales.id })
    .from(sales)
    .where(and(eq(sales.status, 'active'), lte(sales.endsAt, now)));

  if (toEnd.length === 0) return;

  const saleIds = toEnd.map((s) => s.id);
  const saleProducts = await db
    .select({ id: products.id, saleId: products.saleId, quantity: products.quantity })
    .from(products)
    .where(inArray(products.saleId, saleIds));

  for (const sale of toEnd) {
    const productIds = saleProducts.filter((p) => p.saleId === sale.id).map((p) => p.id);
    const remaining = await snapshotAndClearInventory(sale.id, productIds);

    // Write final remaining stock back to Postgres
    for (const [productId, qty] of Object.entries(remaining)) {
      await db.update(products).set({ quantity: qty }).where(eq(products.id, productId));
    }

    await db.update(sales).set({ status: 'ended' }).where(eq(sales.id, sale.id));
    logger.info({ saleId: sale.id, remaining }, 'sale ended, inventory snapshotted');
  }
}

export function startScheduler(): cron.ScheduledTask {
  const task = cron.schedule('*/30 * * * * *', () => {
    void activatePendingSales().catch((err) =>
      logger.error({ err }, 'scheduler: activate sales failed'),
    );
    void endExpiredSales().catch((err) =>
      logger.error({ err }, 'scheduler: end sales failed'),
    );
  });
  logger.info('sale scheduler started');
  return task;
}
