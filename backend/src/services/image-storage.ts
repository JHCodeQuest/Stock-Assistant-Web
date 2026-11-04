// Cloudinary's authenticated Upload API; credentials never reach the browser.
export async function storeImage(data: Buffer, contentType: string, filename: string): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !key || !secret) {
    throw new Error('Image storage is not configured.');
  }

  const body = new FormData();
  body.append('file', new Blob([new Uint8Array(data)], { type: contentType }), filename);
  body.append('public_id', 'stock-assistant/' + filename.replace(/\.[^.]+$/, ''));
  body.append('overwrite', 'false');

  const response = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64') },
    body,
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Image storage upload failed.');
  const result = await response.json() as { secure_url?: string };
  const url = new URL(result.secure_url || '');
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
      !url.pathname.startsWith('/' + cloud + '/image/upload/') ||
      url.username || url.password || url.href.length > 255) {
    throw new Error('Image storage returned an invalid URL.');
  }
  return url.href;
}
