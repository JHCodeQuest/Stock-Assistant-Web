import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { pool, useTestDatabase } from './helpers/db';
import { addItem, addSampleItems, sampleItems } from './helpers/fixtures';

useTestDatabase();

describe('POST /api/inventory/add', () => {
  it('creates an item and returns the stored row', async () => {
    const res = await request(app).post('/api/inventory/add').send(sampleItems[0]);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...sampleItems[0], id: expect.any(Number) });
    const { rows } = await pool.query('SELECT name, sku, quantity FROM inventory WHERE id = $1', [res.body.id]);
    expect(rows[0]).toEqual({ name: 'Hex Bolt M8', sku: 'TST-BLT-001', quantity: 500 });
  });

  it('fills in defaults for optional fields', async () => {
    const res = await request(app)
      .post('/api/inventory/add')
      .send({ name: 'Wing Nut M6', sku: 'TST-NUT-001', quantity: 40 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ min_stock_level: 10, unit_price: '0.00', category: 'General' });
  });

  it.todo('#11 (details in the private task)');
});

describe('GET /api/inventory', () => {
  it('lists every item, newest first', async () => {
    await addSampleItems();

    const res = await request(app).get('/api/inventory');

    expect(res.status).toBe(200);
    expect(res.body.map((item: { sku: string }) => item.sku)).toEqual(['TST-PIP-001', 'TST-GAS-001', 'TST-BLT-001']);
  });

  it('returns an empty list when there is no stock', async () => {
    const res = await request(app).get('/api/inventory');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/inventory/low-stock', () => {
  it('returns items at or below their minimum, lowest quantity first', async () => {
    await addSampleItems();

    const res = await request(app).get('/api/inventory/low-stock');

    expect(res.status).toBe(200);
    expect(res.body.map((item: { sku: string }) => item.sku)).toEqual(['TST-PIP-001', 'TST-GAS-001']);
  });
});

describe('POST /api/inventory/adjust', () => {
  const adjust = (body: object) => request(app).post('/api/inventory/adjust').send(body);

  it('adds stock and writes a history row', async () => {
    const item = await addItem(sampleItems[1]);

    const res = await adjust({ productId: item.id, adjustmentType: 'add', quantity: 30, reason: 'Delivery from supplier' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, previousQuantity: 20, newQuantity: 50 });
    const stored = await pool.query('SELECT quantity FROM inventory WHERE id = $1', [item.id]);
    expect(stored.rows[0].quantity).toBe(50);
    const history = await pool.query(
      'SELECT product_id, adjustment_type, quantity, previous_quantity, reason FROM inventory_history'
    );
    expect(history.rows).toEqual([
      { product_id: item.id, adjustment_type: 'add', quantity: 30, previous_quantity: 20, reason: 'Delivery from supplier' },
    ]);
  });

  it('removes stock', async () => {
    const item = await addItem(sampleItems[0]);

    const res = await adjust({ productId: item.id, adjustmentType: 'remove', quantity: 120, reason: 'Picked for order' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, previousQuantity: 500, newQuantity: 380 });
    const stored = await pool.query('SELECT quantity FROM inventory WHERE id = $1', [item.id]);
    expect(stored.rows[0].quantity).toBe(380);
  });

  it('sets stock to an exact count', async () => {
    const item = await addItem(sampleItems[0]);

    const res = await adjust({ productId: item.id, adjustmentType: 'set', quantity: 480, reason: 'Stock take' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, previousQuantity: 500, newQuantity: 480 });
    const history = await pool.query('SELECT adjustment_type, quantity, previous_quantity FROM inventory_history');
    expect(history.rows).toEqual([{ adjustment_type: 'set', quantity: 480, previous_quantity: 500 }]);
  });

  it('returns 404 for an unknown product and writes no history', async () => {
    const res = await adjust({ productId: 999, adjustmentType: 'add', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Product not found' });
    const history = await pool.query('SELECT COUNT(*)::int AS count FROM inventory_history');
    expect(history.rows[0].count).toBe(0);
  });

  it.todo('#7 (details in the private task)');
  it.todo('#13 adjust rejects an unknown adjustmentType');
  it.todo('#13 adjust rejects a quantity that is not a positive integer (a string "5" is concatenated today)');
  it.todo('#13 remove cannot take stock below zero');
  it.todo('#13 the stock update and its history row are written in one transaction');
  it.todo('#13 concurrent adjustments to the same item do not lose updates');
});

describe('GET /api/inventory/history/:productId', () => {
  it("returns that product's adjustments", async () => {
    const [bolt, gasket] = await addSampleItems();
    await request(app).post('/api/inventory/adjust').send({ productId: bolt.id, adjustmentType: 'add', quantity: 10, reason: 'Restock' });
    await request(app).post('/api/inventory/adjust').send({ productId: bolt.id, adjustmentType: 'remove', quantity: 5, reason: 'Damaged' });
    await request(app).post('/api/inventory/adjust').send({ productId: gasket.id, adjustmentType: 'add', quantity: 1 });

    const res = await request(app).get(`/api/inventory/history/${bolt.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: bolt.id, adjustment_type: 'add', quantity: 10, previous_quantity: 500, reason: 'Restock' }),
      expect.objectContaining({ product_id: bolt.id, adjustment_type: 'remove', quantity: 5, previous_quantity: 510, reason: 'Damaged' }),
    ]));
  });
});

describe('GET /api/inventory/search', () => {
  const search = (query?: string) => request(app).get('/api/inventory/search').query(query === undefined ? {} : { query });
  const skus = (res: request.Response) => res.body.results.map((item: { sku: string }) => item.sku);

  it('asks for a search term when the query is empty', async () => {
    const res = await search();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], suggestion: 'Enter a search term' });
  });

  it('matches name, SKU, category and description, ignoring case', async () => {
    await addSampleItems();

    expect(skus(await search('GASKET'))).toEqual(['TST-GAS-001']);
    expect(skus(await search('tst-pip'))).toEqual(['TST-PIP-001']);
    expect(skus(await search('plumbing'))).toEqual(['TST-PIP-001']);
    expect(skus(await search('zinc'))).toEqual(['TST-BLT-001']);
  });

  it('matches synonyms and reports how many it found', async () => {
    await addSampleItems();

    const res = await search('screw');

    expect(res.status).toBe(200);
    expect(skus(res)).toEqual(['TST-BLT-001']);
    expect(res.body.suggestion).toBe('Found 1 item(s)');
  });

  it('suggests other keywords when nothing matches', async () => {
    await addSampleItems();

    const res = await search('trampoline');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [], suggestion: 'No items found matching "trampoline". Try different keywords.' });
  });

  it.todo('#23 search treats % and _ in the query as literal characters');
});

describe('POST /api/inventory/match-image', () => {
  it('requires a filename', async () => {
    const res = await request(app).post('/api/inventory/match-image').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No filename provided' });
  });

  it('matches items that have an image using keywords from the filename', async () => {
    await addItem({ ...sampleItems[0], image_url: '/uploads/images/test-bolt.jpg' });
    await addItem({ ...sampleItems[1], name: 'Bolt Seal Kit', sku: 'TST-SEAL-002' });

    const res = await request(app).post('/api/inventory/match-image').send({ filename: 'IMG_hex-bolt.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.keywordsFound).toEqual(['hex', 'bolt']);
    expect(res.body.matches.map((item: { sku: string }) => item.sku)).toEqual(['TST-BLT-001']);
    expect(res.body.totalMatches).toBe(1);
  });
});
