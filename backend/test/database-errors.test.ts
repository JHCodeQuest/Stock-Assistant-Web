import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { pool, useTestDatabase } from './helpers/db';
import { inventoryAuthorization } from './helpers/fixtures';

useTestDatabase();
afterEach(() => vi.restoreAllMocks());

describe('database read failures', () => {
  it.each([
    ['/api/inventory', 'Failed to fetch inventory'],
    ['/api/inventory/low-stock', 'Failed to fetch low stock items'],
    ['/api/inventory/history/1', 'Failed to fetch inventory history'],
    ['/api/dashboard/metrics', 'Failed to fetch inventory metrics'],
  ])('%s returns 500 instead of success-shaped empty data', async (route, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(pool, 'query').mockRejectedValue(new Error('private database connection details'));
    const res = await request(app).get(route).set('Authorization', inventoryAuthorization());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: message });
    expect(JSON.stringify(res.body)).not.toContain('private database');
  });

  it.each([1, 2])('dashboard fails when query %i fails after earlier successful counts', async (preceding) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const query = vi.spyOn(pool, 'query');
    for (let i = 0; i < preceding; i++) query.mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);
    query.mockRejectedValueOnce(new Error('database unavailable'));
    const res = await request(app).get('/api/dashboard/metrics');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch inventory metrics' });
  });

  it('still returns successful empty lists for a genuinely empty warehouse', async () => {
    for (const route of ['/api/inventory', '/api/inventory/low-stock', '/api/inventory/history/1']) {
      const res = await request(app).get(route).set('Authorization', inventoryAuthorization());
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  });
});
