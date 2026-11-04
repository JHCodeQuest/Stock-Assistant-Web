import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { sendWelcomeEmail } from '../src/services/email';
import { pool, useTestDatabase } from './helpers/db';
import { registerUser, testUser } from './helpers/fixtures';

useTestDatabase();

const inviteCode = process.env.REGISTRATION_INVITE_CODE!;
afterEach(() => {
  process.env.REGISTRATION_INVITE_CODE = inviteCode;
  app.set('trust proxy', process.env.RENDER === 'true' ? 1 : false);
});

describe('POST /api/auth/register', () => {
  it('creates the user, hashes the password and returns a working token', async () => {
    vi.mocked(sendWelcomeEmail).mockClear();

    const res = await request(app).post('/api/auth/register').send({ ...testUser, inviteCode });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: testUser.email, name: testUser.name, role: 'staff' });
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
      .send({ email: 'grace.example@example.com', password: 'another-test-password', inviteCode });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe('grace.example');
  });

  it('rejects a duplicate email', async () => {
    await registerUser();

    const res = await request(app).post('/api/auth/register').send({ ...testUser, inviteCode });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'User already exists' });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    expect(rows[0].count).toBe(1);
  });

  it('rejects registration when no invite is configured', async () => {
    delete process.env.REGISTRATION_INVITE_CODE;
    const res = await request(app).post('/api/auth/register').send({ ...testUser, inviteCode });
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('token');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    expect(rows[0].count).toBe(0);
  });

  it.each([undefined, '', 'wrong-code', { code: 'invalid' }])(
    'rejects a missing or invalid invitation: %s', async (invalid) => {
      const res = await request(app).post('/api/auth/register').send({ ...testUser, inviteCode: invalid });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Registration requires a valid invitation.' });
      const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
      expect(rows[0].count).toBe(0);
    }
  );

  it('ignores a requested admin role and stores staff', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...testUser, inviteCode, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('staff');
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [res.body.user.id]);
    expect(rows[0].role).toBe('staff');
  });

  it('uses staff as the database default when role is omitted', async () => {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING role',
      ['default-role@example.com', 'unused-test-hash', 'Default Role']
    );
    expect(rows[0].role).toBe('staff');
  });
  it.each([
    { email: undefined },
    { email: 'not-an-email' },
    { email: { value: 'injected@example.com' } },
    { password: undefined },
    { password: 12345678 },
    { password: 'short' },
    { password: 'a'.repeat(73) },
    { password: 'é'.repeat(37) },
    { name: { html: '<script>' } },
    { name: 'a'.repeat(101) },
  ])('rejects malformed registration input without creating users: %j', async (invalid) => {
    vi.mocked(sendWelcomeEmail).mockClear();
    const res = await request(app).post('/api/auth/register')
      .send({ ...testUser, inviteCode, ...invalid });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
    expect(res.body).not.toHaveProperty('token');
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    expect(rows[0].count).toBe(0);
  });

  it('trims names and email addresses but preserves password whitespace', async () => {
    const password = '  correct-horse-battery  ';
    const res = await request(app).post('/api/auth/register')
      .send({ ...testUser, email: '  ada.tester@example.com  ', name: '  Ada Tester  ', password, inviteCode });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: testUser.email, name: testUser.name });
    const login = await request(app).post('/api/auth/login').send({ email: testUser.email, password });
    expect(login.status).toBe(200);
  });
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

  it('preserves the existing role on login', async () => {
    await registerUser();
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [testUser.email]);
    const res = await request(app).post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });
  it.each([
    {},
    { email: testUser.email },
    { password: testUser.password },
    { email: 'invalid', password: testUser.password },
    { email: testUser.email, password: [] },
    { email: testUser.email, password: '' },
    { email: testUser.email, password: 'a'.repeat(73) },
  ])('returns 400 for malformed credentials: %j', async (body) => {
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
    expect(res.body).not.toHaveProperty('token');
  });
});

describe('authentication rate limits', () => {
  it('allows ten login attempts then returns 429 with retry guidance', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'unknown@example.com', password: 'incorrect' });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body).toEqual({ error: 'Too many attempts. Try again in 15 minutes.' });
  });

  it('limits registration attempts even when the invitation is invalid', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/register').send(testUser);
      expect(res.status).toBe(403);
    }
    const blocked = await request(app).post('/api/auth/register').send({ ...testUser, inviteCode });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    expect(rows[0].count).toBe(0);
    // Exhausting registration does not block login.
    const login = await request(app).post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'incorrect' });
    expect(login.status).toBe(401);
  });

  it('isolates clients behind one trusted proxy and ignores forged earlier hops', async () => {
    app.set('trust proxy', 1);
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.1, 203.0.113.10')
        .send({ email: 'unknown@example.com', password: 'incorrect' });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.2, 203.0.113.10')
      .send({ email: 'unknown@example.com', password: 'incorrect' });
    expect(blocked.status).toBe(429);
    const otherClient = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.11')
      .send({ email: 'unknown@example.com', password: 'incorrect' });
    expect(otherClient.status).toBe(401);
  });
});
