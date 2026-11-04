import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { initDatabase } from '../src/config/database';
import { pool, useTestDatabase } from './helpers/db';
import { addItem, addSampleItems, sampleItems, inventoryAuthorization } from './helpers/fixtures';

useTestDatabase();

describe('inventory authentication', () => {
  const routes = [
    ['post', '/api/inventory/add'],
    ['get', '/api/inventory'],
    ['get', '/api/inventory/search'],
    ['post', '/api/inventory/match-image'],
    ['post', '/api/inventory/adjust'],
    ['get', '/api/inventory/low-stock'],
    ['get', '/api/inventory/history/1'],
  ] as const;

  it.each(routes)('%s %s rejects a missing token', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No token provided' });
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM inventory');
    expect(result.rows[0].count).toBe(0);
  });

  it.each(routes)('%s %s rejects an invalid token', async (method, path) => {
    const res = await request(app)[method](path)
      .set('Authorization', 'Bearer invalid-token').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it.each(routes)('%s %s rejects an expired token', async (method, path) => {
    const token = jwt.sign({ id: 42 }, process.env.JWT_SECRET!, { expiresIn: -60 });
    const res = await request(app)[method](path)
      .set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });
});

describe('POST /api/inventory/add', () => {
  it('creates an item and returns the stored row', async () => {
    const res = await request(app).post('/api/inventory/add').set('Authorization', inventoryAuthorization()).send(sampleItems[0]);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...sampleItems[0], id: expect.any(Number) });
    const { rows } = await pool.query('SELECT name, sku, quantity FROM inventory WHERE id = $1', [res.body.id]);
    expect(rows[0]).toEqual({ name: 'Hex Bolt M8', sku: 'TST-BLT-001', quantity: 500 });
  });

  it('fills in defaults for optional fields', async () => {
    const res = await request(app)
      .post('/api/inventory/add').set('Authorization', inventoryAuthorization())
      .send({ name: 'Wing Nut M6', sku: 'TST-NUT-001', quantity: 40 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ min_stock_level: 10, unit_price: '0.00', category: 'General' });
  });

  it.each([
    { name: undefined }, { name: '   ' }, { name: {} }, { name: 'a'.repeat(151) },
    { sku: undefined }, { sku: 'x'.repeat(31) },
    { quantity: undefined }, { quantity: -1 }, { quantity: 1.5 },
    { quantity: '5' }, { quantity: 2147483648 },
    { min_stock_level: -1 }, { min_stock_level: '10' },
    { unit_price: -1 }, { unit_price: 1.234 }, { unit_price: '5' },
    { category: 'x'.repeat(51) }, { location: 'x'.repeat(16) },
    { description: 'x'.repeat(501) }, { image_url: 'javascript:alert(1)' },
    { image_url: { url: 'https://example.com/image.jpg' } },
  ])('rejects invalid inventory input without creating stock: %j', async (invalid) => {
    const res = await request(app).post('/api/inventory/add')
      .set('Authorization', inventoryAuthorization()).send({ ...sampleItems[0], ...invalid });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM inventory');
    expect(rows[0].count).toBe(0);
  });

  it('preserves zero values and accepts empty optional form fields', async () => {
    const res = await request(app).post('/api/inventory/add')
      .set('Authorization', inventoryAuthorization())
      .send({ ...sampleItems[0], quantity: 0, min_stock_level: 0, unit_price: 0,
        location: '', description: '', image_url: '' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ quantity: 0, min_stock_level: 0, unit_price: '0.00' });
  });
});

describe('GET /api/inventory', () => {
  it('lists every item, newest first', async () => {
    await addSampleItems();

    const res = await request(app).get('/api/inventory').set('Authorization', inventoryAuthorization());

    expect(res.status).toBe(200);
    expect(res.body.map((item: { sku: string }) => item.sku)).toEqual(['TST-PIP-001', 'TST-GAS-001', 'TST-BLT-001']);
  });

  it('returns an empty list when there is no stock', async () => {
    const res = await request(app).get('/api/inventory').set('Authorization', inventoryAuthorization());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/inventory/low-stock', () => {
  it('returns items at or below their minimum, lowest quantity first', async () => {
    await addSampleItems();

    const res = await request(app).get('/api/inventory/low-stock').set('Authorization', inventoryAuthorization());

    expect(res.status).toBe(200);
    expect(res.body.map((item: { sku: string }) => item.sku)).toEqual(['TST-PIP-001', 'TST-GAS-001']);
  });
});

describe('POST /api/inventory/adjust', () => {
  const adjust = (body: object) => request(app).post('/api/inventory/adjust').set('Authorization', inventoryAuthorization()).send(body);

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

  it.each([
    { productId: undefined }, { productId: {} }, { productId: -1 },
    { adjustmentType: 'multiply' }, { adjustmentType: undefined },
    { quantity: undefined }, { quantity: -1 }, { quantity: 1.5 },
    { quantity: '5' }, { quantity: 0 }, { quantity: 2147483648 },
    { reason: {} }, { reason: 'x'.repeat(201) },
  ])('rejects invalid adjustments without changing stock or history: %j', async (invalid) => {
    const item = await addItem(sampleItems[1]);
    const res = await adjust({ productId: item.id, adjustmentType: 'add', quantity: 1, ...invalid });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
    const stored = await pool.query('SELECT quantity FROM inventory WHERE id = $1', [item.id]);
    expect(stored.rows[0].quantity).toBe(20);
    const history = await pool.query('SELECT COUNT(*)::int AS count FROM inventory_history');
    expect(history.rows[0].count).toBe(0);
  });

  it('accepts numeric product IDs from form controls and setting stock to zero', async () => {
    const item = await addItem(sampleItems[1]);
    const res = await adjust({ productId: String(item.id), adjustmentType: 'set', quantity: 0 });
    expect(res.status).toBe(200);
    expect(res.body.newQuantity).toBe(0);
  });
  it.todo('#13 remove cannot take stock below zero');
  it.todo('#13 the stock update and its history row are written in one transaction');
  it.todo('#13 concurrent adjustments to the same item do not lose updates');
});

describe('GET /api/inventory/history/:productId', () => {
  it("returns that product's adjustments", async () => {
    const [bolt, gasket] = await addSampleItems();
    await request(app).post('/api/inventory/adjust').set('Authorization', inventoryAuthorization()).send({ productId: bolt.id, adjustmentType: 'add', quantity: 10, reason: 'Restock' });
    await request(app).post('/api/inventory/adjust').set('Authorization', inventoryAuthorization()).send({ productId: bolt.id, adjustmentType: 'remove', quantity: 5, reason: 'Damaged' });
    await request(app).post('/api/inventory/adjust').set('Authorization', inventoryAuthorization()).send({ productId: gasket.id, adjustmentType: 'add', quantity: 1 });

    const res = await request(app).get(`/api/inventory/history/${bolt.id}`).set('Authorization', inventoryAuthorization());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: bolt.id, adjustment_type: 'add', quantity: 10, previous_quantity: 500, reason: 'Restock' }),
      expect.objectContaining({ product_id: bolt.id, adjustment_type: 'remove', quantity: 5, previous_quantity: 510, reason: 'Damaged' }),
    ]));
  });
});

describe('GET /api/inventory/search', () => {
  const search = (query?: string) => request(app).get('/api/inventory/search').set('Authorization', inventoryAuthorization()).query(query === undefined ? {} : { query });
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
    const res = await request(app).post('/api/inventory/match-image').set('Authorization', inventoryAuthorization()).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('matches items that have an image using keywords from the filename', async () => {
    await addItem({ ...sampleItems[0], image_url: '/uploads/images/test-bolt.jpg' });
    await addItem({ ...sampleItems[1], name: 'Bolt Seal Kit', sku: 'TST-SEAL-002' });

    const res = await request(app).post('/api/inventory/match-image').set('Authorization', inventoryAuthorization()).send({ filename: 'IMG_hex-bolt.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.keywordsFound).toEqual(['hex', 'bolt']);
    expect(res.body.matches.map((item: { sku: string }) => item.sku)).toEqual(['TST-BLT-001']);
    expect(res.body.totalMatches).toBe(1);
  });
});

describe('image-match validation', () => {
  it.each([42, [], {}, '', ' ', 'x'.repeat(256)])('rejects invalid filenames: %j', async (filename) => {
    const res = await request(app).post('/api/inventory/match-image')
      .set('Authorization', inventoryAuthorization()).send({ filename });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });
});

describe('INTEGER stock quantities and product IDs', () => {
  it('creates and adjusts an item above the SMALLINT limits and reads its history', async () => {
    await pool.query("SELECT setval(pg_get_serial_sequence('inventory', 'id'), 40000, false)");
    const item = await addItem({ ...sampleItems[0], quantity: 100000, min_stock_level: 50000 });
    expect(item.id).toBe(40000);
    expect(item.quantity).toBe(100000);

    const adjusted = await request(app).post('/api/inventory/adjust')
      .set('Authorization', inventoryAuthorization())
      .send({ productId: item.id, adjustmentType: 'add', quantity: 50000 });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body).toMatchObject({ previousQuantity: 100000, newQuantity: 150000 });
    const history = await request(app).get('/api/inventory/history/' + item.id)
      .set('Authorization', inventoryAuthorization());
    expect(history.status).toBe(200);
    expect(history.body).toEqual([expect.objectContaining({
      product_id: 40000, quantity: 50000, previous_quantity: 100000,
    })]);
  });

  it('accepts the maximum INTEGER stock count and minimum-stock threshold', async () => {
    const item = await addItem({ ...sampleItems[0], quantity: 2147483647, min_stock_level: 2147483647 });
    expect(item.quantity).toBe(2147483647);
    expect(item.min_stock_level).toBe(2147483647);
  });
});

describe('legacy SMALLINT migration', () => {
  it('preserves rows, defaults and foreign keys through repeated initialization', async () => {
    await pool.query(`
      ALTER TABLE inventory ALTER COLUMN quantity TYPE SMALLINT, ALTER COLUMN min_stock_level TYPE SMALLINT;
      ALTER TABLE inventory_history ALTER COLUMN product_id TYPE SMALLINT,
        ALTER COLUMN quantity TYPE SMALLINT, ALTER COLUMN previous_quantity TYPE SMALLINT;
      INSERT INTO inventory (id, name, sku, quantity, min_stock_level)
        VALUES (17, 'Legacy Item', 'LEGACY-001', 30000, 100);
      INSERT INTO inventory_history (product_id, adjustment_type, quantity, previous_quantity, reason)
        VALUES (17, 'add', 10000, 20000, 'Legacy delivery');
      INSERT INTO inventory_history (product_id, adjustment_type, quantity, previous_quantity)
        VALUES (17, 'set', 30000, NULL);
    `);
    const beforeItems = await pool.query('SELECT * FROM inventory ORDER BY id');
    const beforeHistory = await pool.query('SELECT * FROM inventory_history ORDER BY id');
    await initDatabase();
    await initDatabase();
    const types = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND (table_name, column_name) IN (
        ('inventory', 'quantity'), ('inventory', 'min_stock_level'),
        ('inventory_history', 'product_id'), ('inventory_history', 'quantity'),
        ('inventory_history', 'previous_quantity')
      )
    `);
    expect(types.rows).toHaveLength(5);
    expect(types.rows.every((column) => column.data_type === 'integer')).toBe(true);
    expect((await pool.query('SELECT * FROM inventory ORDER BY id')).rows).toEqual(beforeItems.rows);
    expect((await pool.query('SELECT * FROM inventory_history ORDER BY id')).rows).toEqual(beforeHistory.rows);
    const defaults = await pool.query(
      "INSERT INTO inventory (name, sku) VALUES ('Default Item', 'DEFAULT-001') RETURNING quantity, min_stock_level"
    );
    expect(defaults.rows[0]).toEqual({ quantity: 0, min_stock_level: 10 });
    await pool.query(`
      INSERT INTO inventory (id, name, sku, quantity, min_stock_level)
        VALUES (40000, 'Large Item', 'LARGE-001', 150000, 50000);
      INSERT INTO inventory_history (product_id, adjustment_type, quantity, previous_quantity)
        VALUES (40000, 'add', 50000, 100000);
    `);
    await expect(pool.query(`
      INSERT INTO inventory_history (product_id, adjustment_type, quantity) VALUES (99999, 'add', 1)
    `)).rejects.toMatchObject({ code: '23503' });
    await pool.query('DELETE FROM inventory WHERE id = 40000');
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM inventory_history WHERE product_id = 40000')).rows[0].count).toBe(0);
  });
});
