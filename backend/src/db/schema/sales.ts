import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const saleStatusEnum = pgEnum('sale_status', ['draft', 'active', 'ended']);

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  status: saleStatusEnum('status').notNull().default('draft'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
