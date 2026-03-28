/**
 * Unit tests for TenantDeletionAudit (NestJS migration)
 *
 * Migrated from services/tenant-deletion-audit.service.test.ts.
 * Uses DI bypass pattern: `new TenantDeletionAudit(mockDb)`.
 *
 * Key differences from legacy:
 * - DatabaseService.query<T>() returns T[] directly (no [rows, fields] tuple)
 * - DatabaseService.transaction() passes PoolClient to callback
 * - PoolClient.query<T>() returns { rows: T[], rowCount } (pg native format)
 * - No wrapConnection — PoolClient is used directly
 */
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import emailService from '../../utils/email-service.js';
import type { DatabaseService } from '../database/database.service.js';
import { TenantDeletionAudit } from './tenant-deletion-audit.service.js';

vi.mock('../../utils/email-service.js', () => ({
  default: { sendEmail: vi.fn() },
}));

const mockSendEmail = vi.mocked(emailService.sendEmail);

describe('TenantDeletionAudit', () => {
  let audit: TenantDeletionAudit;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    };
    audit = new TenantDeletionAudit(mockDb as unknown as DatabaseService);
  });

  // ============================================
  // checkLegalHolds
  // ============================================

  describe('checkLegalHolds', () => {
    it('should not throw when no legal holds exist', async () => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };

      await expect(
        audit.checkLegalHolds(1, mockClient as unknown as PoolClient),
      ).resolves.toBeUndefined();
    });

    it('should throw with hold reason when active holds exist', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: 1, tenant_id: 1, reason: 'Court order #123', active: 1 }],
        }),
      };

      await expect(audit.checkLegalHolds(1, mockClient as unknown as PoolClient)).rejects.toThrow(
        'Tenant has active legal hold: Court order #123',
      );
    });

    it('should throw with default message when hold has null reason', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: 1, tenant_id: 1, reason: null, active: 1 }],
        }),
      };

      await expect(audit.checkLegalHolds(1, mockClient as unknown as PoolClient)).rejects.toThrow(
        'No reason specified',
      );
    });

    it('should throw generic message when firstHold is falsy', async () => {
      // Edge case: holds.length > 0 but holds[0] is undefined
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: sparseArray }),
      };

      await expect(audit.checkLegalHolds(1, mockClient as unknown as PoolClient)).rejects.toThrow(
        'Tenant has active legal hold: No reason specified',
      );
    });

    it('should query correct SQL with tenantId', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await audit.checkLegalHolds(42, mockClient as unknown as PoolClient);

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('legal_holds'), [42]);
    });
  });

  // ============================================
  // createDeletionAuditTrail
  // ============================================

  describe('createDeletionAuditTrail', () => {
    it('should use provided client directly (no transaction)', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                company_name: 'Acme Corp',
                subdomain: 'acme',
                created_at: '2024-01-01',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };

      await audit.createDeletionAuditTrail(
        1,
        10,
        'Test reason',
        '1.2.3.4',
        mockClient as unknown as PoolClient,
      );

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should create own transaction when no client provided', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                company_name: 'Acme',
                subdomain: 'acme',
                created_at: null,
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };
      mockDb.transaction.mockImplementation(async (cb: (client: PoolClient) => Promise<void>) => {
        await cb(mockClient as unknown as PoolClient);
      });

      await audit.createDeletionAuditTrail(1, 10);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should query tenant info and user count', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                company_name: 'TestCorp',
                subdomain: 'test',
                created_at: '2024-06-01',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ count: '12' }] })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };

      await audit.createDeletionAuditTrail(
        1,
        10,
        'Cleanup',
        '10.0.0.1',
        mockClient as unknown as PoolClient,
      );

      // First call: tenant info
      expect(mockClient.query).toHaveBeenNthCalledWith(1, expect.stringContaining('tenants'), [1]);
      // Second call: user count
      expect(mockClient.query).toHaveBeenNthCalledWith(2, expect.stringContaining('COUNT'), [1]);
      // Third call: INSERT audit trail
      expect(mockClient.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('deletion_audit_trail'),
        expect.arrayContaining([1, 'TestCorp', 12, 10, '10.0.0.1', 'Cleanup']),
      );
    });

    it('should fall back to defaults for missing optional fields', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // no tenant found
          .mockResolvedValueOnce({ rows: [] }) // no user count result
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };

      await audit.createDeletionAuditTrail(
        1,
        10,
        undefined,
        undefined,
        mockClient as unknown as PoolClient,
      );

      const insertCall = mockClient.query.mock.calls[2] as [string, unknown[]];
      const params = insertCall[1];
      expect(params).toContain('Unknown'); // company_name fallback
      expect(params).toContain(0); // user count fallback
      expect(params).toContain('unknown'); // ipAddress fallback
      expect(params).toContain('No reason provided'); // reason fallback
    });

    it('should include metadata JSON with subdomain and created_at', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                company_name: 'Corp',
                subdomain: 'corp-sub',
                created_at: '2024-03-15',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };

      await audit.createDeletionAuditTrail(
        1,
        5,
        'reason',
        'ip',
        mockClient as unknown as PoolClient,
      );

      const insertCall = mockClient.query.mock.calls[2] as [string, unknown[]];
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
      mockDb.query.mockResolvedValueOnce([
        { email: 'admin1@test.com', first_name: 'John', last_name: 'Doe' },
        { email: 'admin2@test.com', first_name: 'Jane', last_name: 'Smith' },
      ]);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it('should use full name in email when available', async () => {
      mockDb.query.mockResolvedValueOnce([
        { email: 'admin@test.com', first_name: 'Max', last_name: 'Müller' },
      ]);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain('Max Müller');
    });

    it('should use only first name when last name is null', async () => {
      mockDb.query.mockResolvedValueOnce([
        { email: 'admin@test.com', first_name: 'Anna', last_name: null },
      ]);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain('Anna');
    });

    it('should use "Nutzer" when both names are null', async () => {
      mockDb.query.mockResolvedValueOnce([
        { email: 'admin@test.com', first_name: null, last_name: null },
      ]);

      await audit.sendDeletionWarningEmails(1, new Date('2025-06-01'));

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain('Nutzer');
    });

    it('should include scheduled date in German locale', async () => {
      mockDb.query.mockResolvedValueOnce([
        { email: 'admin@test.com', first_name: 'Test', last_name: null },
      ]);
      const date = new Date('2025-06-15');

      await audit.sendDeletionWarningEmails(1, date);

      const callArg = mockSendEmail.mock.calls[0]?.[0] as {
        html: string;
      };
      expect(callArg.html).toContain(date.toLocaleDateString('de-DE'));
    });

    it('should send no emails when no admins found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await audit.sendDeletionWarningEmails(1, new Date());

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should include correct email subject and recipient', async () => {
      mockDb.query.mockResolvedValueOnce([
        { email: 'boss@acme.com', first_name: 'Boss', last_name: null },
      ]);

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
