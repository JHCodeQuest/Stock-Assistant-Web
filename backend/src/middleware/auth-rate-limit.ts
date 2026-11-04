import { rateLimit, MemoryStore } from 'express-rate-limit';

export const loginStore = new MemoryStore();
export const registrationStore = new MemoryStore();

const options = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
};

export const loginLimiter = rateLimit({ ...options, limit: 10, store: loginStore });
export const registrationLimiter = rateLimit({ ...options, limit: 5, store: registrationStore });
