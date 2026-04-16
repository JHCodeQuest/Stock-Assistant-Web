import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import inventoryRoutes from './routes/inventory.routes';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, path.join(__dirname, '../uploads/images'));
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.post('/api/upload', (req: Request, res: Response) => {
  upload.single('image')(req as any, res as any, (err: any) => {
    if (err) {
      return res.status(500).json({ error: 'Upload failed' });
    }
    res.json({ 
      url: `/uploads/images/${(req as any).file?.filename}`,
    });
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Stock Inventory API is running' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/api/dashboard/metrics', async (req: Request, res: Response) => {
  try {
    const pool = require('./config/database').default;
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
    res.json({
      totalProducts: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      totalValue: 0,
      recentTransactions: 0
    });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('joinInventory', (productId: string) => {
    socket.join(`inventory-${productId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload images to: http://localhost:${PORT}/uploads/images/`);
});

export { io, app };
