import { beforeEach, vi } from 'vitest';

import { loginStore, registrationStore } from '../src/middleware/auth-rate-limit';

beforeEach(async () => {
  await loginStore.resetAll();
  await registrationStore.resetAll();
});

// Runs before every test file, before the app is imported. dotenv never overrides variables
// that are already set, so a local backend/.env can't point the tests at a real database,
// a real JWT secret or a real Resend key.

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set. See "Running the tests" in the README.');
}
// The tests truncate every table, so refuse anything that isn't obviously a test database.
const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
if (!databaseName.toLowerCase().includes('test')) {
  throw new Error(`Refusing to run: database "${databaseName}" does not have "test" in its name.`);
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_SSL = 'false';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.RESEND_API_KEY = '';
process.env.REGISTRATION_INVITE_CODE = 'test-only-invite';

// Never send real email.
vi.mock('../src/services/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));
