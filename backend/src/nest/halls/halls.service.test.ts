/**
 * Unit tests for HallsService
 *
 * Mocked dependencies — no Docker needed.
 * Covers: CRUD operations, stats, private helpers (mapToResponse, buildUpdateFields).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { CreateHallDto } from './dto/create-hall.dto.js';
import type { UpdateHallDto } from './dto/update-hall.dto.js';
import type { HallRow } from './halls.service.js';
import { HallsService } from './halls.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard hall row — all optional fields set to defaults */
function makeHallRow(overrides: Partial<HallRow> = {}): HallRow {
  return {
    id: 1,
    name: 'Werkshalle A',
    description: null,
    area_id: null,
    is_active: IS_ACTIVE.ACTIVE,
    tenant_id: 10,
    created_by: 1,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    area_name: undefined,
    ...overrides,
  };
}

// =============================================================
// HallsService
// =============================================================

describe('HallsService', () => {
  let service: HallsService;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLogger = createMockActivityLogger();
    mockDb = createMockDb();
    service = new HallsService(
      mockActivityLogger as unknown as ActivityLoggerService,
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // listHalls
  // =============================================================

  describe('listHalls', () => {
    it('should return mapped hall responses', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeHallRow(),
        makeHallRow({ id: 2, name: 'Werkshalle B' }),
      ]);

      const result = await service.listHalls(10);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Werkshalle A');
      expect(result[1]?.name).toBe('Werkshalle B');
    });

    it('should fall back to simple query on error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('JOIN failed'));
      mockDb.query.mockResolvedValueOnce([makeHallRow()]);

      const result = await service.listHalls(10);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no halls exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listHalls(10);

      expect(result).toHaveLength(0);
    });

    it('should omit extended fields when includeExtended=false', async () => {
      const row = makeHallRow({ area_name: 'Produktion' });
      mockDb.query.mockResolvedValueOnce([row]);

      const result = await service.listHalls(10, false);

      expect(result[0]?.areaName).toBeUndefined();
    });
  });

  // =============================================================
  // getHallById
  // =============================================================

  describe('getHallById', () => {
    it('should throw NotFoundException when hall not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getHallById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped response', async () => {
      const row = makeHallRow({ area_name: 'Produktion' });
      mockDb.query.mockResolvedValueOnce([row]);

      const result = await service.getHallById(1, 10);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Werkshalle A');
      expect(result.areaName).toBe('Produktion');
    });

    it('should fall back to simple query when extended fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('JOIN error'));
      mockDb.query.mockResolvedValueOnce([makeHallRow()]);

      const result = await service.getHallById(1, 10);

      expect(result.id).toBe(1);
      expect(result.areaName).toBeUndefined();
    });

    it('should throw NotFoundException when fallback also finds nothing', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('JOIN error'));
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getHallById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // createHall
  // =============================================================

  describe('createHall', () => {
    it('should throw BadRequestException for empty name', async () => {
      const dto = {
        name: '   ',
        description: null,
        areaId: null,
      } as unknown as CreateHallDto;

      await expect(service.createHall(dto, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create hall and log activity', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([
        makeHallRow({ id: 5, name: 'Neue Halle' }),
      ]); // getHallById

      const dto = {
        name: 'Neue Halle',
        description: null,
        areaId: null,
      } as unknown as CreateHallDto;

      const result = await service.createHall(dto, 1, 10);

      expect(result.id).toBe(5);
      expect(mockActivityLogger.logCreate).toHaveBeenCalled();
    });

    it('should throw when INSERT returns no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]); // INSERT returns empty

      const dto = {
        name: 'FailHall',
        description: null,
        areaId: null,
      } as unknown as CreateHallDto;

      await expect(service.createHall(dto, 1, 10)).rejects.toThrow(
        'Failed to create hall',
      );
    });

    it('should pass areaId to INSERT query', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 7 }]);
      mockDb.query.mockResolvedValueOnce([makeHallRow({ id: 7, area_id: 3 })]);

      const dto = {
        name: 'Halle mit Bereich',
        description: 'Beschreibung',
        areaId: 3,
      } as unknown as CreateHallDto;

      await service.createHall(dto, 1, 10);

      const insertArgs = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(insertArgs).toContain(3); // areaId
    });
  });

  // =============================================================
  // updateHall
  // =============================================================

  describe('updateHall', () => {
    it('should throw NotFoundException when hall not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = { name: 'Updated' } as unknown as UpdateHallDto;

      await expect(service.updateHall(999, dto, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update fields and log activity', async () => {
      mockDb.query.mockResolvedValueOnce([makeHallRow()]); // find existing
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      mockDb.query.mockResolvedValueOnce([
        makeHallRow({ name: 'Aktualisiert' }),
      ]); // getHallById

      const dto = { name: 'Aktualisiert' } as unknown as UpdateHallDto;
      const result = await service.updateHall(1, dto, 1, 10);

      expect(result.name).toBe('Aktualisiert');
      expect(mockActivityLogger.logUpdate).toHaveBeenCalled();
    });

    it('should skip UPDATE when no fields provided', async () => {
      mockDb.query.mockResolvedValueOnce([makeHallRow()]); // find existing
      mockDb.query.mockResolvedValueOnce([makeHallRow()]); // getHallById (no UPDATE)

      const dto = {} as unknown as UpdateHallDto;
      const result = await service.updateHall(1, dto, 1, 10);

      expect(result.name).toBe('Werkshalle A');
      // 2 query calls: find + getHallById (no UPDATE)
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // deleteHall
  // =============================================================

  describe('deleteHall', () => {
    it('should throw NotFoundException when hall not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteHall(999, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete hall and log activity', async () => {
      mockDb.query.mockResolvedValueOnce([makeHallRow()]); // find existing
      mockDb.query.mockResolvedValueOnce([]); // DELETE

      const result = await service.deleteHall(1, 1, 10);

      expect(result.message).toBe('Hall deleted successfully');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });
  });

  // =============================================================
  // getHallStats
  // =============================================================

  describe('getHallStats', () => {
    it('should return total halls count', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '8' }]);

      const result = await service.getHallStats(10);

      expect(result.totalHalls).toBe(8);
    });

    it('should default to 0 when no rows returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getHallStats(10);

      expect(result.totalHalls).toBe(0);
    });
  });

  // =============================================================
  // Private helpers (via bracket notation)
  // =============================================================

  describe('mapToResponse (private)', () => {
    it('should include areaName when includeExtended=true', () => {
      const row = makeHallRow({ area_name: 'Produktion' });

      const result = service['mapToResponse'](row, true);

      expect(result.areaName).toBe('Produktion');
    });

    it('should exclude areaName when includeExtended=false', () => {
      const row = makeHallRow({ area_name: 'Produktion' });

      const result = service['mapToResponse'](row, false);

      expect(result.areaName).toBeUndefined();
      expect(result.name).toBe('Werkshalle A');
    });

    it('should map null description to undefined', () => {
      const row = makeHallRow({ description: null });
      const result = service['mapToResponse'](row, false);

      expect(result.description).toBeUndefined();
    });

    it('should map null area_id to undefined', () => {
      const row = makeHallRow({ area_id: null });
      const result = service['mapToResponse'](row, false);

      expect(result.areaId).toBeUndefined();
    });

    it('should map dates to ISO strings', () => {
      const row = makeHallRow();
      const result = service['mapToResponse'](row, false);

      expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('buildUpdateFields (private)', () => {
    it('should build fields from DTO keys', () => {
      const dto = {
        name: 'Updated',
        description: 'Neue Beschreibung',
        isActive: 0,
      } as unknown as UpdateHallDto;

      const { fields, values } = service['buildUpdateFields'](dto);

      expect(fields).toHaveLength(3);
      expect(values).toEqual(['Updated', 'Neue Beschreibung', 0]);
      expect(fields[0]).toBe('name = $1');
    });

    it('should return empty arrays for empty dto', () => {
      const dto = {} as unknown as UpdateHallDto;
      const { fields, values } = service['buildUpdateFields'](dto);

      expect(fields).toHaveLength(0);
      expect(values).toHaveLength(0);
    });

    it('should include areaId when provided', () => {
      const dto = { areaId: 5 } as unknown as UpdateHallDto;
      const { fields, values } = service['buildUpdateFields'](dto);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toBe('area_id = $1');
      expect(values[0]).toBe(5);
    });
  });
});
