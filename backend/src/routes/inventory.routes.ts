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

import { validateBody, inventoryBody, adjustmentBody, matchImageBody } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.post('/add', validateBody(inventoryBody), addInventory);
router.get('/', getInventory);
router.get('/search', searchInventory);
router.post('/match-image', validateBody(matchImageBody), matchImage);
router.post('/adjust', validateBody(adjustmentBody), updateStock);
router.get('/low-stock', getLowStockItems);
router.get('/history/:productId', getInventoryHistory);

export default router;
