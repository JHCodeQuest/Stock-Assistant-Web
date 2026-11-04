import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';

// Fictional data only: this is a public repo.

export const inventoryAuthorization = () => `Bearer ${jwt.sign(
  { id: 42, email: 'ada.tester@example.com' }, process.env.JWT_SECRET!, { expiresIn: '1h' }
)}`;

export const testUser = {
  email: 'ada.tester@example.com',
  password: 'correct-horse-battery',
  name: 'Ada Tester',
};

export const registerUser = async (user = testUser) => {
  const res = await request(app).post('/api/auth/register').send(user);
  return res.body as { user: { id: number; email: string; name: string; role: string }; token: string };
};

export const sampleItems = [
  { name: 'Hex Bolt M8', sku: 'TST-BLT-001', quantity: 500, min_stock_level: 100, category: 'Fasteners', location: 'A-1-1', description: 'Zinc plated' },
  { name: 'Rubber Gasket', sku: 'TST-GAS-001', quantity: 20, min_stock_level: 25, category: 'Seals', location: 'B-2-1' },
  { name: 'Copper Pipe 15mm', sku: 'TST-PIP-001', quantity: 0, min_stock_level: 10, category: 'Plumbing', location: 'C-1-3' },
];

export const addItem = async (item: Record<string, unknown>) => {
  const res = await request(app).post('/api/inventory/add').set('Authorization', inventoryAuthorization()).send(item);
  if (res.status !== 201) throw new Error(`addItem failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: number; quantity: number; [key: string]: unknown };
};

export const addSampleItems = async () => {
  const added = [];
  for (const item of sampleItems) added.push(await addItem(item));
  return added;
};
