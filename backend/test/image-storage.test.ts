import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storeImage } from '../src/services/image-storage';

const cloudUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v1/stock-assistant/test.png';

beforeEach(() => {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ secure_url: cloudUrl }), { status: 200 }
  )));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('permanent image storage', () => {
  it('sends image bytes to the authenticated Cloudinary API and returns its HTTPS URL', async () => {
    const data = Buffer.from('example image bytes');
    expect(await storeImage(data, 'image/png', 'test.png')).toBe(cloudUrl);
    const [endpoint, options] = vi.mocked(fetch).mock.calls[0];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({
      Authorization: 'Basic ' + Buffer.from('test-key:test-secret').toString('base64'),
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.redirect).toBe('error');
    const form = options?.body as FormData;
    expect(form.get('public_id')).toBe('stock-assistant/test');
    expect(form.get('overwrite')).toBe('false');
    const file = form.get('file') as Blob;
    expect(file.type).toBe('image/png');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(data);
  });

  it.each(['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'])(
    'refuses uploads with missing %s before making a request', async (setting) => {
      vi.stubEnv(setting, '');
      await expect(storeImage(Buffer.from('image'), 'image/png', 'test.png')).rejects.toThrow('not configured');
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('rejects provider errors without returning provider details or credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('private provider details', { status: 500 }));
    await expect(storeImage(Buffer.from('image'), 'image/png', 'test.png')).rejects.toThrow('Image storage upload failed.');
  });

  it('propagates network failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network unavailable'));
    await expect(storeImage(Buffer.from('image'), 'image/png', 'test.png')).rejects.toThrow('network unavailable');
  });

  it.each([
    undefined,
    'http://res.cloudinary.com/test-cloud/image/upload/test.png',
    'https://example.com/test.png',
    'https://res.cloudinary.com/another-cloud/image/upload/test.png',
    'https://res.cloudinary.com/test-cloud/raw/upload/test.html',
  ])('rejects invalid storage URLs: %s', async (secure_url) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ secure_url }), { status: 200 }));
    await expect(storeImage(Buffer.from('image'), 'image/png', 'test.png')).rejects.toThrow();
  });
});
