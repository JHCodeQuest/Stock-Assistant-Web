import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  addInventory,
  getInventory, 
  searchInventory,
  matchImage,
  updateStock, 
  getLowStockItems,
  getInventoryHistory 
} from '../controllers/inventory.controller';

const router = Router();

router.post('/add', addInventory);
router.get('/', getInventory);
router.get('/search', searchInventory);
router.post('/match-image', matchImage);
router.post('/adjust', updateStock);
router.get('/low-stock', getLowStockItems);
router.get('/history/:productId', getInventoryHistory);

export default router;
