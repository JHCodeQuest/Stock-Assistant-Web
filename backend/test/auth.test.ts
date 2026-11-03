import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { sendWelcomeEmail } from '../src/services/email';
import { pool, useTestDatabase } from './helpers/db';
import { registerUser, testUser } from './helpers/fixtures';

useTestDatabase();

describe('POST /api/auth/register', () => {
  it('creates the user, hashes the password and returns a working token', async () => {
    vi.mocked(sendWelcomeEmail).mockClear();

    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: testUser.email, name: testUser.name });
    expect(res.body.user.id).toEqual(expect.any(Number));
    expect(res.body.user).not.toHaveProperty('password_hash');

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { id: number; email: string };
    expect(payload).toMatchObject({ id: res.body.user.id, email: testUser.email });

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [testUser.email]);
    expect(rows[0].password_hash).not.toBe(testUser.password);
    expect(await bcrypt.compare(testUser.password, rows[0].password_hash)).toBe(true);

    expect(sendWelcomeEmail).toHaveBeenCalledWith(testUser.email, testUser.name);
  });

  it('defaults the name to the part of the email before the @', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'grace.example@example.com', password: 'another-test-password' });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe('grace.example');
  });

  it('rejects a duplicate email', async () => {
    await registerUser();

    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'User already exists' });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    expect(rows[0].count).toBe(1);
  });

  it.todo('#10 (details in the private task)');
  it.todo('#11 (details in the private task)');
});

describe('POST /api/auth/login', () => {
  it('returns the user and a token for the right password', async () => {
    const { user } = await registerUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: testUser.email, name: testUser.name });
    expect(res.body.user).not.toHaveProperty('password_hash');
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { id: number };
    expect(payload.id).toBe(user.id);
  });

  it('rejects a wrong password', async () => {
    await registerUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'not-the-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(res.body).not.toHaveProperty('token');
  });

  it('rejects an unknown user with the same message as a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it.todo('#10 (details in the private task)');
  it.todo('#11 (details in the private task)');
});
