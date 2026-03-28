/**
 * Vacation Queries Service – Unit Tests
 *
 * Tests all public query methods + private helpers (via public API):
 * - getRequestById, getMyRequests, getIncomingRequests
 * - getStatusLog, getTeamCalendar, getMyCalendarVacations
 * - getUnreadNotificationRequestIds
 * - buildFilters, paginatedQuery, mappers, fmtDate (indirectly)
 *
 * Pattern: tenantTransaction(callback) receives mockClient with query() mock.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { VacationQueryDto } from './dto/vacation-query.dto.js';
import { VacationQueriesService } from './vacation-queries.service.js';

// =============================================================
// Constants
// =============================================================

const TENANT_ID = 1;
const USER_ID = 42;

// =============================================================
// Mock Factories
// =============================================================

function createMockDb(): {
  tenantTransaction: ReturnType<typeof vi.fn>;
} {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

/** Wire tenantTransaction to invoke callback with a sequenced mock client */
function setupSequencedTransaction(
  mockDb: MockDb,
  queryResults: Array<{ rows: unknown[] }>,
): { query: ReturnType<typeof vi.fn> } {
  const mockClient = { query: vi.fn() };
  for (const result of queryResults) {
    mockClient.query.mockResolvedValueOnce(result);
  }
  mockDb.tenantTransaction.mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) => {
      return await callback(mockClient);
    },
  );
  return mockClient;
}

/** Create a minimal VacationRequestRow from DB */
function createRequestRow(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'req-001',
    requester_id: 10,
    approver_id: 20,
    substitute_id: 30,
    start_date: '2026-03-10',
    end_date: '2026-03-14',
    half_day_start: 'none',
    half_day_end: 'none',
    vacation_type: 'regular',
    status: 'pending',
    computed_days: '5.0',
    is_special_leave: false,
    request_note: null,
    response_note: null,
    responded_at: null,
    responded_by: null,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    requester_name: 'Max Müller',
    approver_name: 'Anna Chef',
    substitute_name: 'Bob Vertreter',
    ...overrides,
  };
}

function createBaseQuery(overrides?: Partial<VacationQueryDto>): VacationQueryDto {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  } as VacationQueryDto;
}

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
  // getRequestById
  // -----------------------------------------------------------

  describe('getRequestById()', () => {
    it('should return mapped request with resolved names', async () => {
      setupSequencedTransaction(mockDb, [{ rows: [createRequestRow()] }]);

      const result = await service.getRequestById(TENANT_ID, 'req-001');

      expect(result.id).toBe('req-001');
      expect(result.requesterId).toBe(10);
      expect(result.approverId).toBe(20);
      expect(result.substituteId).toBe(30);
      expect(result.startDate).toBe('2026-03-10');
      expect(result.endDate).toBe('2026-03-14');
      expect(result.computedDays).toBe(5.0);
      expect(result.requesterName).toBe('Max Müller');
      expect(result.approverName).toBe('Anna Chef');
      expect(result.substituteName).toBe('Bob Vertreter');
    });

    it('should throw NotFoundException when request not found', async () => {
      setupSequencedTransaction(mockDb, [{ rows: [] }]);

      await expect(service.getRequestById(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not set name fields when they are null', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            createRequestRow({
              requester_name: null,
              approver_name: null,
              substitute_name: null,
            }),
          ],
        },
      ]);

      const result = await service.getRequestById(TENANT_ID, 'req-001');

      expect(result.requesterName).toBeUndefined();
      expect(result.approverName).toBeUndefined();
      expect(result.substituteName).toBeUndefined();
    });

    it('should query with IS_ACTIVE filter', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [{ rows: [createRequestRow()] }]);

      await service.getRequestById(TENANT_ID, 'req-001');

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active = 1');
      expect(sql).toContain('LEFT JOIN users req');
      expect(sql).toContain('LEFT JOIN users app');
      expect(sql).toContain('LEFT JOIN users sub');
    });

    it('should handle Date objects in created_at/updated_at', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            createRequestRow({
              created_at: new Date('2026-03-01T10:00:00Z'),
              updated_at: new Date('2026-03-02T12:00:00Z'),
            }),
          ],
        },
      ]);

      const result = await service.getRequestById(TENANT_ID, 'req-001');

      expect(result.createdAt).toBe('2026-03-01T10:00:00.000Z');
      expect(result.updatedAt).toBe('2026-03-02T12:00:00.000Z');
    });
  });

  // -----------------------------------------------------------
  // getMyRequests
  // -----------------------------------------------------------

  describe('getMyRequests()', () => {
    it('should return paginated results with requester filter', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ total: '1' }] },
        { rows: [createRequestRow()] },
      ]);

      const result = await service.getMyRequests(USER_ID, TENANT_ID, createBaseQuery());

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe('req-001');

      // Verify requester_id filter is in the count query
      const countSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('requester_id');
    });

    it('should apply year/status/vacationType filters', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ total: '0' }] },
        { rows: [] },
      ]);

      await service.getMyRequests(
        USER_ID,
        TENANT_ID,
        createBaseQuery({
          year: 2026,
          status: 'approved',
          vacationType: 'regular',
        }),
      );

      const countSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('EXTRACT(YEAR FROM vr.start_date)');
      expect(countSql).toContain('vr.status');
      expect(countSql).toContain('vr.vacation_type');
    });

    it('should calculate pagination correctly', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ total: '45' }] },
        { rows: [] },
      ]);

      const result = await service.getMyRequests(
        USER_ID,
        TENANT_ID,
        createBaseQuery({ page: 3, limit: 10 }),
      );

      expect(result.total).toBe(45);
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(3);

      // Verify OFFSET is (3-1)*10 = 20
      const dataParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(dataParams).toContain(20); // offset
      expect(dataParams).toContain(10); // limit
    });

    it('should default to 0 total when count row missing', async () => {
      setupSequencedTransaction(mockDb, [
        { rows: [] }, // no count row
        { rows: [] },
      ]);

      const result = await service.getMyRequests(USER_ID, TENANT_ID, createBaseQuery());

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // getIncomingRequests
  // -----------------------------------------------------------

  describe('getIncomingRequests()', () => {
    it('should filter by approver_id instead of requester_id', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ total: '2' }] },
        { rows: [createRequestRow(), createRequestRow({ id: 'req-002' })] },
      ]);

      const result = await service.getIncomingRequests(USER_ID, TENANT_ID, createBaseQuery());

      expect(result.data).toHaveLength(2);

      const countSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(countSql).toContain('approver_id');
      expect(countSql).not.toContain('requester_id');
    });
  });

  // -----------------------------------------------------------
  // getStatusLog
  // -----------------------------------------------------------

  describe('getStatusLog()', () => {
    it('should return mapped status log entries', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            {
              id: 'log-1',
              request_id: 'req-001',
              old_status: null,
              new_status: 'pending',
              changed_by: 10,
              changed_by_name: 'Max Müller',
              note: 'Eingereicht',
              created_at: '2026-03-01T10:00:00Z',
            },
            {
              id: 'log-2',
              request_id: 'req-001',
              old_status: 'pending',
              new_status: 'approved',
              changed_by: 20,
              changed_by_name: 'Anna Chef',
              note: 'Genehmigt',
              created_at: '2026-03-02T08:00:00Z',
            },
          ],
        },
      ]);

      const result = await service.getStatusLog(TENANT_ID, 'req-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('log-1');
      expect(result[0]?.oldStatus).toBeNull();
      expect(result[0]?.newStatus).toBe('pending');
      expect(result[0]?.changedByName).toBe('Max Müller');
      expect(result[1]?.newStatus).toBe('approved');
      expect(result[1]?.changedByName).toBe('Anna Chef');
    });

    it('should not set changedByName when null', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            {
              id: 'log-1',
              request_id: 'req-001',
              old_status: null,
              new_status: 'pending',
              changed_by: 10,
              changed_by_name: null,
              note: null,
              created_at: '2026-03-01T10:00:00Z',
            },
          ],
        },
      ]);

      const result = await service.getStatusLog(TENANT_ID, 'req-001');

      expect(result[0]?.changedByName).toBeUndefined();
      expect(result[0]?.note).toBeNull();
    });

    it('should handle Date object in created_at', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            {
              id: 'log-1',
              request_id: 'req-001',
              old_status: null,
              new_status: 'pending',
              changed_by: 10,
              changed_by_name: null,
              note: null,
              created_at: new Date('2026-03-01T10:00:00Z'),
            },
          ],
        },
      ]);

      const result = await service.getStatusLog(TENANT_ID, 'req-001');

      expect(result[0]?.createdAt).toBe('2026-03-01T10:00:00.000Z');
    });

    it('should return empty array when no log entries', async () => {
      setupSequencedTransaction(mockDb, [{ rows: [] }]);

      const result = await service.getStatusLog(TENANT_ID, 'req-001');

      expect(result).toEqual([]);
    });

    it('should query with ORDER BY created_at ASC', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [{ rows: [] }]);

      await service.getStatusLog(TENANT_ID, 'req-001');

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ORDER BY sl.created_at ASC');
    });
  });

  // -----------------------------------------------------------
  // getTeamCalendar
  // -----------------------------------------------------------

  describe('getTeamCalendar()', () => {
    it('should return team calendar with entries', async () => {
      setupSequencedTransaction(mockDb, [
        // Q1: getTeamName
        { rows: [{ name: 'Team Alpha' }] },
        // Q2: queryCalendarEntries
        {
          rows: [
            {
              user_id: 10,
              user_name: 'Max Müller',
              start_date: '2026-03-10',
              end_date: '2026-03-14',
              vacation_type: 'regular',
              half_day_start: 'none',
              half_day_end: 'none',
            },
          ],
        },
      ]);

      const result = await service.getTeamCalendar(TENANT_ID, 5, 3, 2026);

      expect(result.teamId).toBe(5);
      expect(result.teamName).toBe('Team Alpha');
      expect(result.month).toBe(3);
      expect(result.year).toBe(2026);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.userId).toBe(10);
      expect(result.entries[0]?.userName).toBe('Max Müller');
      expect(result.entries[0]?.startDate).toBe('2026-03-10');
      expect(result.entries[0]?.endDate).toBe('2026-03-14');
    });

    it('should throw NotFoundException when team not found', async () => {
      setupSequencedTransaction(mockDb, [{ rows: [] }]);

      await expect(service.getTeamCalendar(TENANT_ID, 999, 3, 2026)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate correct month bounds', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ name: 'Team' }] },
        { rows: [] },
      ]);

      await service.getTeamCalendar(TENANT_ID, 1, 2, 2026);

      // February 2026 has 28 days
      const calParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(calParams).toContain('2026-02-01');
      expect(calParams).toContain('2026-02-28');
    });

    it('should handle leap year February', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ name: 'Team' }] },
        { rows: [] },
      ]);

      // 2028 is a leap year
      await service.getTeamCalendar(TENANT_ID, 1, 2, 2028);

      const calParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(calParams).toContain('2028-02-29');
    });

    it('should calculate December bounds correctly', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [
        { rows: [{ name: 'Team' }] },
        { rows: [] },
      ]);

      await service.getTeamCalendar(TENANT_ID, 1, 12, 2026);

      const calParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(calParams).toContain('2026-12-01');
      expect(calParams).toContain('2026-12-31');
    });

    it('should handle Date objects in calendar entry dates', async () => {
      setupSequencedTransaction(mockDb, [
        { rows: [{ name: 'Team' }] },
        {
          rows: [
            {
              user_id: 10,
              user_name: 'Max',
              start_date: new Date('2026-03-10T00:00:00Z'),
              end_date: new Date('2026-03-14T00:00:00Z'),
              vacation_type: 'regular',
              half_day_start: 'none',
              half_day_end: 'none',
            },
          ],
        },
      ]);

      const result = await service.getTeamCalendar(TENANT_ID, 1, 3, 2026);

      expect(result.entries[0]?.startDate).toBe('2026-03-10');
      expect(result.entries[0]?.endDate).toBe('2026-03-14');
    });
  });

  // -----------------------------------------------------------
  // getMyCalendarVacations
  // -----------------------------------------------------------

  describe('getMyCalendarVacations()', () => {
    it('should return mapped calendar entries', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            {
              start_date: '2026-03-10',
              end_date: '2026-03-14',
              vacation_type: 'regular',
              half_day_start: 'none',
              half_day_end: 'afternoon',
            },
          ],
        },
      ]);

      const result = await service.getMyCalendarVacations(
        USER_ID,
        TENANT_ID,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.startDate).toBe('2026-03-10');
      expect(result[0]?.endDate).toBe('2026-03-14');
      expect(result[0]?.vacationType).toBe('regular');
      expect(result[0]?.halfDayStart).toBe('none');
      expect(result[0]?.halfDayEnd).toBe('afternoon');
    });

    it('should return empty array when no vacations in range', async () => {
      setupSequencedTransaction(mockDb, [{ rows: [] }]);

      const result = await service.getMyCalendarVacations(
        USER_ID,
        TENANT_ID,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toEqual([]);
    });

    it('should query only approved and active vacations', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [{ rows: [] }]);

      await service.getMyCalendarVacations(USER_ID, TENANT_ID, '2026-03-01', '2026-03-31');

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("vr.status = 'approved'");
      expect(sql).toContain('is_active = 1');
      expect(sql).toContain('ORDER BY vr.start_date ASC');
    });

    it('should pass date range params correctly', async () => {
      const mockClient = setupSequencedTransaction(mockDb, [{ rows: [] }]);

      await service.getMyCalendarVacations(USER_ID, TENANT_ID, '2026-06-01', '2026-06-30');

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([TENANT_ID, USER_ID, '2026-06-01', '2026-06-30']);
    });

    it('should handle multiple vacation entries', async () => {
      setupSequencedTransaction(mockDb, [
        {
          rows: [
            {
              start_date: '2026-03-05',
              end_date: '2026-03-07',
              vacation_type: 'regular',
              half_day_start: 'morning',
              half_day_end: 'none',
            },
            {
              start_date: '2026-03-20',
              end_date: '2026-03-25',
              vacation_type: 'unpaid',
              half_day_start: 'none',
              half_day_end: 'none',
            },
          ],
        },
      ]);

      const result = await service.getMyCalendarVacations(
        USER_ID,
        TENANT_ID,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.vacationType).toBe('regular');
      expect(result[1]?.vacationType).toBe('unpaid');
    });
  });

  // -----------------------------------------------------------
  // getUnreadNotificationRequestIds
  // -----------------------------------------------------------

  describe('getUnreadNotificationRequestIds()', () => {
    /** Wire tenantTransaction to invoke callback with a mock client */
    function setupTransaction(queryResult: { rows: Array<{ request_id: string }> }): {
      query: ReturnType<typeof vi.fn>;
    } {
      return setupSequencedTransaction(mockDb, [queryResult]);
    }

    it('should return request IDs from unread vacation notifications', async () => {
      const mockClient = setupTransaction({
        rows: [{ request_id: 'abc-001' }, { request_id: 'abc-002' }, { request_id: 'abc-003' }],
      });

      const result = await service.getUnreadNotificationRequestIds(TENANT_ID, USER_ID);

      expect(result).toEqual(['abc-001', 'abc-002', 'abc-003']);
      expect(mockDb.tenantTransaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
      expect(mockClient.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining("n.type = 'vacation'"),
        [TENANT_ID, USER_ID],
      );
    });

    it('should return empty array when no unread notifications exist', async () => {
      setupTransaction({ rows: [] });

      const result = await service.getUnreadNotificationRequestIds(TENANT_ID, USER_ID);

      expect(result).toEqual([]);
    });

    it('should handle single result row', async () => {
      setupTransaction({
        rows: [{ request_id: 'only-one' }],
      });

      const result = await service.getUnreadNotificationRequestIds(TENANT_ID, USER_ID);

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
