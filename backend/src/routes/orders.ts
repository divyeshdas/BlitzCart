import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, products, sales } from '../db/schema/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  const userId = req.user!.sub;

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      createdAt: orders.createdAt,
      productName: products.name,
      salePrice: products.salePrice,
      saleName: sales.name,
      saleId: sales.id,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(sales, eq(orders.saleId, sales.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  res.json({ orders: rows });
});

export default router;
