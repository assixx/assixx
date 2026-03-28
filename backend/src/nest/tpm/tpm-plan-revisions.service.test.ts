/**
 * Unit tests for TpmPlanRevisionsService
 *
 * Mocked dependencies: DatabaseService (query, queryOne).
 * Tests: listRevisions, getRevision — pagination, mapping, 404 handling.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmPlanRevisionsService } from './tpm-plan-revisions.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

const TENANT_ID = 1;
const PLAN_UUID = 'plan-uuid-001';
const REVISION_UUID = 'rev-uuid-001';

function createPlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    name: 'Ölstand prüfen',
    revision_number: 3,
    asset_name: 'Anlage M-001',
    ...overrides,
  };
}

function createRevisionRow(revisionNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    id: revisionNumber,
    uuid: `  rev-uuid-00${revisionNumber}                  `,
    tenant_id: TENANT_ID,
    plan_id: 10,
    revision_number: revisionNumber,
    name: 'Ölstand prüfen',
    asset_id: 5,
    base_weekday: 1,
    base_repeat_every: 1,
    base_time: '08:00:00',
    buffer_hours: '4.0',
    notes: null,
    changed_by: 1,
    changed_by_name: 'Max Mustermann',
    change_reason: revisionNumber === 1 ? 'Initial version' : 'Zeitänderung',
    changed_fields: revisionNumber === 1 ? [] : ['base_time'],
    created_at: '2026-03-01T10:00:00.000Z',
    asset_name: 'Anlage M-001',
    plan_name: 'Ölstand prüfen',
    plan_uuid: PLAN_UUID,
    current_revision_number: 3,
    total_count: '0',
    ...overrides,
  };
}

// =============================================================
// TpmPlanRevisionsService
// =============================================================

describe('TpmPlanRevisionsService', () => {
  let service: TpmPlanRevisionsService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new TpmPlanRevisionsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // listRevisions
  // =============================================================

  describe('listRevisions()', () => {
    it('should return revisions newest-first with user names', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createPlanRow()).mockResolvedValueOnce({ count: '3' });

      mockDb.query.mockResolvedValueOnce([
        createRevisionRow(3),
        createRevisionRow(2),
        createRevisionRow(1),
      ]);

      const result = await service.listRevisions(TENANT_ID, PLAN_UUID, 1, 50);

      expect(result.currentVersion).toBe(3);
      expect(result.planName).toBe('Ölstand prüfen');
      expect(result.assetName).toBe('Anlage M-001');
      expect(result.total).toBe(3);
      expect(result.revisions).toHaveLength(3);
      expect(result.revisions[0]?.revisionNumber).toBe(3);
      expect(result.revisions[0]?.changedByName).toBe('Max Mustermann');
      expect(result.revisions[2]?.revisionNumber).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createPlanRow()).mockResolvedValueOnce({ count: '10' });

      mockDb.query.mockResolvedValueOnce([createRevisionRow(5), createRevisionRow(4)]);

      const result = await service.listRevisions(TENANT_ID, PLAN_UUID, 2, 2);

      expect(result.total).toBe(10);
      expect(result.revisions).toHaveLength(2);

      // Verify OFFSET was calculated correctly (page 2, limit 2 → offset 2)
      const queryCall = mockDb.query.mock.calls[0];
      const params = queryCall?.[1] as unknown[];
      expect(params?.[5]).toBe(2); // limit
      expect(params?.[6]).toBe(2); // offset = (2-1)*2
    });

    it('should return empty result for plan with no revisions', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(createPlanRow({ revision_number: 1 }))
        .mockResolvedValueOnce({ count: '0' });

      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listRevisions(TENANT_ID, PLAN_UUID, 1, 50);

      expect(result.currentVersion).toBe(1);
      expect(result.total).toBe(0);
      expect(result.revisions).toHaveLength(0);
    });

    it('should throw NotFoundException for invalid plan UUID', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.listRevisions(TENANT_ID, 'nonexistent-uuid', 1, 50)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map buffer_hours string to number in API response', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createPlanRow()).mockResolvedValueOnce({ count: '1' });

      mockDb.query.mockResolvedValueOnce([createRevisionRow(1, { buffer_hours: '6.5' })]);

      const result = await service.listRevisions(TENANT_ID, PLAN_UUID, 1, 50);

      expect(result.revisions[0]?.bufferHours).toBe(6.5);
      expect(typeof result.revisions[0]?.bufferHours).toBe('number');
    });
  });

  // =============================================================
  // getRevision
  // =============================================================

  describe('getRevision()', () => {
    it('should return single revision with all fields mapped', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createRevisionRow(2, {
          change_reason: 'Schichtwechsel',
          changed_fields: ['base_weekday', 'base_time'],
        }),
      );

      const result = await service.getRevision(TENANT_ID, REVISION_UUID);

      expect(result.uuid).toBe('rev-uuid-002');
      expect(result.revisionNumber).toBe(2);
      expect(result.changeReason).toBe('Schichtwechsel');
      expect(result.changedFields).toEqual(['base_weekday', 'base_time']);
      expect(result.changedByName).toBe('Max Mustermann');
      expect(result.baseWeekday).toBe(1);
      expect(result.bufferHours).toBe(4);
    });

    it('should throw NotFoundException for invalid revision UUID', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getRevision(TENANT_ID, 'nonexistent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should trim UUID whitespace from DB char(36)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createRevisionRow(1, { uuid: '  abc-def-123                              ' }),
      );

      const result = await service.getRevision(TENANT_ID, REVISION_UUID);

      expect(result.uuid).toBe('abc-def-123');
    });
  });
});
