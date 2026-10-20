import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// --- ACCOUNTS SCHEMA ---
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'cash' | 'bank' | 'credit'>().notNull(),
  balance: real('balance').notNull().default(0),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- CATEGORIES SCHEMA ---
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<'income' | 'expense'>().notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- SUBCATEGORIES SCHEMA ---
export const subcategories = sqliteTable('subcategories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- TRANSACTIONS SCHEMA ---
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  toAccountId: text('to_account_id')
    .references(() => accounts.id, { onDelete: 'set null' }),
  categoryId: text('category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  subcategoryId: text('subcategory_id')
    .references(() => subcategories.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  type: text('type').$type<'income' | 'expense' | 'transfer'>().notNull(),
  date: text('date').notNull(),
  note: text('note'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- BUDGETS SCHEMA ---
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  subcategoryId: text('subcategory_id')
    .references(() => subcategories.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- RECURRING BILLS SCHEMA ---
export const recurringBills = sqliteTable('recurring_bills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  frequency: text('frequency').$type<'daily' | 'weekly' | 'monthly' | 'yearly'>().notNull().default('monthly'),
  nextBillingDate: text('next_billing_date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- LENDING SCHEMA ---
export const lending = sqliteTable('lending', {
  id: text('id').primaryKey(),
  personName: text('person_name').notNull(),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
  isSettled: integer('is_settled', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- NOTE TOPICS SCHEMA ---
export const noteTopics = sqliteTable('note_topics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  showTotal: integer('show_total', { mode: 'boolean' }).notNull().default(false),
  totalLabel: text('total_label').notNull().default('Total'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- NOTE FIELDS SCHEMA ---
export const noteFields = sqliteTable('note_fields', {
  id: text('id').primaryKey(),
  topicId: text('topic_id')
    .notNull()
    .references(() => noteTopics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').$type<'text' | 'number'>().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- NOTE ENTRIES SCHEMA ---
export const noteEntries = sqliteTable('note_entries', {
  id: text('id').primaryKey(),
  topicId: text('topic_id')
    .notNull()
    .references(() => noteTopics.id, { onDelete: 'cascade' }),
  data: text('data').notNull(),
  isSettled: integer('is_settled', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// --- APP SETTINGS SCHEMA ---
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// --- RELATIONSHIPS ---
export const accountsRelations = relations(accounts, ({ many }) => ({
  outgoingTransactions: many(transactions, { relationName: 'fromAccount' }),
  incomingTransactions: many(transactions, { relationName: 'toAccount' }),
  recurringBills: many(recurringBills),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  budgets: many(budgets),
  recurringBills: many(recurringBills),
  subcategories: many(subcategories),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
    relationName: 'fromAccount',
  }),
  toAccount: one(accounts, {
    fields: [transactions.toAccountId],
    references: [accounts.id],
    relationName: 'toAccount',
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [transactions.subcategoryId],
    references: [subcategories.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const recurringBillsRelations = relations(recurringBills, ({ one }) => ({
  account: one(accounts, {
    fields: [recurringBills.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [recurringBills.categoryId],
    references: [categories.id],
  }),
}));

export const noteTopicsRelations = relations(noteTopics, ({ many }) => ({
  fields: many(noteFields),
  entries: many(noteEntries),
}));

export const noteFieldsRelations = relations(noteFields, ({ one }) => ({
  topic: one(noteTopics, {
    fields: [noteFields.topicId],
    references: [noteTopics.id],
  }),
}));

export const noteEntriesRelations = relations(noteEntries, ({ one }) => ({
  topic: one(noteTopics, {
    fields: [noteEntries.topicId],
    references: [noteTopics.id],
  }),
}));
