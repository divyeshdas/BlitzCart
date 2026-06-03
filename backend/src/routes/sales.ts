import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sales, products } from '../db/schema/index.js';
import { getInventoryCounts } from '../services/inventory.js';

const router = Router();

router.get('/', async (_req, res) => {
  const activeSales = await db
    .select()
    .from(sales)
    .where(and(eq(sales.status, 'active')));

  const result = await Promise.all(
    activeSales.map(async (sale) => {
      const saleProducts = await db
        .select()
        .from(products)
        .where(eq(products.saleId, sale.id));

      const inventory = await getInventoryCounts(
        sale.id,
        saleProducts.map((p) => p.id),
      );

      return {
        ...sale,
        products: saleProducts.map((p) => ({
          ...p,
          inventoryRemaining: inventory[p.id] ?? p.quantity,
        })),
      };
    }),
  );

  res.json({ sales: result });
});

router.get('/:id', async (req, res) => {
  const [sale] = await db
    .select()
    .from(sales)
    .where(eq(sales.id, req.params['id'] ?? ''));

  if (!sale) {
    res.status(404).json({ error: 'Sale not found', code: 'NOT_FOUND', requestId: req.id });
    return;
  }

  const saleProducts = await db
    .select()
    .from(products)
    .where(eq(products.saleId, sale.id));

  // Redis is authoritative for live stock; fall back to DB column
  const inventory =
    sale.status === 'active'
      ? await getInventoryCounts(sale.id, saleProducts.map((p) => p.id))
      : {};

  res.json({
    sale,
    products: saleProducts.map((p) => ({
      ...p,
      inventoryRemaining: inventory[p.id] ?? p.quantity,
    })),
  });
});

export default router;
