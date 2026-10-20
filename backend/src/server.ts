import express from 'express';
import cors from 'cors';
import syncRouter from './routes/sync';
import { db } from './db/client';
import { accounts } from './db/schema';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and raw json parsing
app.use(cors());
app.use(express.json());

// Optional API Key protection for sync routes if SYNC_API_KEY is configured
const authMiddleware: express.RequestHandler = (req, res, next) => {
  const syncApiKey = process.env.SYNC_API_KEY;
  if (syncApiKey) {
    const authHeader = req.headers['authorization'];
    const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const providedKey = req.headers['x-api-key'] || bearerKey;
    if (providedKey !== syncApiKey) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
  }
  next();
};

// Routes binding
app.use('/api/sync', authMiddleware, syncRouter);

// Health check and index routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin stats endpoint showing rows counts
app.get('/api/stats', async (req, res) => {
  try {
    const accList = await db.select().from(accounts);
    res.json({
      configuredAccountsCount: accList.length,
      serverMessage: "WealthFlow sync engine is running."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Boot listening server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` WealthFlow SQLite REST Sync Server      `);
  console.log(` Running on: http://localhost:${PORT}    `);
  console.log(` Ready for offline data replications     `);
  console.log(`=========================================`);
});
