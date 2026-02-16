/**
 * Vacation Queries Service – Unit Tests for getUnreadNotificationRequestIds
 *
 * Tests the method that queries unread vacation notification request IDs
 * for "Neu" badge display on vacation request cards.
 *
 * Pattern: tenantTransaction(callback) receives mockClient with query() mock.
 * tenantId comes from CLS context, not as an argument.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { VacationQueriesService } from './vacation-queries.service.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Test Suite
// =============================================================

describe('VacationQueriesService', () => {
  let service: VacationQueriesService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new VacationQueriesService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // getUnreadNotificationRequestIds
  // -----------------------------------------------------------

  describe('getUnreadNotificationRequestIds()', () => {
    const TENANT_ID = 1;
    const USER_ID = 42;

    /** Wire tenantTransaction to invoke callback with a mock client */
    function setupTransaction(queryResult: {
      rows: Array<{ request_id: string }>;
    }) {
      const mockClient = { query: vi.fn().mockResolvedValue(queryResult) };

      mockDb.tenantTransaction.mockImplementation(
        async (callback: (client: unknown) => Promise<unknown>) => {
          return await callback(mockClient);
        },
      );

      return mockClient;
    }

    it('should return request IDs from unread vacation notifications', async () => {
      const mockClient = setupTransaction({
        rows: [
          { request_id: 'abc-001' },
          { request_id: 'abc-002' },
          { request_id: 'abc-003' },
        ],
      });

      const result = await service.getUnreadNotificationRequestIds(
        TENANT_ID,
        USER_ID,
      );

      expect(result).toEqual(['abc-001', 'abc-002', 'abc-003']);
      expect(mockDb.tenantTransaction).toHaveBeenCalledExactlyOnceWith(
        expect.any(Function),
      );
      expect(mockClient.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining("n.type = 'vacation'"),
        [TENANT_ID, USER_ID],
      );
    });

    it('should return empty array when no unread notifications exist', async () => {
      setupTransaction({ rows: [] });

      const result = await service.getUnreadNotificationRequestIds(
        TENANT_ID,
        USER_ID,
      );

      expect(result).toEqual([]);
    });

    it('should handle single result row', async () => {
      setupTransaction({
        rows: [{ request_id: 'only-one' }],
      });

      const result = await service.getUnreadNotificationRequestIds(
        TENANT_ID,
        USER_ID,
      );

      expect(result).toEqual(['only-one']);
    });

    it('should query with correct SQL fragments', async () => {
      const mockClient = setupTransaction({ rows: [] });

      await service.getUnreadNotificationRequestIds(TENANT_ID, USER_ID);

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('SELECT DISTINCT');
      expect(sql).toContain("n.metadata->>'requestId'");
      expect(sql).toContain('LEFT JOIN notification_read_status nrs');
      expect(sql).toContain('nrs.id IS NULL');
      expect(sql).toContain("n.recipient_type = 'user'");
    });

    it('should pass tenantId as first param and userId as second param', async () => {
      const mockClient = setupTransaction({ rows: [] });

      await service.getUnreadNotificationRequestIds(99, 555);

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(99);
      expect(params[1]).toBe(555);
    });
  });
});
