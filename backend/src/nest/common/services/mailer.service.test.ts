/**
 * Unit tests for MailerService
 *
 * Covers sendPasswordReset:
 * - Name building (full name vs email fallback, partial nulls)
 * - APP_URL fallback
 * - Reset URL composition
 * - Template + send delegation to legacy email-service
 * - Failure swallowing (template load + send failures must NOT throw)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Service import MUST follow vi.mock so the mocked module is bound
import { MailerService, type PasswordResetRecipient } from './mailer.service.js';

// =============================================================
// Module-level mocks — must be hoisted before service import
// =============================================================

const { mockLoadBrandedTemplate, mockSendEmail } = vi.hoisted(() => ({
  mockLoadBrandedTemplate: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('../../../utils/email-service.js', () => ({
  default: {
    loadBrandedTemplate: mockLoadBrandedTemplate,
    sendEmail: mockSendEmail,
  },
}));

// =============================================================
// Helpers
// =============================================================

function makeRecipient(overrides: Partial<PasswordResetRecipient> = {}): PasswordResetRecipient {
  return {
    email: 'jane@assixx.de',
    firstName: 'Jane',
    lastName: 'Doe',
    ...overrides,
  };
}

function makeBrandedStub(): { html: string; attachments: { cid: string }[] } {
  return {
    html: '<html><body>{{userName}} {{resetUrl}} {{expiresAt}}</body></html>',
    attachments: [{ cid: 'assixx-logo' }],
  };
}

// Frozen for predictable expiry formatting (de-DE: "10. Apr. 2026, 12:00")
const EXPIRES_AT = new Date('2026-04-10T12:00:00.000Z');
const RAW_TOKEN = 'raw-reset-token-abc123';
const ORIGINAL_APP_URL = process.env['APP_URL'];

// =============================================================
// Tests
// =============================================================

describe('MailerService', () => {
  let service: MailerService;

  beforeEach(() => {
    mockLoadBrandedTemplate.mockReset();
    mockSendEmail.mockReset();
    mockLoadBrandedTemplate.mockResolvedValue(makeBrandedStub());
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });
    service = new MailerService();
  });

  afterEach(() => {
    if (ORIGINAL_APP_URL === undefined) {
      delete process.env['APP_URL'];
    } else {
      process.env['APP_URL'] = ORIGINAL_APP_URL;
    }
  });

  describe('sendPasswordReset — happy path', () => {
    it('should call loadBrandedTemplate with password-reset template and three replacements', async () => {
      await service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT);

      expect(mockLoadBrandedTemplate).toHaveBeenCalledTimes(1);
      const [templateName, replacements] = mockLoadBrandedTemplate.mock.calls[0] ?? [];
      expect(templateName).toBe('password-reset');
      expect(replacements).toEqual({
        userName: 'Jane Doe',
        resetUrl: expect.stringContaining(`token=${RAW_TOKEN}`) as string,
        expiresAt: expect.any(String) as string,
      });
    });

    it('should send email with German subject and CID logo attachment', async () => {
      await service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const sendArg = mockSendEmail.mock.calls[0]?.[0] as {
        to: string;
        subject: string;
        html: string;
        attachments: unknown[];
        text: string;
      };
      expect(sendArg.to).toBe('jane@assixx.de');
      expect(sendArg.subject).toBe('Passwort zurücksetzen — Assixx');
      expect(sendArg.attachments).toEqual([{ cid: 'assixx-logo' }]);
      expect(sendArg.text).toContain('Hallo Jane Doe');
      expect(sendArg.text).toContain(`token=${RAW_TOKEN}`);
    });
  });

  describe('userName resolution', () => {
    it.each([
      [{ firstName: 'Jane', lastName: 'Doe' }, 'Jane Doe'],
      [{ firstName: 'Jane', lastName: null }, 'Jane'],
      [{ firstName: null, lastName: 'Doe' }, 'Doe'],
      [{ firstName: null, lastName: null }, 'jane@assixx.de'],
      [{ firstName: '', lastName: '' }, 'jane@assixx.de'],
    ])('builds userName=%j → %s', async (overrides, expected) => {
      await service.sendPasswordReset(makeRecipient(overrides), RAW_TOKEN, EXPIRES_AT);

      const replacements = mockLoadBrandedTemplate.mock.calls[0]?.[1] as { userName: string };
      expect(replacements.userName).toBe(expected);
    });
  });

  describe('reset URL composition', () => {
    it('uses APP_URL env var when set', async () => {
      process.env['APP_URL'] = 'https://app.assixx.de';

      await service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT);

      const replacements = mockLoadBrandedTemplate.mock.calls[0]?.[1] as { resetUrl: string };
      expect(replacements.resetUrl).toBe(`https://app.assixx.de/reset-password?token=${RAW_TOKEN}`);
    });

    it('falls back to http://localhost:5173 when APP_URL is unset', async () => {
      delete process.env['APP_URL'];

      await service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT);

      const replacements = mockLoadBrandedTemplate.mock.calls[0]?.[1] as { resetUrl: string };
      expect(replacements.resetUrl).toBe(`http://localhost:5173/reset-password?token=${RAW_TOKEN}`);
    });
  });

  describe('failure handling — must NOT throw', () => {
    it('swallows loadBrandedTemplate errors', async () => {
      mockLoadBrandedTemplate.mockRejectedValueOnce(new Error('template missing'));

      await expect(
        service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT),
      ).resolves.toBeUndefined();

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('swallows sendEmail rejections', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP unreachable'));

      await expect(
        service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT),
      ).resolves.toBeUndefined();
    });

    it('logs but does not throw when sendEmail returns success=false', async () => {
      mockSendEmail.mockResolvedValueOnce({ success: false, error: 'auth failed' });

      await expect(
        service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT),
      ).resolves.toBeUndefined();
    });

    it('handles sendEmail success=false without error field', async () => {
      mockSendEmail.mockResolvedValueOnce({ success: false });

      await expect(
        service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT),
      ).resolves.toBeUndefined();
    });
  });

  describe('text body', () => {
    it('includes userName, German prompt, raw resetUrl, and 60 minute notice', async () => {
      await service.sendPasswordReset(makeRecipient(), RAW_TOKEN, EXPIRES_AT);

      const sendArg = mockSendEmail.mock.calls[0]?.[0] as { text: string };
      expect(sendArg.text).toContain('Hallo Jane Doe,');
      expect(sendArg.text).toContain('Passwort zurückzusetzen');
      expect(sendArg.text).toContain('60 Minuten');
      expect(sendArg.text).toContain(RAW_TOKEN);
      expect(sendArg.text).toContain('Ihr Assixx-Team');
    });
  });
});
