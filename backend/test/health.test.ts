import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { inventoryAuthorization } from './helpers/fixtures';
import { app } from '../src/app';
import pool, { initDatabase } from '../src/config/database';

// No useTestDatabase() here: these tests need the app as it is before the database is ready,
// then initialise it themselves. They run in order.

describe('before the database is ready', () => {
  it('health reports "not configured" when DATABASE_URL is unset', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: 'DEGRADED', database: 'not configured' });
    } finally {
      process.env.DATABASE_URL = saved;
    }
  });

  it('health reports "connecting"', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'DEGRADED', database: 'connecting' });
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('data routes answer 503 instead of failing their own way', async () => {
    const responses = [
      await request(app).get('/api/inventory'),
      await request(app).get('/api/dashboard/metrics'),
      await request(app).post('/api/auth/login').send({ email: 'ada.tester@example.com', password: 'x' }),
    ];

    for (const res of responses) {
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'Database unavailable. Try again shortly.' });
    }
  });

  it('the root route still answers', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Stock Inventory API is running' });
  });
});

describe('once the database is ready', () => {
  afterAll(async () => {
    await pool.end().catch(() => {});
  });

  it('health reports "connected" and the data routes open up', async () => {
    await initDatabase();

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: 'OK', database: 'connected' });

    const inventory = await request(app).get('/api/inventory').set('Authorization', inventoryAuthorization());
    expect(inventory.status).toBe(200);
  });

  it('health reports "unreachable" when the database stops answering', async () => {
    await pool.end();

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'DEGRADED', database: 'unreachable' });
  });
});
