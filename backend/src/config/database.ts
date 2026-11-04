import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Hosted databases' external URLs (Render, Neon, Supabase) need TLS; local and Render-internal
// hosts don't. DATABASE_SSL=true or false overrides the guess.
const sslSetting = () => {
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DATABASE_SSL === 'false') return false;
  const url = process.env.DATABASE_URL || '';
  return /sslmode=require|render\.com|neon\.tech|supabase\.co/.test(url) ? { rejectUnauthorized: false } : false;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslSetting(),
  max: 5,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

let ready = false;

// True once the tables exist and the API can serve data.
export const isDatabaseReady = () => ready;

export const checkDatabase = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

// Keeps retrying in the background (2s, 4s, 8s ... up to 60s) instead of exiting. Exiting made
// Render restart the service in a loop with no port open, so every request just hung.
export const connectWithRetry = async (attempt = 1): Promise<void> => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set: the API is up but cannot serve data.');
    return;
  }
  try {
    await initDatabase();
  } catch (error: any) {
    const delaySeconds = Math.min(60, 2 ** attempt);
    console.error(`Database unavailable (${error?.code || error?.message}); retry ${attempt} in ${delaySeconds}s`);
    setTimeout(() => connectWithRetry(attempt + 1), delaySeconds * 1000);
  }
};

export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(120) UNIQUE NOT NULL,
        password_hash VARCHAR(60) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'staff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CREATE TABLE IF NOT EXISTS does not update defaults on existing installations.
    await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'staff'");

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

    ready = true;
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

// unref: the open server keeps the process alive, so this timer alone shouldn't (it would hang tests).
setInterval(() => cleanupOldHistory(30), 24 * 60 * 60 * 1000).unref();

export default pool;
