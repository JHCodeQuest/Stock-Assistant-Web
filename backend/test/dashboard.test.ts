import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { useTestDatabase } from './helpers/db';
import { addSampleItems } from './helpers/fixtures';

useTestDatabase();

describe('GET /api/dashboard/metrics', () => {
  it('reports zeros when there is no stock', async () => {
    const res = await request(app).get('/api/dashboard/metrics');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalProducts: 0, lowStockItems: 0, outOfStockItems: 0, totalValue: 0, recentTransactions: 0 });
  });

  it('counts products, low-stock items and out-of-stock items', async () => {
    await addSampleItems();

    const res = await request(app).get('/api/dashboard/metrics');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalProducts: 3, lowStockItems: 2, outOfStockItems: 1 });
  });
});
