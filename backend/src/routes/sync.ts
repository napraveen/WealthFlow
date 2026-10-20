import { Router } from 'express';
import { db } from '../db/client';
import * as schema from '../db/schema';

const router = Router();

// --- PUSH SYNC ROUTE: Receives mobile app dataset and mirrors local state ---
router.post('/push', async (req, res) => {
  const { 
    accounts: accs, 
    categories: cats, 
    transactions: txs, 
    budgets: buds, 
    recurringBills: recs 
  } = req.body;

  try {
    // Perform updates inside an atomic server transaction block
    await db.transaction(async (tx) => {
      // Clear out obsolete database rows
      await tx.delete(schema.transactions);
      await tx.delete(schema.budgets);
      await tx.delete(schema.recurringBills);
      await tx.delete(schema.categories);
      await tx.delete(schema.accounts);

      // Re-insert arrays in proper order (respecting foreign keys constraints)
      if (accs && accs.length > 0) {
        await tx.insert(schema.accounts).values(accs);
      }
      if (cats && cats.length > 0) {
        await tx.insert(schema.categories).values(cats);
      }
      if (txs && txs.length > 0) {
        await tx.insert(schema.transactions).values(txs);
      }
      if (buds && buds.length > 0) {
        await tx.insert(schema.budgets).values(buds);
      }
      if (recs && recs.length > 0) {
        await tx.insert(schema.recurringBills).values(recs);
      }
    });

    res.json({ success: true, message: 'Server database states synchronized successfully.' });
  } catch (error: any) {
    console.error('Push sync process failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Unknown synchronizing error' });
  }
});

// --- PULL SYNC ROUTE: Fetches current server dataset for client recovery ---
router.get('/pull', async (req, res) => {
  try {
    const accs = await db.select().from(schema.accounts);
    const cats = await db.select().from(schema.categories);
    const txs = await db.select().from(schema.transactions);
    const buds = await db.select().from(schema.budgets);
    const recs = await db.select().from(schema.recurringBills);

    res.json({
      accounts: accs,
      categories: cats,
      transactions: txs,
      budgets: buds,
      recurringBills: recs
    });
  } catch (error: any) {
    console.error('Pull sync process failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed fetching recovery dataset' });
  }
});

export default router;
