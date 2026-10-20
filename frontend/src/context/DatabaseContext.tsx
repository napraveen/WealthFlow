import React, { createContext, useContext, useState, useEffect } from 'react';
import { sql, eq, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db, expoDb } from '../db/client';
import {
  accounts,
  categories,
  subcategories,
  transactions,
  budgets,
  recurringBills,
  lending,
  noteTopics,
  noteFields,
  noteEntries,
  appSettings,
  Account,
  Category,
  Subcategory,
  Transaction,
  Budget,
  RecurringBill,
  Lending,
  NoteTopic,
  NoteField,
  NoteEntry,
  AppSetting
} from '../db/schema';
import { seedDatabase } from '../db/seed';
import { checkAndRegisterBackgroundBackupIfNeeded } from '../utils/backgroundBackup';

export interface RichTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  note: string | null;
  createdAt: string | null;
  accountId: string;
  accountName: string;
  accountColor: string;
  accountIcon: string;
  toAccountId: string | null;
  toAccountName: string | null;
  toAccountColor: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
}

export interface RichBudget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
  amount: number;
  spent: number;
  startDate: string;
  endDate: string;
}

export interface RichRecurringBill {
  id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextBillingDate: string;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  accountId: string;
  accountName: string;
}

interface DatabaseContextType {
  isInitialized: boolean;
  accounts: Account[];
  transactions: RichTransaction[];
  budgets: RichBudget[];
  categories: Category[];
  subcategories: Subcategory[];
  recurringBills: RichRecurringBill[];
  lending: Lending[];
  noteTopicsList: NoteTopic[];
  noteFieldsList: NoteField[];
  noteEntriesList: NoteEntry[];
  totalNetWorth: number;
  isDarkMode: boolean;
  toggleTheme: () => void;
  refreshData: () => Promise<void>;
  addTransaction: (data: {
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    subcategoryId?: string | null;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    date: string;
    note: string;
  }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  resetDatabase: () => Promise<void>;
  upsertBudget: (categoryId: string, amount: number, subcategoryId?: string | null) => Promise<void>;
  exportDatabase: () => Promise<any>;
  importDatabase: (data: any) => Promise<void>;
  clearAllData: () => Promise<void>;
  updateTransaction: (
    id: string,
    data: {
      accountId: string;
      toAccountId: string | null;
      categoryId: string | null;
      subcategoryId?: string | null;
      amount: number;
      type: 'income' | 'expense' | 'transfer';
      date: string;
      note: string;
    }
  ) => Promise<void>;
  addCategory: (name: string, type: 'income' | 'expense', icon: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateCategory: (id: string, name: string, icon: string, color: string) => Promise<void>;
  addSubcategory: (name: string, categoryId: string) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;
  updateSubcategory: (id: string, name: string) => Promise<void>;
  addLending: (personName: string, amount: number, date: string, notes: string | null) => Promise<void>;
  updateLending: (id: string, personName: string, amount: number, date: string, notes: string | null, isSettled: boolean) => Promise<void>;
  deleteLending: (id: string) => Promise<void>;
  toggleLendingSettled: (id: string) => Promise<void>;
  addRecurringBill: (
    name: string,
    amount: number,
    categoryId: string,
    accountId: string,
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
    nextBillingDate: string
  ) => Promise<void>;
  deleteRecurringBill: (id: string) => Promise<void>;
  getSetting: (key: string) => string | null;
  updateSetting: (key: string, value: string) => void;
  // Note topics/fields/entries CRUD
  addNoteTopic: (name: string, showTotal: boolean, totalLabel: string) => Promise<void>;
  updateNoteTopic: (id: string, name: string, showTotal: boolean, totalLabel: string) => Promise<void>;
  deleteNoteTopic: (id: string) => Promise<void>;
  addNoteField: (topicId: string, name: string, type: 'text' | 'number') => Promise<void>;
  updateNoteField: (id: string, name: string, type: 'text' | 'number') => Promise<void>;
  deleteNoteField: (id: string) => Promise<void>;
  addNoteEntry: (topicId: string, data: Record<string, string | number>) => Promise<void>;
  updateNoteEntry: (id: string, data: Record<string, string | number>) => Promise<void>;
  deleteNoteEntry: (id: string) => Promise<void>;
  toggleNoteEntrySettled: (id: string) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [transactionsList, setTransactionsList] = useState<RichTransaction[]>([]);
  const [budgetsList, setBudgetsList] = useState<RichBudget[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [subcategoriesList, setSubcategoriesList] = useState<Subcategory[]>([]);
  const [recurringList, setRecurringList] = useState<RichRecurringBill[]>([]);
  const [lendingList, setLendingList] = useState<Lending[]>([]);
  const [noteTopicsListState, setNoteTopicsListState] = useState<NoteTopic[]>([]);
  const [noteFieldsListState, setNoteFieldsListState] = useState<NoteField[]>([]);
  const [noteEntriesListState, setNoteEntriesListState] = useState<NoteEntry[]>([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    const nextVal = !isDarkMode;
    setIsDarkMode(nextVal);
    updateSetting('is_dark_mode', nextVal ? 'true' : 'false');
  };

  const getSetting = (key: string): string | null => {
    try {
      const setting = expoDb.getFirstSync<{ value: string }>(`SELECT value FROM app_settings WHERE key = '${key}'`);
      return setting ? setting.value : null;
    } catch (err) {
      console.error('Failed to get setting:', err);
      return null;
    }
  };

  const updateSetting = (key: string, value: string) => {
    try {
      expoDb.execSync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('${key}', '${value}');`);
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const initDbTables = () => {
    try {
      expoDb.execSync(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('cash', 'bank', 'credit')) NOT NULL,
          balance REAL NOT NULL DEFAULT 0,
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS subcategories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category_id TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          to_account_id TEXT,
          category_id TEXT,
          subcategory_id TEXT,
          amount REAL NOT NULL,
          type TEXT CHECK(type IN ('income', 'expense', 'transfer')) NOT NULL,
          date TEXT NOT NULL,
          note TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL,
          subcategory_id TEXT,
          amount REAL NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
          FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS recurring_bills (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          category_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
          next_billing_date TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS lending (
          id TEXT PRIMARY KEY,
          person_name TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          is_settled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS note_topics (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          show_total INTEGER NOT NULL DEFAULT 0,
          total_label TEXT NOT NULL DEFAULT 'Total',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS note_fields (
          id TEXT PRIMARY KEY,
          topic_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('text', 'number')) NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (topic_id) REFERENCES note_topics(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS note_entries (
          id TEXT PRIMARY KEY,
          topic_id TEXT NOT NULL,
          data TEXT NOT NULL,
          is_settled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (topic_id) REFERENCES note_topics(id) ON DELETE CASCADE
        );
      `);

      try {
        expoDb.execSync("ALTER TABLE budgets ADD COLUMN subcategory_id TEXT;");
      } catch (_) {}

      // Migrate lending data to note_entries if note_topics is empty
      try {
        const topicCount = expoDb.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM note_topics;");
        const lendingCount = expoDb.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM lending;");
        
        if ((!topicCount || topicCount.cnt === 0) && lendingCount && lendingCount.cnt > 0) {
          // Create default "Unsettled" topic with Person Name and Amount fields
          const topicId = 'topic-lending-default';
          const fieldPersonId = 'field-lending-person';
          const fieldAmountId = 'field-lending-amount';
          
          expoDb.execSync(`INSERT INTO note_topics (id, name, show_total, total_label, sort_order) VALUES ('${topicId}', 'Unsettled', 1, 'Total Outstanding', 0);`);
          expoDb.execSync(`INSERT INTO note_fields (id, topic_id, name, type, sort_order) VALUES ('${fieldPersonId}', '${topicId}', 'Person Name', 'text', 0);`);
          expoDb.execSync(`INSERT INTO note_fields (id, topic_id, name, type, sort_order) VALUES ('${fieldAmountId}', '${topicId}', 'Amount', 'number', 1);`);
          
          // Migrate lending entries
          const lendingRows = expoDb.getAllSync<{ id: string; person_name: string; amount: number; is_settled: number; created_at: string }>(
            "SELECT id, person_name, amount, is_settled, created_at FROM lending;"
          );
          
          for (const row of lendingRows) {
            const dataJson = JSON.stringify({ [fieldPersonId]: row.person_name, [fieldAmountId]: row.amount });
            expoDb.execSync(`INSERT INTO note_entries (id, topic_id, data, is_settled, created_at) VALUES ('ne-${row.id}', '${topicId}', '${dataJson.replace(/'/g, "''")}', ${row.is_settled}, '${row.created_at || ''}');`);
          }
          console.log('Migrated lending data to note_entries.');
        } else if (!topicCount || topicCount.cnt === 0) {
          // No lending data either — create default "Unsettled" topic
          const topicId = 'topic-lending-default';
          const fieldPersonId = 'field-lending-person';
          const fieldAmountId = 'field-lending-amount';
          
          expoDb.execSync(`INSERT INTO note_topics (id, name, show_total, total_label, sort_order) VALUES ('${topicId}', 'Unsettled', 1, 'Total Outstanding', 0);`);
          expoDb.execSync(`INSERT INTO note_fields (id, topic_id, name, type, sort_order) VALUES ('${fieldPersonId}', '${topicId}', 'Person Name', 'text', 0);`);
          expoDb.execSync(`INSERT INTO note_fields (id, topic_id, name, type, sort_order) VALUES ('${fieldAmountId}', '${topicId}', 'Amount', 'number', 1);`);
        }
      } catch (migErr) {
        console.log('Note migration check:', migErr);
      }

      console.log('Database tables successfully verified/created.');
    } catch (err) {
      console.error('Failed to create SQLite tables:', err);
    }
  };

  const refreshData = async () => {
    try {
      // 1. Fetch Accounts
      const rawAccounts = await db.select().from(accounts);
      setAccountsList(rawAccounts);

      const worth = rawAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      setTotalNetWorth(worth);

      // 2. Fetch Categories
      const rawCategories = await db.select().from(categories);
      setCategoriesList(rawCategories);

      const rawSubcategories = await db.select().from(subcategories);
      setSubcategoriesList(rawSubcategories);

      // 3. Fetch Budgets with category and subcategory details
      const rawBudgets = await db
        .select({
          id: budgets.id,
          categoryId: budgets.categoryId,
          subcategoryId: budgets.subcategoryId || null,
          amount: budgets.amount,
          startDate: budgets.startDate,
          endDate: budgets.endDate,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          subcategoryName: subcategories.name,
        })
        .from(budgets)
        .innerJoin(categories, eq(budgets.categoryId, categories.id))
        .leftJoin(subcategories, eq(budgets.subcategoryId, subcategories.id));

      const richBudgets: RichBudget[] = [];
      for (const bud of rawBudgets) {
        const condition = bud.subcategoryId
          ? sql`${transactions.categoryId} = ${bud.categoryId} 
              AND ${transactions.subcategoryId} = ${bud.subcategoryId}
              AND ${transactions.type} = 'expense' 
              AND ${transactions.date} >= ${bud.startDate} 
              AND ${transactions.date} <= ${bud.endDate}`
          : sql`${transactions.categoryId} = ${bud.categoryId} 
              AND ${transactions.type} = 'expense' 
              AND ${transactions.date} >= ${bud.startDate} 
              AND ${transactions.date} <= ${bud.endDate}`;

        const [spentSum] = await db
          .select({
            total: sql<number>`SUM(${transactions.amount})`,
          })
          .from(transactions)
          .where(condition);

        richBudgets.push({
          ...bud,
          spent: spentSum?.total || 0,
        });
      }
      setBudgetsList(richBudgets);

      // 4. Fetch Recurring Bills with joined categories and accounts
      const rawRecurring = await db
        .select({
          id: recurringBills.id,
          name: recurringBills.name,
          amount: recurringBills.amount,
          frequency: recurringBills.frequency,
          nextBillingDate: recurringBills.nextBillingDate,
          isActive: recurringBills.isActive,
          categoryId: recurringBills.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          accountId: recurringBills.accountId,
          accountName: accounts.name,
        })
        .from(recurringBills)
        .innerJoin(categories, eq(recurringBills.categoryId, categories.id))
        .innerJoin(accounts, eq(recurringBills.accountId, accounts.id));
      setRecurringList(rawRecurring);

      // 5. Fetch Transactions with category, origin account, and target transfer account (alias)
      const toAccounts = alias(accounts, 'to_accounts');

      const rawTransactions = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          type: transactions.type,
          date: transactions.date,
          note: transactions.note,
          createdAt: transactions.createdAt,
          accountId: transactions.accountId,
          accountName: accounts.name,
          accountColor: accounts.color,
          accountIcon: accounts.icon,
          toAccountId: transactions.toAccountId,
          toAccountName: toAccounts.name,
          toAccountColor: toAccounts.color,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          subcategoryId: transactions.subcategoryId || null,
          subcategoryName: subcategories.name,
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(toAccounts, eq(transactions.toAccountId, toAccounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
        .orderBy(desc(transactions.date));

      setTransactionsList(rawTransactions);

      // 6. Fetch Lending Helps
      const rawLending = await db.select().from(lending);
      setLendingList(rawLending);

      // 7. Fetch Note Topics, Fields, Entries
      const rawNoteTopics = await db.select().from(noteTopics);
      setNoteTopicsListState(rawNoteTopics.sort((a, b) => a.sortOrder - b.sortOrder));

      const rawNoteFields = await db.select().from(noteFields);
      setNoteFieldsListState(rawNoteFields.sort((a, b) => a.sortOrder - b.sortOrder));

      const rawNoteEntries = await db.select().from(noteEntries);
      setNoteEntriesListState(rawNoteEntries);
    } catch (error) {
      console.error('Error refreshing offline database state:', error);
    }
  };

  const addTransaction = async (data: {
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    subcategoryId?: string | null;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    date: string;
    note: string;
  }) => {
    const txId = `tx-${Date.now()}`;
    const amountVal = parseFloat(data.amount.toFixed(2));

    try {
      await db.insert(transactions).values({
        id: txId,
        accountId: data.accountId,
        toAccountId: data.toAccountId,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        amount: amountVal,
        type: data.type,
        date: data.date,
        note: data.note || null,
      });

      if (data.type === 'income') {
        await db
          .update(accounts)
          .set({ balance: sql`balance + ${amountVal}` })
          .where(eq(accounts.id, data.accountId));
      } else if (data.type === 'expense') {
        await db
          .update(accounts)
          .set({ balance: sql`balance - ${amountVal}` })
          .where(eq(accounts.id, data.accountId));
      } else if (data.type === 'transfer' && data.toAccountId) {
        await db
          .update(accounts)
          .set({ balance: sql`balance - ${amountVal}` })
          .where(eq(accounts.id, data.accountId));

        await db
          .update(accounts)
          .set({ balance: sql`balance + ${amountVal}` })
          .where(eq(accounts.id, data.toAccountId));
      }

      await refreshData();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (txId: string) => {
    try {
      const [tx] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txId));

      if (!tx) return;

      const amountVal = tx.amount;

      if (tx.type === 'income') {
        await db
          .update(accounts)
          .set({ balance: sql`balance - ${amountVal}` })
          .where(eq(accounts.id, tx.accountId));
      } else if (tx.type === 'expense') {
        await db
          .update(accounts)
          .set({ balance: sql`balance + ${amountVal}` })
          .where(eq(accounts.id, tx.accountId));
      } else if (tx.type === 'transfer' && tx.toAccountId) {
        await db
          .update(accounts)
          .set({ balance: sql`balance + ${amountVal}` })
          .where(eq(accounts.id, tx.accountId));

        await db
          .update(accounts)
          .set({ balance: sql`balance - ${amountVal}` })
          .where(eq(accounts.id, tx.toAccountId));
      }

      await db.delete(transactions).where(eq(transactions.id, txId));
      await refreshData();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      throw error;
    }
  };

  const resetDatabase = async () => {
    try {
      await seedDatabase();
      await refreshData();
    } catch (err) {
      console.error('Failed to reset/seed database:', err);
    }
  };

  const upsertBudget = async (categoryId: string, amount: number, subcategoryId?: string | null) => {
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      const startDate = `${currentYear}-${currentMonth}-01`;
      const endDate = `${currentYear}-${currentMonth}-31`;
      const budgetId = subcategoryId ? `bud-${categoryId}-${subcategoryId}` : `bud-${categoryId}`;

      const condition = subcategoryId
        ? sql`${budgets.categoryId} = ${categoryId} AND ${budgets.subcategoryId} = ${subcategoryId}`
        : sql`${budgets.categoryId} = ${categoryId} AND (${budgets.subcategoryId} IS NULL OR ${budgets.subcategoryId} = '')`;

      const existing = await db
        .select()
        .from(budgets)
        .where(condition);

      if (existing.length > 0) {
        await db
          .update(budgets)
          .set({ amount })
          .where(eq(budgets.id, existing[0].id));
      } else {
        await db.insert(budgets).values({
          id: budgetId,
          categoryId,
          subcategoryId: subcategoryId || null,
          amount,
          startDate,
          endDate,
        });
      }
      await refreshData();
    } catch (error) {
      console.error('Failed to upsert budget:', error);
      throw error;
    }
  };

  const exportDatabase = async () => {
    try {
      const rawAccounts = await db.select().from(accounts);
      const rawCategories = await db.select().from(categories);
      const rawSubcategories = await db.select().from(subcategories);
      const rawTransactions = await db.select().from(transactions);
      const rawBudgets = await db.select().from(budgets);
      const rawRecurring = await db.select().from(recurringBills);
      const rawLending = await db.select().from(lending);
      const rawNoteTopics = await db.select().from(noteTopics);
      const rawNoteFields = await db.select().from(noteFields);
      const rawNoteEntries = await db.select().from(noteEntries);

      return {
        wealthflow_export: true,
        version: 3,
        accounts: rawAccounts,
        categories: rawCategories,
        subcategories: rawSubcategories,
        transactions: rawTransactions,
        budgets: rawBudgets,
        recurringBills: rawRecurring,
        lending: rawLending,
        noteTopics: rawNoteTopics,
        noteFields: rawNoteFields,
        noteEntries: rawNoteEntries,
      };
    } catch (err) {
      console.error('Failed to export database:', err);
      throw err;
    }
  };

  const importDatabase = async (backup: any) => {
    try {
      // Clear all tables in child-to-parent order to respect foreign key constraints
      await db.delete(noteEntries);
      await db.delete(noteFields);
      await db.delete(noteTopics);
      await db.delete(transactions);
      await db.delete(budgets);
      await db.delete(recurringBills);
      await db.delete(subcategories);
      await db.delete(categories);
      await db.delete(accounts);
      await db.delete(lending);

      // Insert in parent-to-child order
      if (backup.accounts && backup.accounts.length > 0) {
        const sanitizedAccounts = backup.accounts.map((a: any) => ({ ...a, balance: a.balance ?? 0 }));
        await db.insert(accounts).values(sanitizedAccounts);
      }
      if (backup.categories && backup.categories.length > 0) {
        await db.insert(categories).values(backup.categories);
      }
      if (backup.subcategories && backup.subcategories.length > 0) {
        await db.insert(subcategories).values(backup.subcategories);
      }
      if (backup.transactions && backup.transactions.length > 0) {
        const sanitizedTxs = backup.transactions.map((t: any) => ({ ...t, amount: t.amount ?? 0 }));
        await db.insert(transactions).values(sanitizedTxs);
      }
      if (backup.budgets && backup.budgets.length > 0) {
        const sanitizedBudgets = backup.budgets.map((b: any) => ({ ...b, amount: b.amount ?? 0 }));
        await db.insert(budgets).values(sanitizedBudgets);
      }
      if (backup.recurringBills && backup.recurringBills.length > 0) {
        const sanitizedBills = backup.recurringBills.map((b: any) => ({ ...b, amount: b.amount ?? 0 }));
        await db.insert(recurringBills).values(sanitizedBills);
      }
      if (backup.lending && backup.lending.length > 0) {
        const sanitizedLending = backup.lending.map((l: any) => ({ ...l, amount: l.amount ?? 0 }));
        await db.insert(lending).values(sanitizedLending);
      }
      // Import note topics, fields, entries (new in v3, absent in older backups)
      if (backup.noteTopics && backup.noteTopics.length > 0) {
        await db.insert(noteTopics).values(backup.noteTopics);
      }
      if (backup.noteFields && backup.noteFields.length > 0) {
        await db.insert(noteFields).values(backup.noteFields);
      }
      if (backup.noteEntries && backup.noteEntries.length > 0) {
        await db.insert(noteEntries).values(backup.noteEntries);
      }

      await refreshData();

      // Safeguard: if accounts are empty after import, re-seed to prevent blank homescreen
      const postImportAccounts = await db.select().from(accounts);
      if (postImportAccounts.length === 0) {
        console.warn('Import resulted in empty accounts — re-seeding defaults.');
        await seedDatabase();
        await refreshData();
      }
    } catch (err) {
      console.error('Failed to import database:', err);
      // Safeguard: re-seed defaults if import crashes to prevent blank homescreen
      try {
        await seedDatabase();
        await refreshData();
      } catch (seedErr) {
        console.error('Failed to seed after import error:', seedErr);
      }
      throw err;
    }
  };

  const clearAllData = async () => {
    try {
      await seedDatabase();
      await refreshData();
    } catch (err) {
      console.error('Failed to clear database:', err);
      throw err;
    }
  };

  const updateTransaction = async (
    txId: string,
    data: {
      accountId: string;
      toAccountId: string | null;
      categoryId: string | null;
      subcategoryId?: string | null;
      amount: number;
      type: 'income' | 'expense' | 'transfer';
      date: string;
      note: string;
    }
  ) => {
    try {
      const [oldTx] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txId));

      if (!oldTx) return;

      const oldAmount = oldTx.amount;
      const newAmount = parseFloat(data.amount.toFixed(2));

      // Reverse old tx balance changes
      if (oldTx.type === 'income') {
        await db
          .update(accounts)
          .set({ balance: sql`balance - ${oldAmount}` })
          .where(eq(accounts.id, oldTx.accountId));
      } else if (oldTx.type === 'expense') {
        await db
          .update(accounts)
          .set({ balance: sql`balance + ${oldAmount}` })
          .where(eq(accounts.id, oldTx.accountId));
      }

      // Update record
      await db
        .update(transactions)
        .set({
          accountId: data.accountId,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || null,
          amount: newAmount,
          type: data.type,
          date: data.date,
          note: data.note || null,
        })
        .where(eq(transactions.id, txId));

      // Apply new balance changes
      if (data.type === 'income') {
        await db
          .update(accounts)
          .set({ balance: sql`balance + ${newAmount}` })
          .where(eq(accounts.id, data.accountId));
      } else if (data.type === 'expense') {
        await db
          .update(accounts)
          .set({ balance: sql`balance - ${newAmount}` })
          .where(eq(accounts.id, data.accountId));
      }

      await refreshData();
    } catch (err) {
      console.error('Failed to update transaction:', err);
      throw err;
    }
  };

  const addCategory = async (name: string, type: 'income' | 'expense', icon: string, color: string) => {
    try {
      const id = `cat-${Date.now()}`;
      await db.insert(categories).values({ id, name, type, icon, color });
      await refreshData();
    } catch (err) {
      console.error('Failed to add category:', err);
      throw err;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await db.delete(categories).where(eq(categories.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete category:', err);
      throw err;
    }
  };

  const addSubcategory = async (name: string, categoryId: string) => {
    try {
      const id = `subcat-${Date.now()}`;
      await db.insert(subcategories).values({ id, name, categoryId });
      await refreshData();
    } catch (err) {
      console.error('Failed to add subcategory:', err);
      throw err;
    }
  };

  const deleteSubcategory = async (id: string) => {
    try {
      await db.delete(subcategories).where(eq(subcategories.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete subcategory:', err);
      throw err;
    }
  };

  const updateCategory = async (id: string, name: string, icon: string, color: string) => {
    try {
      await db.update(categories).set({ name, icon, color }).where(eq(categories.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to update category:', err);
      throw err;
    }
  };

  const updateSubcategory = async (id: string, name: string) => {
    try {
      await db.update(subcategories).set({ name }).where(eq(subcategories.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to update subcategory:', err);
      throw err;
    }
  };

  // Note Topic CRUD
  const addNoteTopic = async (name: string, showTotal: boolean, totalLabel: string) => {
    try {
      const id = `topic-${Date.now()}`;
      const maxOrder = noteTopicsListState.reduce((max, t) => Math.max(max, t.sortOrder), -1);
      await db.insert(noteTopics).values({ id, name, showTotal, totalLabel, sortOrder: maxOrder + 1 });
      await refreshData();
    } catch (err) {
      console.error('Failed to add note topic:', err);
      throw err;
    }
  };

  const updateNoteTopic = async (id: string, name: string, showTotal: boolean, totalLabel: string) => {
    try {
      await db.update(noteTopics).set({ name, showTotal, totalLabel }).where(eq(noteTopics.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to update note topic:', err);
      throw err;
    }
  };

  const deleteNoteTopic = async (id: string) => {
    try {
      await db.delete(noteTopics).where(eq(noteTopics.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete note topic:', err);
      throw err;
    }
  };

  // Note Field CRUD
  const addNoteField = async (topicId: string, name: string, type: 'text' | 'number') => {
    try {
      const id = `field-${Date.now()}`;
      const topicFields = noteFieldsListState.filter(f => f.topicId === topicId);
      const maxOrder = topicFields.reduce((max, f) => Math.max(max, f.sortOrder), -1);
      await db.insert(noteFields).values({ id, topicId, name, type, sortOrder: maxOrder + 1 });
      await refreshData();
    } catch (err) {
      console.error('Failed to add note field:', err);
      throw err;
    }
  };

  const updateNoteField = async (id: string, name: string, type: 'text' | 'number') => {
    try {
      await db.update(noteFields).set({ name, type }).where(eq(noteFields.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to update note field:', err);
      throw err;
    }
  };

  const deleteNoteField = async (id: string) => {
    try {
      await db.delete(noteFields).where(eq(noteFields.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete note field:', err);
      throw err;
    }
  };

  // Note Entry CRUD
  const addNoteEntry = async (topicId: string, data: Record<string, string | number>) => {
    try {
      const id = `ne-${Date.now()}`;
      await db.insert(noteEntries).values({ id, topicId, data: JSON.stringify(data), isSettled: false });
      await refreshData();
    } catch (err) {
      console.error('Failed to add note entry:', err);
      throw err;
    }
  };

  const updateNoteEntry = async (id: string, data: Record<string, string | number>) => {
    try {
      await db.update(noteEntries).set({ data: JSON.stringify(data) }).where(eq(noteEntries.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to update note entry:', err);
      throw err;
    }
  };

  const deleteNoteEntry = async (id: string) => {
    try {
      await db.delete(noteEntries).where(eq(noteEntries.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete note entry:', err);
      throw err;
    }
  };

  const toggleNoteEntrySettled = async (id: string) => {
    try {
      const entry = noteEntriesListState.find(e => e.id === id);
      if (!entry) return;
      await db.update(noteEntries).set({ isSettled: !entry.isSettled }).where(eq(noteEntries.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to toggle note entry settled:', err);
      throw err;
    }
  };

  // Lending operations
  const addLending = async (personName: string, amount: number, date: string, notes: string | null) => {
    try {
      const id = `lend-${Date.now()}`;
      await db.insert(lending).values({
        id,
        personName,
        amount,
        date,
        notes: notes || null,
        isSettled: false,
      });
      await refreshData();
    } catch (err) {
      console.error('Failed to add lending entry:', err);
      throw err;
    }
  };

  const updateLending = async (id: string, personName: string, amount: number, date: string, notes: string | null, isSettled: boolean) => {
    try {
      await db
        .update(lending)
        .set({ personName, amount, date, notes: notes || null, isSettled })
        .where(eq(lending.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to update lending entry:', err);
      throw err;
    }
  };

  const toggleLendingSettled = async (id: string) => {
    try {
      const entry = lendingList.find(l => l.id === id);
      if (!entry) return;
      await db
        .update(lending)
        .set({ isSettled: !entry.isSettled })
        .where(eq(lending.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to toggle lending settled state:', err);
      throw err;
    }
  };

  const deleteLending = async (id: string) => {
    try {
      await db.delete(lending).where(eq(lending.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete lending entry:', err);
      throw err;
    }
  };

  const addRecurringBill = async (
    name: string,
    amount: number,
    categoryId: string,
    accountId: string,
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
    nextBillingDate: string
  ) => {
    try {
      const id = `rec-${Date.now()}`;
      await db.insert(recurringBills).values({
        id,
        name,
        amount,
        categoryId,
        accountId,
        frequency,
        nextBillingDate,
        isActive: true,
      });
      await refreshData();
    } catch (err) {
      console.error('Failed to add recurring bill:', err);
      throw err;
    }
  };

  const deleteRecurringBill = async (id: string) => {
    try {
      await db.delete(recurringBills).where(eq(recurringBills.id, id));
      await refreshData();
    } catch (err) {
      console.error('Failed to delete recurring bill:', err);
      throw err;
    }
  };

  useEffect(() => {
    const startup = async () => {
      initDbTables();

      // Load settings
      try {
        const themeSetting = expoDb.getFirstSync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'is_dark_mode'");
        if (themeSetting) {
          setIsDarkMode(themeSetting.value === 'true');
        }
      } catch (settingsErr) {
        console.error('Failed to load settings from DB:', settingsErr);
      }

      // Proactively purge legacy subscriptions category if it exists
      await db.delete(categories).where(eq(categories.id, 'cat-subscriptions'));

      // Migrate Transport & Uber category name to Transport
      try {
        expoDb.execSync("UPDATE categories SET name = 'Transport' WHERE name = 'Transport & Uber';");
      } catch (catErr) {
        console.error('Failed to update category name:', catErr);
      }

      // Sanitize any NULL numeric columns introduced by corrupted backups
      try {
        expoDb.execSync("UPDATE transactions SET amount = 0 WHERE amount IS NULL;");
        expoDb.execSync("UPDATE budgets SET amount = 0 WHERE amount IS NULL;");
        expoDb.execSync("UPDATE lending SET amount = 0 WHERE amount IS NULL;");
        expoDb.execSync("UPDATE accounts SET balance = 0 WHERE balance IS NULL;");
      } catch (e) {
        console.error('Failed to sanitize null numeric columns:', e);
      }

      // Initialize seed only if database is completely empty (e.g. fresh installation)
      const existingAccounts = await db.select().from(accounts);
      if (existingAccounts.length === 0) {
        await seedDatabase();
      }

      // Startup auto backup registration verification
      await checkAndRegisterBackgroundBackupIfNeeded();

      await refreshData();
      setIsInitialized(true);
    };
    startup();
  }, []);

  return (
    <DatabaseContext.Provider
      value={{
        isInitialized,
        accounts: accountsList,
        transactions: transactionsList,
        budgets: budgetsList,
        categories: categoriesList,
        subcategories: subcategoriesList,
        recurringBills: recurringList,
        lending: lendingList,
        noteTopicsList: noteTopicsListState,
        noteFieldsList: noteFieldsListState,
        noteEntriesList: noteEntriesListState,
        totalNetWorth,
        isDarkMode,
        toggleTheme,
        refreshData,
        addTransaction,
        deleteTransaction,
        resetDatabase,
        upsertBudget,
        exportDatabase,
        importDatabase,
        clearAllData,
        updateTransaction,
        addCategory,
        deleteCategory,
        updateCategory,
        addSubcategory,
        deleteSubcategory,
        updateSubcategory,
        addLending,
        updateLending,
        deleteLending,
        toggleLendingSettled,
        addRecurringBill,
        deleteRecurringBill,
        getSetting,
        updateSetting,
        addNoteTopic,
        updateNoteTopic,
        deleteNoteTopic,
        addNoteField,
        updateNoteField,
        deleteNoteField,
        addNoteEntry,
        updateNoteEntry,
        deleteNoteEntry,
        toggleNoteEntrySettled,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
