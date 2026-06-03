import { pgTable, uuid, varchar, integer, numeric, index } from 'drizzle-orm/pg-core';
import { sales } from './sales';

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    originalPrice: numeric('original_price', { precision: 10, scale: 2 }).notNull(),
    salePrice: numeric('sale_price', { precision: 10, scale: 2 }).notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => ({
    saleIdIdx: index('products_sale_id_idx').on(t.saleId),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
