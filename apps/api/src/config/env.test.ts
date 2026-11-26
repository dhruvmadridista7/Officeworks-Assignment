import { describe, expect, it } from 'vitest';
import { ConfigValidationError, loadConfig } from './env';

describe('loadConfig email and enquiry settings', () => {
  it('supplies valid local email and rate-limit defaults', () => {
    const config = loadConfig({});

    expect(config.salesInbox).toBe('sales@example.com');
    expect(config.emailFrom).toBe('catalogue@example.com');
    expect(config.smtpHost).toBe('');
    expect(config.smtpPort).toBe(1025);
    expect(config.smtpSecure).toBe(false);
    expect(config.enquiryRateLimitMax).toBe(5);
    expect(config.enquiryRateLimitWindowMs).toBe(60_000);
  });

  it('validates email addresses, SMTP settings, and positive rate-limit values', () => {
    expect(() => loadConfig({ SALES_INBOX: 'not-an-email' })).toThrow(
      ConfigValidationError,
    );
    expect(() => loadConfig({ SMTP_PORT: '70000' })).toThrow(
      ConfigValidationError,
    );
    expect(() => loadConfig({ ENQUIRY_RATE_LIMIT_MAX: '0' })).toThrow(
      ConfigValidationError,
    );
    expect(loadConfig({ SMTP_SECURE: 'true' }).smtpSecure).toBe(true);
  });
});
