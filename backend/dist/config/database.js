"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldHistory = exports.initDatabase = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    max: 5,
});
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});
const initDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(120) UNIQUE NOT NULL,
        password_hash VARCHAR(60) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        sku VARCHAR(30) NOT NULL,
        quantity SMALLINT DEFAULT 0,
        min_stock_level SMALLINT DEFAULT 10,
        category VARCHAR(50),
        location VARCHAR(15),
        image_url VARCHAR(255),
        description VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_history (
        id SERIAL PRIMARY KEY,
        product_id SMALLINT REFERENCES inventory(id) ON DELETE CASCADE,
        adjustment_type VARCHAR(10) NOT NULL,
        quantity SMALLINT NOT NULL,
        previous_quantity SMALLINT,
        reason VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_history_product ON inventory_history(product_id)`);
        console.log('Database tables initialized');
    }
    finally {
        client.release();
    }
};
exports.initDatabase = initDatabase;
const cleanupOldHistory = async (daysToKeep = 30) => {
    try {
        const result = await pool.query(`DELETE FROM inventory_history WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`);
        if (result.rowCount && result.rowCount > 0) {
            console.log(`Cleaned up ${result.rowCount} old history records`);
        }
    }
    catch (error) {
        console.error('Cleanup error:', error);
    }
};
exports.cleanupOldHistory = cleanupOldHistory;
setInterval(() => (0, exports.cleanupOldHistory)(30), 24 * 60 * 60 * 1000);
exports.default = pool;
//# sourceMappingURL=database.js.map