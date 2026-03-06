/**
 * Unit tests for AssetTeamService
 *
 * Phase 9: Service tests — mocked DatabaseService.
 * Focus: row mapper (conditional optional fields), validation in setAssetTeams.
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { AssetTeamService } from './asset-team.service.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// AssetTeamService
// =============================================================

describe('AssetTeamService', () => {
  let service: AssetTeamService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AssetTeamService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getAssetTeams
  // =============================================================

  describe('getAssetTeams', () => {
    it('should map DB rows to response with all optional fields', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          team_id: 10,
          team_name: 'Assembly',
          is_primary: true,
          department_id: 5,
          department_name: 'Production',
          assigned_at: new Date('2026-01-15T10:00:00Z'),
          notes: 'Primary team',
        },
      ]);

      const result = await service.getAssetTeams(42, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        teamId: 10,
        teamName: 'Assembly',
        isPrimary: true,
        departmentId: 5,
        departmentName: 'Production',
        assignedAt: '2026-01-15T10:00:00.000Z',
        notes: 'Primary team',
      });
    });

    it('should omit optional fields when DB values are null', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          team_id: 10,
          team_name: 'Assembly',
          is_primary: false,
          department_id: null,
          department_name: null,
          assigned_at: null,
          notes: null,
        },
      ]);

      const result = await service.getAssetTeams(42, 1);

      expect(result[0]).toEqual({
        id: 1,
        teamId: 10,
        teamName: 'Assembly',
        isPrimary: false,
      });
      expect(result[0]).not.toHaveProperty('departmentId');
      expect(result[0]).not.toHaveProperty('notes');
    });

    it('should return empty array when no teams assigned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAssetTeams(42, 1);

      expect(result).toEqual([]);
    });
  });

  // =============================================================
  // setAssetTeams
  // =============================================================

  describe('setAssetTeams', () => {
    it('should throw BadRequestException when team IDs are invalid', async () => {
      // Validation query returns fewer rows than requested
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // only 1 valid, but 2 requested

      await expect(service.setAssetTeams(42, [1, 999], 1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip validation and delete when teamIds is empty', async () => {
      // DELETE existing
      mockDb.query.mockResolvedValueOnce([]);
      // getAssetTeams after
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.setAssetTeams(42, [], 1, 1);

      expect(result).toEqual([]);
      // First call should be DELETE, not SELECT for validation
      const firstCallSql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(firstCallSql).toContain('DELETE FROM asset_teams');
    });
  });
});
