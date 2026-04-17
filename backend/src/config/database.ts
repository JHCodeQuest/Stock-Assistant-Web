import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  max: 5,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export const initDatabase = async () => {
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
        unit_price DECIMAL(10,2) DEFAULT 0,
        category VARCHAR(50),
        location VARCHAR(15),
        image_url VARCHAR(255),
        description VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='unit_price') THEN
          ALTER TABLE inventory ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0;
        END IF;
      END $$;
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
  } finally {
    client.release();
  }
};

export const cleanupOldHistory = async (daysToKeep: number = 30) => {
  try {
    const result = await pool.query(
      `DELETE FROM inventory_history WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} old history records`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

setInterval(() => cleanupOldHistory(30), 24 * 60 * 60 * 1000);

export default pool;
