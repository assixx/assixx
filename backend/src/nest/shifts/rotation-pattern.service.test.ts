/**
 * Unit tests for RotationPatternService
 *
 * Phase 9: Service tests — mocked DatabaseService.
 * Focus: row mapper (patternRowToResponse), config parsing, date formatting,
 *        is_active → boolean conversion, CRUD error paths, UUID resolution.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { RotationPatternService } from './rotation-pattern.service.js';
import type { DbPatternRow } from './rotation.types.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
    log: vi.fn(),
  };
}

/** Full DB row with all fields populated */
function createPatternRow(overrides?: Partial<DbPatternRow>): DbPatternRow {
  return {
    id: 1,
    tenant_id: 42,
    team_id: 5,
    name: 'Alternating F/S',
    description: 'Two-week cycle',
    pattern_type: 'alternate_fs',
    pattern_config: '{"weekType":"F","cycleWeeks":2}',
    cycle_length_weeks: 2,
    starts_at: new Date('2026-03-01T00:00:00Z'),
    ends_at: new Date('2026-12-31T00:00:00Z'),
    is_active: IS_ACTIVE.ACTIVE,
    created_by: 10,
    created_by_name: 'Admin User',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
    ...overrides,
  };
}

// =============================================================
// RotationPatternService
// =============================================================

describe('RotationPatternService', () => {
  let service: RotationPatternService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const mockActivityLogger = createMockActivityLogger();
    service = new RotationPatternService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getRotationPattern — row mapping + not found
  // =============================================================

  describe('getRotationPattern', () => {
    it('should map DB row to response with parsed JSON config', async () => {
      mockDb.query.mockResolvedValueOnce([createPatternRow()]);

      const result = await service.getRotationPattern(1, 42);

      expect(result.patternConfig).toEqual({
        weekType: 'F',
        cycleWeeks: 2,
      });
      expect(result.isActive).toBe(true);
      expect(result.startsAt).toBe('2026-03-01');
      expect(result.endsAt).toBe('2026-12-31');
      expect(result.name).toBe('Alternating F/S');
    });

    it('should handle object config (already parsed by DB driver)', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPatternRow({
          pattern_config: { shiftType: 'N', skipWeekends: true },
        }),
      ]);

      const result = await service.getRotationPattern(1, 42);

      expect(result.patternConfig).toEqual({
        shiftType: 'N',
        skipWeekends: true,
      });
    });

    it(`should map is_active = ${IS_ACTIVE.INACTIVE} to isActive=false`, async () => {
      mockDb.query.mockResolvedValueOnce([
        createPatternRow({ is_active: IS_ACTIVE.INACTIVE }),
      ]);

      const result = await service.getRotationPattern(1, 42);

      expect(result.isActive).toBe(false);
    });

    it('should handle null ends_at', async () => {
      mockDb.query.mockResolvedValueOnce([createPatternRow({ ends_at: null })]);

      const result = await service.getRotationPattern(1, 42);

      expect(result.endsAt).toBeNull();
    });

    it('should handle string date (already formatted)', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPatternRow({
          starts_at: '2026-06-15T08:00:00Z',
          ends_at: '2026-09-30T23:59:59Z',
        }),
      ]);

      const result = await service.getRotationPattern(1, 42);

      expect(result.startsAt).toBe('2026-06-15');
      expect(result.endsAt).toBe('2026-09-30');
    });

    it('should throw NotFoundException when no rows returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getRotationPattern(999, 42)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // getRotationPatterns — list + activeOnly filter
  // =============================================================

  describe('getRotationPatterns', () => {
    it('should add is_active filter when activeOnly is true', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getRotationPatterns(42, true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should not add is_active filter when activeOnly is false', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getRotationPatterns(42, false);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should map multiple rows to responses', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPatternRow({ id: 1, name: 'Pattern A' }),
        createPatternRow({
          id: 2,
          name: 'Pattern B',
          is_active: IS_ACTIVE.INACTIVE,
        }),
      ]);

      const result = await service.getRotationPatterns(42, false);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Pattern A');
      expect(result[1]?.name).toBe('Pattern B');
      expect(result[1]?.isActive).toBe(false);
    });
  });

  // =============================================================
  // createRotationPattern — conflict + insert
  // =============================================================

  describe('createRotationPattern', () => {
    it('should throw ConflictException for duplicate name', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // existing pattern

      await expect(
        service.createRotationPattern(
          {
            name: 'Existing Pattern',
            patternType: 'alternate_fs',
            patternConfig: {},
            cycleLengthWeeks: 2,
            startsAt: '2026-03-01',
            isActive: true,
          },
          42,
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it(`should insert with is_active = ${IS_ACTIVE.ACTIVE} when isActive is true`, async () => {
      // No existing pattern
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // getRotationPattern (re-fetch)
      mockDb.query.mockResolvedValueOnce([createPatternRow({ id: 10 })]);

      await service.createRotationPattern(
        {
          name: 'New Pattern',
          patternType: 'fixed_n',
          patternConfig: { shiftType: 'N' },
          cycleLengthWeeks: 1,
          startsAt: '2026-03-01',
          isActive: true,
        },
        42,
        1,
      );

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      // is_active is param at index 9 (0-based)
      expect(insertParams?.[9]).toBe(1);
    });

    it(`should insert with is_active = ${IS_ACTIVE.INACTIVE} when isActive is false`, async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ id: 11 }]);
      mockDb.query.mockResolvedValueOnce([
        createPatternRow({ id: 11, is_active: IS_ACTIVE.INACTIVE }),
      ]);

      await service.createRotationPattern(
        {
          name: 'Inactive Pattern',
          patternType: 'custom',
          patternConfig: {},
          cycleLengthWeeks: 4,
          startsAt: '2026-06-01',
          isActive: false,
        },
        42,
        1,
      );

      const insertParams = mockDb.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[9]).toBe(0);
    });

    it('should allow creating pattern when same name exists but is soft-deleted', async () => {
      // Conflict check returns empty (is_active=1 filter excludes soft-deleted)
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 20 }]);
      // getRotationPattern (re-fetch)
      mockDb.query.mockResolvedValueOnce([createPatternRow({ id: 20 })]);

      await expect(
        service.createRotationPattern(
          {
            name: 'Previously Deleted',
            patternType: 'alternate_fs',
            patternConfig: {},
            cycleLengthWeeks: 2,
            startsAt: '2026-03-01',
            isActive: true,
          },
          42,
          1,
        ),
      ).resolves.toBeDefined();

      // Verify the conflict check query filters by is_active = 1
      const conflictSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(conflictSql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('should only check active patterns for name conflict', async () => {
      // Simulate: no active pattern with same name found
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ id: 30 }]);
      mockDb.query.mockResolvedValueOnce([createPatternRow({ id: 30 })]);

      await service.createRotationPattern(
        {
          name: 'Team-Rotation 3',
          patternType: 'alternate_fs',
          patternConfig: {},
          cycleLengthWeeks: 1,
          startsAt: '2026-04-01',
          isActive: true,
        },
        42,
        1,
      );

      // Conflict check must pass tenant_id and filter is_active
      const conflictParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(conflictParams?.[0]).toBe('Team-Rotation 3');
      expect(conflictParams?.[1]).toBe(42);
    });
  });

  // =============================================================
  // updateRotationPattern — dynamic SET + no fields
  // =============================================================

  describe('updateRotationPattern', () => {
    it('should build dynamic UPDATE with provided fields', async () => {
      // getRotationPattern (exists check)
      mockDb.query.mockResolvedValueOnce([createPatternRow()]);
      // UPDATE query
      mockDb.query.mockResolvedValueOnce([]);
      // getRotationPattern (re-fetch)
      mockDb.query.mockResolvedValueOnce([
        createPatternRow({ name: 'Updated' }),
      ]);

      await service.updateRotationPattern(
        1,
        { name: 'Updated', cycleLengthWeeks: 3 },
        42,
        1,
      );

      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('name');
      expect(updateSql).toContain('cycle_length_weeks');
      expect(updateSql).toContain('UPDATE shift_rotation_patterns SET');
    });

    it('should always include nullable fields via ?? null fallback', async () => {
      // getRotationPattern (exists check)
      mockDb.query.mockResolvedValueOnce([createPatternRow()]);
      // UPDATE query
      mockDb.query.mockResolvedValueOnce([]);
      // getRotationPattern (re-fetch)
      mockDb.query.mockResolvedValueOnce([createPatternRow()]);

      // Even empty DTO adds description=null, team_id=null, ends_at=null
      await service.updateRotationPattern(1, {}, 42, 1);

      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('description');
      expect(updateSql).toContain('team_id');
      expect(updateSql).toContain('ends_at');
    });
  });

  // =============================================================
  // deleteRotationPattern — not found
  // =============================================================

  describe('deleteRotationPattern', () => {
    it('should throw NotFoundException for non-existent pattern', async () => {
      mockDb.query.mockResolvedValueOnce([]); // pattern not found

      await expect(service.deleteRotationPattern(999, 42, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // UUID resolution
  // =============================================================

  describe('getRotationPatternByUuid', () => {
    it('should resolve UUID and return pattern', async () => {
      // resolvePatternIdByUuid
      mockDb.query.mockResolvedValueOnce([{ id: 7 }]);
      // getRotationPattern
      mockDb.query.mockResolvedValueOnce([createPatternRow({ id: 7 })]);

      const result = await service.getRotationPatternByUuid(
        '0194a1b2-c3d4-7e5f-8a9b-c0d1e2f3a4b5',
        42,
      );

      expect(result.id).toBe(7);
    });

    it('should throw NotFoundException for unknown UUID', async () => {
      mockDb.query.mockResolvedValueOnce([]); // UUID not found

      await expect(
        service.getRotationPatternByUuid('unknown-uuid', 42),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
