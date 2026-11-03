import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../src/middleware/auth';

// Tests authenticate on a small app of its own, independent of how routes mount it.
const app = express();
app.get('/protected', authenticate, (req: AuthRequest, res) => {
  res.json({ userId: req.userId, userEmail: req.userEmail });
});

const sign = (payload: object, secret = process.env.JWT_SECRET!) => jwt.sign(payload, secret);

describe('authenticate middleware', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No token provided' });
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No token provided' });
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('rejects a token signed with a different secret', async () => {
    const token = sign({ id: 1, email: 'ada.tester@example.com' }, 'some-other-secret');

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('rejects an expired token', async () => {
    const token = sign({ id: 1, email: 'ada.tester@example.com', exp: Math.floor(Date.now() / 1000) - 60 });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('accepts a valid token and sets userId and userEmail', async () => {
    const token = sign({ id: 42, email: 'ada.tester@example.com' });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 42, userEmail: 'ada.tester@example.com' });
  });
});
