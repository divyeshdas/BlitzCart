import { pgTable, uuid, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { products } from './products';
import { sales } from './sales';

export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'failed']);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    status: orderStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('orders_user_id_idx').on(t.userId),
    saleIdIdx: index('orders_sale_id_idx').on(t.saleId),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
