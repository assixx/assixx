/**
 * Unit tests for TpmShiftAssignmentsService
 *
 * Mocked dependencies: DatabaseService (query).
 * Tests: getShiftAssignments — query execution, response mapping, empty results.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmShiftAssignmentsService } from './tpm-shift-assignments.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function makeAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    plan_uuid: 'plan-uuid-001                           ',
    asset_id: 10,
    shift_date: '2026-03-15',
    user_id: 5,
    first_name: 'Max',
    last_name: 'Müller',
    shift_type: 'early',
    ...overrides,
  };
}

// =============================================================
// TpmShiftAssignmentsService
// =============================================================

describe('TpmShiftAssignmentsService', () => {
  let service: TpmShiftAssignmentsService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new TpmShiftAssignmentsService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getShiftAssignments
  // =============================================================

  describe('getShiftAssignments', () => {
    it('should return empty array when no assignments exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getShiftAssignments(
        10,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledOnce();
    });

    it('should pass correct parameters to query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs?.[1]).toEqual([10, '2026-03-01', '2026-03-31']);
    });

    it('should query with is_tpm_mode = true filter', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('sp.is_tpm_mode = true');
    });

    it('should join tpm_maintenance_plans by asset_id', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('mp.asset_id = sp.asset_id');
    });

    it('should map DB rows to API response correctly', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeAssignmentRow(),
        makeAssignmentRow({
          plan_uuid: 'plan-uuid-002                           ',
          asset_id: 20,
          user_id: 7,
          first_name: 'Anna',
          last_name: 'Schmidt',
          shift_type: 'late',
        }),
      ]);

      const result = await service.getShiftAssignments(
        10,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        planUuid: 'plan-uuid-001',
        assetId: 10,
        shiftDate: '2026-03-15',
        userId: 5,
        firstName: 'Max',
        lastName: 'Müller',
        shiftType: 'early',
      });
      expect(result[1]).toEqual({
        planUuid: 'plan-uuid-002',
        assetId: 20,
        shiftDate: '2026-03-15',
        userId: 7,
        firstName: 'Anna',
        lastName: 'Schmidt',
        shiftType: 'late',
      });
    });

    it('should trim plan_uuid (char(36) padding)', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeAssignmentRow({ plan_uuid: 'abc-123   ' }),
      ]);

      const result = await service.getShiftAssignments(
        10,
        '2026-03-01',
        '2026-03-31',
      );

      expect(result[0]?.planUuid).toBe('abc-123');
    });

    it('should only query active TPM plans', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('mp.is_active = 1');
    });

    it('should use DISTINCT to avoid duplicate rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getShiftAssignments(10, '2026-03-01', '2026-03-31');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('SELECT DISTINCT');
    });
  });
});
