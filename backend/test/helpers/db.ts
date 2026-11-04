import { afterAll, beforeAll, beforeEach } from 'vitest';
import pool, { initDatabase } from '../../src/config/database';

// Creates the tables with the app's own initDatabase() and empties them before every test.
export const useTestDatabase = () => {
  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE inventory_history, inventory, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });
};

export { pool };
