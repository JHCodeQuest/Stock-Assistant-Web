import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { storeImage } from '../services/image-storage';
import { authenticate } from './auth';

const multer = require('multer');
const maxFileSize = 5 * 1024 * 1024;
const imageTypes: Record<string, { extensions: string[]; signature: (data: Buffer) => boolean }> = {
  'image/png': {
    extensions: ['.png'],
    signature: (data) => data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  },
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    signature: (data) => data.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
  },
  'image/webp': {
    extensions: ['.webp'],
    signature: (data) => data.subarray(0, 4).toString() === 'RIFF' &&
      data.subarray(8, 12).toString() === 'WEBP',
  },
};

export function createUploadRouter(directory = path.join(__dirname, '../../uploads/images')) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1, fields: 0 },
    fileFilter: (_req: Request, file: any, callback: any) => {
      const type = imageTypes[file.mimetype];
      if (!type || !type.extensions.includes(path.extname(file.originalname).toLowerCase())) {
        return callback(Object.assign(new Error('Only PNG, JPEG and WebP images are allowed.'), { status: 415 }));
      }
      callback(null, true);
    },
  }).single('image');

  router.post('/api/upload', authenticate, (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, async (error: any) => {
      if (error) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.status === 415 ? 415 : 400;
        res.status(status).json({
          error: status === 413 ? 'Images must be 5 MB or smaller.' :
            status === 415 ? 'Only PNG, JPEG and WebP images are allowed.' : 'Invalid image upload.',
        });
        return;
      }
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: 'An image file is required.' });
        return;
      }
      const type = imageTypes[file.mimetype];
      if (!type.signature(file.buffer)) {
        res.status(415).json({ error: 'File contents do not match the image type.' });
        return;
      }
      const filename = randomUUID() + type.extensions[0];
      const permanentStorage = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' ||
        [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].some(Boolean);
      if (permanentStorage) {
        try {
          const url = await storeImage(file.buffer, file.mimetype, filename);
          res.json({ url });
        } catch {
          res.status(503).json({ error: 'Image storage is unavailable. Please try again later.' });
        }
        return;
      }
      // Local files are for development only. Production never falls back to ephemeral disk.
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
        res.json({ url: '/uploads/images/' + filename });
      } catch (error) {
        next(error);
      }
    });
  });

  // Never expose the whole uploads directory or serve active formats such as HTML and SVG.
  router.use('/uploads/images', (req, res, next) => {
    if (!/^\/[a-z0-9_-]+\.(png|jpe?g|webp)$/i.test(req.path)) {
      res.status(404).end();
      return;
    }
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
    });
    next();
  }, express.static(directory, { index: false, redirect: false, dotfiles: 'deny' }));

  return router;
}
