import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createUploadRouter } from '../src/middleware/upload';

let directory: string;
const app = express();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSWQAAAAASUVORK5CYII=', 'base64');
const token = (options = {}) => jwt.sign({ id: 42 }, process.env.JWT_SECRET!, { expiresIn: '1h', ...options });
const upload = () => request(app).post('/api/upload').set('Authorization', 'Bearer ' + token());

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'stock-upload-test-'));
  app.use(createUploadRouter(directory));
});

afterEach(async () => {
  for (const name of await readdir(directory)) await rm(path.join(directory, name));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('upload authentication', () => {
  it('rejects anonymous uploads before writing any file', async () => {
    const res = await request(app).post('/api/upload').attach('image', png, 'test.png');
    expect(res.status).toBe(401);
    expect(await readdir(directory)).toEqual([]);
  });

  it.each(['not-a-token', 'expired'])('rejects %s tokens without storing files', async (value) => {
    const bearer = value === 'expired' ? token({ expiresIn: -60 }) : value;
    const res = await request(app).post('/api/upload').set('Authorization', 'Bearer ' + bearer)
      .attach('image', png, 'test.png');
    expect(res.status).toBe(401);
    expect(await readdir(directory)).toEqual([]);
  });
});

describe('upload limits and image types', () => {
  it('stores a valid image under a generated name and serves it with safe headers', async () => {
    const res = await upload().attach('image', png, { filename: 'user-supplied.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/uploads\/images\/[a-f0-9-]+\.png$/);
    const filename = path.basename(res.body.url);
    expect(await readFile(path.join(directory, filename))).toEqual(png);
    const served = await request(app).get(res.body.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/^image\/png/);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(served.headers['content-disposition']).toBe('inline');
    expect(served.body).toEqual(png);
  });

  it.each([
    ['page.html', 'text/html', Buffer.from('<script>alert(1)</script>')],
    ['image.svg', 'image/svg+xml', Buffer.from('<svg onload="alert(1)"/>')],
    ['image.png', 'text/html', png],
    ['image.html', 'image/png', png],
    ['image.png', 'image/png', Buffer.from('<html>renamed image</html>')],
    ['image.jpg', 'image/jpeg', png],
    ['image.webp', 'image/webp', png],
  ])('rejects disallowed or mismatched files: %s %s', async (filename, contentType, data) => {
    const res = await upload().attach('image', data, { filename, contentType });
    expect(res.status).toBe(415);
    expect(await readdir(directory)).toEqual([]);
  });

  it('accepts JPEG and WebP signatures with matching MIME types and extensions', async () => {
    const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');
    const webp = Buffer.from('52494646140000005745425056503820080000000000000000000000', 'hex');
    for (const [filename, contentType, data] of [
      ['test.jpeg', 'image/jpeg', jpeg],
      ['test.webp', 'image/webp', webp],
    ] as const) {
      const res = await upload().attach('image', data, { filename, contentType });
      expect(res.status).toBe(200);
    }
  });

  it('rejects files over 5 MB without leaving anything on disk', async () => {
    const data = Buffer.alloc(5 * 1024 * 1024 + 1);
    png.copy(data);
    const res = await upload().attach('image', data, { filename: 'large.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(await readdir(directory)).toEqual([]);
  });

  it('rejects missing files', async () => {
    const res = await upload();
    expect(res.status).toBe(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('rejects extra files without writing the first file', async () => {
    const res = await upload().attach('image', png, 'one.png').attach('image', png, 'two.png');
    expect(res.status).toBe(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('rejects unexpected form fields', async () => {
    const res = await upload().field('unexpected', 'value').attach('image', png, 'one.png');
    expect(res.status).toBe(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('never serves legacy HTML or SVG files', async () => {
    await writeFile(path.join(directory, 'legacy.html'), '<html>unsafe</html>');
    await writeFile(path.join(directory, 'legacy.svg'), '<svg/>');
    expect((await request(app).get('/uploads/images/legacy.html')).status).toBe(404);
    expect((await request(app).get('/uploads/images/legacy.svg')).status).toBe(404);
    expect((await request(app).get('/uploads/images/')).status).toBe(404);
    expect((await request(app).get('/uploads/legacy.html')).status).toBe(404);
  });
});
