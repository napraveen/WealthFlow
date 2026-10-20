import { db } from './client';
import { accounts, categories, subcategories, transactions, budgets, recurringBills, lending } from './schema';

export async function seedDatabase() {
  console.log('--- RESETTING WEALTHFLOW DATABASE TO A CLEAN BLANK SLATE ---');

  // 1. CLEAR ALL TABLES
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(recurringBills);
  await db.delete(subcategories);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(lending);

  // 2. SEED CLEAN DEFAULT ACCOUNTS (Starting with 0.00 balance)
  const mockAccounts = [
    {
      id: 'acc-upi',
      name: 'UPI Balance',
      type: 'bank' as const,
      balance: 0.00,
      color: '#6366F1', // Electric Indigo
      icon: 'Smartphone',
    },
    {
      id: 'acc-cash',
      name: 'Cash Balance',
      type: 'cash' as const,
      balance: 0.00,
      color: '#10B981', // Emerald Mint
      icon: 'Coins',
    },
  ];

  for (const acc of mockAccounts) {
    await db.insert(accounts).values(acc);
  }

  // 3. SEED STANDARD CLEAN CATEGORIES
  const mockCategories = [
    // Income Categories
    { id: 'cat-salary', name: 'Salary', type: 'income' as const, icon: 'Briefcase', color: '#10B981' },
    { id: 'cat-invest', name: 'Investments', type: 'income' as const, icon: 'TrendingUp', color: '#34D399' },
    // Expense Categories
    { id: 'cat-groceries', name: 'Groceries', type: 'expense' as const, icon: 'ShoppingBag', color: '#F59E0B' },
    { id: 'cat-dining', name: 'Dining & Drinks', type: 'expense' as const, icon: 'Utensils', color: '#EF4444' },
    { id: 'cat-rent', name: 'Rent & Housing', type: 'expense' as const, icon: 'Home', color: '#8B5CF6' },
    { id: 'cat-transport', name: 'Transport', type: 'expense' as const, icon: 'Car', color: '#3B82F6' },
    { id: 'cat-entertainment', name: 'Entertainment', type: 'expense' as const, icon: 'Tv', color: '#EC4899' },
  ];

  for (const cat of mockCategories) {
    await db.insert(categories).values(cat);
  }
}
