"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const inventory_routes_1 = __importDefault(require("./routes/inventory.routes"));
const database_1 = require("./config/database");
dotenv_1.default.config();
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://jhcodequest.github.io',
    process.env.FRONTEND_URL
].filter(Boolean);
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(null, true);
            }
        },
        credentials: true
    }
});
exports.io = io;
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(null, true);
        }
    },
    credentials: true
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, '../uploads/images'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = multer({ storage });
app.post('/api/upload', (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Upload failed' });
        }
        res.json({
            url: `/uploads/images/${req.file?.filename}`,
        });
    });
});
app.get('/', (req, res) => {
    res.json({ message: 'Stock Inventory API is running' });
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/inventory', inventory_routes_1.default);
app.get('/api/dashboard/metrics', async (req, res) => {
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
    }
    catch (error) {
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
    socket.on('joinInventory', (productId) => {
        socket.join(`inventory-${productId}`);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
        await (0, database_1.initDatabase)();
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Upload images to: http://localhost:${PORT}/uploads/images/`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map