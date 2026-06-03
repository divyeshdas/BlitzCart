import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sales, products } from '../db/schema/index.js';
import { seedInventory, getInventoryCounts } from '../services/inventory.js';
import { requireAdmin } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(requireAdmin);

const productSchema = z.object({
  name: z.string().min(1),
  originalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  quantity: z.number().int().positive(),
});

const createSaleSchema = z.object({
  name: z.string().min(1).max(255),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  products: z.array(productSchema).min(1),
});

router.post('/sales', async (req, res) => {
  const result = createSaleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', requestId: req.id, details: result.error.flatten() });
    return;
  }

  const { name, startsAt, endsAt, products: productList } = result.data;
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  if (endDate <= startDate) {
    res.status(400).json({ error: 'endsAt must be after startsAt', code: 'VALIDATION_ERROR', requestId: req.id });
    return;
  }

  const [sale] = await db
    .insert(sales)
    .values({ name, startsAt: startDate, endsAt: endDate })
    .returning();

  if (!sale) {
    res.status(500).json({ error: 'Failed to create sale', code: 'INTERNAL_ERROR', requestId: req.id });
    return;
  }

  const insertedProducts = await db
    .insert(products)
    .values(productList.map((p) => ({
      saleId: sale.id,
      name: p.name,
      originalPrice: p.originalPrice,
      salePrice: p.salePrice,
      quantity: p.quantity,
    })))
    .returning();

  // Seed inventory immediately if sale is already active or starts in the past
  const now = new Date();
  if (startDate <= now && endDate > now) {
    await seedInventory(sale.id, insertedProducts.map((p) => ({ id: p.id, quantity: p.quantity })), endDate);
    await db.update(sales).set({ status: 'active' }).where(eq(sales.id, sale.id));
    sale.status = 'active';
    logger.info({ saleId: sale.id }, 'sale created and immediately activated');
  } else {
    logger.info({ saleId: sale.id }, 'sale created in draft state');
  }

  res.status(201).json({ sale: { ...sale }, products: insertedProducts });
});

router.get('/sales', async (_req, res) => {
  const allSales = await db.select().from(sales).orderBy(sales.createdAt);

  const salesWithInventory = await Promise.all(
    allSales.map(async (sale) => {
      const saleProducts = await db
        .select()
        .from(products)
        .where(eq(products.saleId, sale.id));

      const productIds = saleProducts.map((p) => p.id);
      const inventory = sale.status === 'active'
        ? await getInventoryCounts(sale.id, productIds)
        : {};

      return {
        ...sale,
        products: saleProducts.map((p) => ({
          ...p,
          inventoryRemaining: inventory[p.id] ?? null,
        })),
      };
    }),
  );

  res.json({ sales: salesWithInventory });
});

router.get('/sales/:id', async (req, res) => {
  const [sale] = await db.select().from(sales).where(eq(sales.id, req.params['id'] ?? ''));
  if (!sale) {
    res.status(404).json({ error: 'Sale not found', code: 'NOT_FOUND', requestId: req.id });
    return;
  }

  const saleProducts = await db.select().from(products).where(eq(products.saleId, sale.id));
  const inventory = sale.status === 'active'
    ? await getInventoryCounts(sale.id, saleProducts.map((p) => p.id))
    : {};

  res.json({
    sale,
    products: saleProducts.map((p) => ({ ...p, inventoryRemaining: inventory[p.id] ?? null })),
  });
});

export default router;
