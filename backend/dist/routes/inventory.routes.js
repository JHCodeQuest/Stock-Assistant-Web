"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("../controllers/inventory.controller");
const router = (0, express_1.Router)();
router.post('/add', inventory_controller_1.addInventory);
router.get('/', inventory_controller_1.getInventory);
router.get('/search', inventory_controller_1.searchInventory);
router.post('/match-image', inventory_controller_1.matchImage);
router.post('/adjust', inventory_controller_1.updateStock);
router.get('/low-stock', inventory_controller_1.getLowStockItems);
router.get('/history/:productId', inventory_controller_1.getInventoryHistory);
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map