/**
 * Unit tests for TenantDeletionAudit
 *
 * Phase 13 Batch C (C7): Quick Win — 139 lines, 3 methods.
 * checkLegalHolds, createDeletionAuditTrail, sendDeletionWarningEmails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query, transaction } from '../utils/db.js';
import { wrapConnection } from '../utils/dbWrapper.js';
import emailService from '../utils/emailService.js';
import { TenantDeletionAudit } from './tenant-deletion-audit.service.js';

vi.mock('../utils/db.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../utils/dbWrapper.js', () => ({
  wrapConnection: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../utils/emailService.js', () => ({
  default: { sendEmail: vi.fn() },
}));

const mockQuery = vi.mocked(query);
const mockTransaction = vi.mocked(transaction);
const mockWrapConnection = vi.mocked(wrapConnection);
const mockSendEmail = vi.mocked(emailService.sendEmail);

describe('TenantDeletionAudit', () => {
  let audit: TenantDeletionAudit;

  beforeEach(() => {
    vi.resetAllMocks();
    audit = new TenantDeletionAudit();
  });

  // ============================================
  // checkLegalHolds
  // ============================================

  describe('checkLegalHolds', () => {
    it('should not throw when no legal holds exist', async () => {
      const mockConn = { query: vi.fn().mockResolvedValue([]) };

      await expect(
        audit.checkLegalHolds(1, mockConn as never),
      ).resolves.toBeUndefined();
    });

    it('should throw with hold reason when active holds exist', async () => {
      const mockConn = {
        query: vi
          .fn()
          .mockResolvedValue([
            { id: 1, tenant_id: 1, reason: 'Court order #123', active: 1 },
          ]),
      };

      await expect(audit.checkLegalHolds(1, mockConn as never)).rejects.toThrow(
        'Tenant has active legal hold: Court order #123',
      );
    });

    it('should throw with default message when hold has null reason', async () => {
      const mockConn = {
        query: vi
          .fn()
          .mockResolvedValue([
            { id: 1, tenant_id: 1, reason: null, active: 1 },
          ]),
      };

      await expect(audit.checkLegalHolds(1, mockConn as never)).rejects.toThrow(
        'No reason specified',
      );
    });

    it('should throw generic message when firstHold is falsy', async () => {
      // Edge case: holds.length > 0 but holds[0] is undefined
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      const mockConn = { query: vi.fn().mockResolvedValue(sparseArray) };

      await expect(audit.checkLegalHolds(1, mockConn as never)).rejects.toThrow(
        'Tenant has active legal hold: No reason specified',
      );
    });

    it('should query correct SQL with tenantId', async () => {
      const mockConn = { query: vi.fn().mockResolvedValue([]) };

      await audit.checkLegalHolds(42, mockConn as never);

      expect(mockConn.query).toHaveBeenCalledWith(
        expect.stringContaining('legal_holds'),
        [42],
      );
    });
  });

  // ============================================
  // createDeletionAuditTrail
  // ============================================

  describe('createDeletionAuditTrail', () => {
    it('should use provided connection directly (no transaction)', async () => {
      const mockConn = {
        query: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              company_name: 'Acme Corp',
              subdomain: 'acme',
              created_at: '2024-01-01',
            },
          ])
          .mockResolvedValueOnce([{ count: '5' }])
          .mockResolvedValueOnce(undefined),
      };

      await audit.createDeletionAuditTrail(
        1,
        10,
        'Test reason',
        '1.2.3.4',
        mockConn as never,
      );

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockConn.query).toHaveBeenCalledTimes(3);
    });

    it('should create own transaction when no connection provided', async () => {
      const mockWrappedConn = {
        query: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              company_name: 'Acme',
              subdomain: 'acme',
              created_at: null,
            },
          ])
          .mockResolvedValueOnce([{ count: '0' }])
          .mockResolvedValueOnce(undefined),
      };
      mockWrapConnection.mockReturnValue(mockWrappedConn as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });

      await audit.createDeletionAuditTrail(1, 10);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should query tenant info and user count', async () => {
      const mockConn = {
        query: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              company_name: 'TestCorp',
              subdomain: 'test',
              created_at: '2024-06-01',
            },
          ])
          .mockResolvedValueOnce([{ count: '12' }])
          .mockResolvedValueOnce(undefined),
      };

      await audit.createDeletionAuditTrail(
        1,
        10,
        'Cleanup',
        '10.0.0.1',
        mockConn as never,
      );

      // First call: tenant info
      expect(mockConn.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('tenants'),
        [1],
      );
      // Second call: user count
      expect(mockConn.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('COUNT'),
        [1],
      );
      // Third call: INSERT audit trail
      expect(mockConn.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('deletion_audit_trail'),
        expect.arrayContaining([1, 'TestCorp', 12, 10, '10.0.0.1', 'Cleanup']),
      );
    });

    it('should fall back to defaults for missing optional fields', async () => {
      const mockConn = {
        query: vi
          .fn()
          .mockResolvedValueOnce([]) // no tenant found
          .mockResolvedValueOnce([]) // no user count result
          .mockResolvedValueOnce(undefined),
      };

      await audit.createDeletionAuditTrail(
        1,
        10,
        undefined,
        undefined,
        mockConn as never,
      );

      const insertCall = mockConn.query.mock.calls[2] as [string, unknown[]];
      const params = insertCall[1];
      expect(params).toContain('Unknown'); // company_name fallback
      expect(params).toContain(0); // user count fallback
      expect(params).toContain('unknown'); // ipAddress fallback
      expect(params).toContain('No reason provided'); // reason fallback
    });

    it('should include metadata JSON with subdomain and created_at', async () => {
      const mockConn = {
        query: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 1,
              company_name: 'Corp',
              subdomain: 'corp-sub',
              created_at: '2024-03-15',
            },
          ])
          .mockResolvedValueOnce([{ count: '1' }])
          .mockResolvedValueOnce(undefined),
      };

      await audit.createDeletionAuditTrail(
        1,
        5,
        'reason',
        'ip',
        mockConn as never,
      );

      const insertCall = mockConn.query.mock.calls[2] as [string, unknown[]];
      const metadata = insertCall[1][6] as string;
      const parsed = JSON.parse(metadata) as {
        subdomain: string;
        created_at: string;
      };
      expect(parsed.subdomain).toBe('corp-sub');
      expect(parsed.created_at).toBe('2024-03-15');
    });
  });

  // ============================================
  // sendDeletionWarningEmails
  // ============================================

  describe('sendDeletionWarningEmails', () => {
    it('should send emails to all admins', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          { email: 'admin1@test.com', first_name: 'John', last_name: 'Doe' },
          { email: 'admin2@test.com', first_name: 'Jane', last_name: 'Smith' },
        ],
        [],
      ] as never);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it('should use full name in email when available', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ email: 'admin@test.com', first_name: 'Max', last_name: 'Müller' }],
        [],
      ] as never);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain('Max Müller');
    });

    it('should use only first name when last name is null', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ email: 'admin@test.com', first_name: 'Anna', last_name: null }],
        [],
      ] as never);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain('Anna');
    });

    it('should use "Nutzer" when both names are null', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ email: 'admin@test.com', first_name: null, last_name: null }],
        [],
      ] as never);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain('Nutzer');
    });

    it('should include scheduled date in German locale', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ email: 'admin@test.com', first_name: 'Test', last_name: null }],
        [],
      ] as never);
      const date = new Date('2025-06-15');

      await audit.sendDeletionWarningEmails(1, date);

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain(date.toLocaleDateString('de-DE'));
    });

    it('should send no emails when no admins found', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);

      await audit.sendDeletionWarningEmails(1, new Date());

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should include correct email subject and recipient', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ email: 'boss@acme.com', first_name: 'Boss', last_name: null }],
        [],
      ] as never);

      await audit.sendDeletionWarningEmails(1, new Date());

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'boss@acme.com',
          subject: expect.stringContaining('30 Tagen gelöscht'),
        }),
      );
    });
  });
});
