import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the real email renderer with a fake provider; never send mail.
vi.unmock('../src/services/email');
const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({}) }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('RESEND_API_KEY', 'test-only-provider-key');
  send.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('welcome email HTML', () => {
  it('escapes user-controlled tags, ampersands and quotes', async () => {
    const { sendWelcomeEmail } = await import('../src/services/email');
    await sendWelcomeEmail('test@example.com', '<img src=x onerror="alert(1)"> & \'Ada\'');
    expect(send).toHaveBeenCalledOnce();
    const message = send.mock.calls[0][0];
    expect(message.to).toBe('test@example.com');
    expect(message.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;Ada&#39;');
    expect(message.html).not.toContain('<img');
    expect(message.html).toContain('<h1>Welcome, ');
  });

  it('preserves ordinary Unicode names', async () => {
    const { sendWelcomeEmail } = await import('../src/services/email');
    await sendWelcomeEmail('test@example.com', 'Zoë');
    expect(send.mock.calls[0][0].html).toContain('<h1>Welcome, Zoë!</h1>');
  });

  it('skips the provider when no API key is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const { sendWelcomeEmail } = await import('../src/services/email');
    await sendWelcomeEmail('test@example.com', 'Test User');
    expect(send).not.toHaveBeenCalled();
  });
});
