import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { createUploadRouter } from './middleware/upload';
import authRoutes from './routes/auth.routes';
import inventoryRoutes from './routes/inventory.routes';
import pool, { checkDatabase, isDatabaseReady } from './config/database';

dotenv.config();

export const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://jhcodequest.github.io',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

// Restrict API requests to the configured frontend origins.
export const checkOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

const app = express();
// Render terminates requests at its reverse proxy; trust only the nearest hop.
app.set('trust proxy', process.env.RENDER === 'true' ? 1 : false);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: checkOrigin,
  credentials: true
}));
// Request logs drown out test output; Vitest sets NODE_ENV=test.
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json());
app.use(createUploadRouter());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Stock Inventory API is running' });
});

// 200 only when the database answers, so Render's health check and anyone debugging can see
// a database problem instead of a hang.
app.get('/api/health', async (req: Request, res: Response) => {
  const database = !process.env.DATABASE_URL
    ? 'not configured'
    : !isDatabaseReady()
      ? 'connecting'
      : (await checkDatabase())
        ? 'connected'
        : 'unreachable';
  const ok = database === 'connected';
  res.status(ok ? 200 : 503).json({ status: ok ? 'OK' : 'DEGRADED', database, timestamp: new Date().toISOString() });
});

// Until the database is ready, data routes say so instead of each failing its own way.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (isDatabaseReady()) return next();
  res.status(503).json({ error: 'Database unavailable. Try again shortly.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/api/dashboard/metrics', async (req: Request, res: Response) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM inventory');
    const lowStockResult = await pool.query('SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_stock_level');
    const outOfStockResult = await pool.query('SELECT COUNT(*) as count FROM inventory WHERE quantity = 0');

    res.json({
      totalProducts: parseInt(totalResult.rows[0].count),
      lowStockItems: parseInt(lowStockResult.rows[0].count),
      outOfStockItems: parseInt(outOfStockResult.rows[0].count),
      totalValue: 0,
      recentTransactions: 0
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch inventory metrics' });
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export { app };
