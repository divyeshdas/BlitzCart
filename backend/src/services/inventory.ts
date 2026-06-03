import { redis } from '../lib/redis.js';

const KEY = (saleId: string, productId: string) => `inventory:${saleId}:${productId}`;

export async function seedInventory(
  saleId: string,
  products: { id: string; quantity: number }[],
  endsAt: Date,
): Promise<void> {
  const ttl = Math.ceil((endsAt.getTime() - Date.now()) / 1000) + 60;
  const pipeline = redis.pipeline();
  for (const p of products) {
    pipeline.set(KEY(saleId, p.id), p.quantity, 'EX', ttl);
  }
  await pipeline.exec();
}

export async function getInventoryCount(saleId: string, productId: string): Promise<number | null> {
  const val = await redis.get(KEY(saleId, productId));
  return val === null ? null : parseInt(val, 10);
}

export async function getInventoryCounts(
  saleId: string,
  productIds: string[],
): Promise<Record<string, number | null>> {
  if (productIds.length === 0) return {};
  const pipeline = redis.pipeline();
  for (const id of productIds) pipeline.get(KEY(saleId, id));
  const results = await pipeline.exec();
  return Object.fromEntries(
    productIds.map((id, i) => {
      const val = results?.[i]?.[1];
      return [id, val !== null && val !== undefined ? parseInt(String(val), 10) : null];
    }),
  );
}

export async function snapshotAndClearInventory(
  saleId: string,
  productIds: string[],
): Promise<Record<string, number>> {
  const counts = await getInventoryCounts(saleId, productIds);
  const pipeline = redis.pipeline();
  for (const id of productIds) pipeline.del(KEY(saleId, id));
  await pipeline.exec();
  return Object.fromEntries(
    productIds.map((id) => [id, counts[id] ?? 0]),
  );
}
