import { db } from './client';
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
  noteEntries
} from './schema';

export const performExportBackup = async () => {
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
    console.error('Failed to perform background database export:', err);
    throw err;
  }
};
