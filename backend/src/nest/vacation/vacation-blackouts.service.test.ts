/**
 * Vacation Blackouts Service – Unit Tests (Phase 3, Session 14)
 *
 * Mocked dependency: DatabaseService (tenantTransaction).
 * Tests: CRUD, getConflicts (scope polymorphism), scope validation.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { VacationBlackoutsService } from './vacation-blackouts.service.js';
import type { VacationBlackoutRow } from './vacation.types.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

/** Extended row with scope_name from JOIN */
interface BlackoutWithScopeRow extends VacationBlackoutRow {
  scope_name: string | null;
}

function createMockBlackoutRow(
  overrides?: Partial<BlackoutWithScopeRow>,
): BlackoutWithScopeRow {
  return {
    id: 'bo-001',
    tenant_id: 1,
    name: 'Summer Freeze',
    reason: 'Peak production',
    start_date: '2026-07-15',
    end_date: '2026-07-31',
    scope_type: 'global',
    scope_id: null,
    is_active: 1,
    created_by: 10,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    scope_name: null,
    ...overrides,
  };
}

// =============================================================
// Test Suite
// =============================================================

describe('VacationBlackoutsService', () => {
  let service: VacationBlackoutsService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationBlackoutsService(
      mockDb as unknown as DatabaseService,
    );
  });

  // -----------------------------------------------------------
  // getBlackouts
  // -----------------------------------------------------------

  describe('getBlackouts()', () => {
    it('should return mapped blackouts', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow()],
      });

      const result = await service.getBlackouts(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('bo-001');
      expect(result[0]?.name).toBe('Summer Freeze');
      expect(result[0]?.startDate).toBe('2026-07-15');
      expect(result[0]?.endDate).toBe('2026-07-31');
      expect(result[0]?.scopeType).toBe('global');
      expect(result[0]?.scopeId).toBeNull();
    });

    it('should return empty array when no blackouts exist', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBlackouts(1);

      expect(result).toHaveLength(0);
    });

    it('should include scope_name for team-scoped blackouts', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createMockBlackoutRow({
            scope_type: 'team',
            scope_id: 42,
            scope_name: 'Team Alpha',
          }),
        ],
      });

      const result = await service.getBlackouts(1);

      expect(result[0]?.scopeType).toBe('team');
      expect(result[0]?.scopeId).toBe(42);
      expect(result[0]?.scopeName).toBe('Team Alpha');
    });

    it('should filter by year when provided', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getBlackouts(1, 2026);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('start_date <= $2'),
        [1, '2026-12-31', '2026-01-01'],
      );
    });
  });

  // -----------------------------------------------------------
  // createBlackout
  // -----------------------------------------------------------

  describe('createBlackout()', () => {
    it('should create a global blackout', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow()],
      });

      const result = await service.createBlackout(1, 10, {
        name: 'Summer Freeze',
        startDate: '2026-07-15',
        endDate: '2026-07-31',
        scopeType: 'global',
      });

      expect(result.name).toBe('Summer Freeze');
      expect(result.scopeType).toBe('global');
      expect(mockClient.query).toHaveBeenCalledOnce();
    });

    it('should validate scope_id for team-scoped blackout', async () => {
      // 1. validateScopeId → team found
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
      // 2. INSERT
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createMockBlackoutRow({
            scope_type: 'team',
            scope_id: 42,
            scope_name: 'Team Alpha',
          }),
        ],
      });

      const result = await service.createBlackout(1, 10, {
        name: 'Team Freeze',
        startDate: '2026-07-15',
        endDate: '2026-07-31',
        scopeType: 'team',
        scopeId: 42,
      });

      expect(result.scopeType).toBe('team');
      expect(result.scopeId).toBe(42);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException for invalid team scope_id', async () => {
      // validateScopeId → not found
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createBlackout(1, 10, {
          name: 'Bad Team',
          startDate: '2026-07-15',
          endDate: '2026-07-31',
          scopeType: 'team',
          scopeId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid department scope_id', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createBlackout(1, 10, {
          name: 'Bad Dept',
          startDate: '2026-07-15',
          endDate: '2026-07-31',
          scopeType: 'department',
          scopeId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // updateBlackout
  // -----------------------------------------------------------

  describe('updateBlackout()', () => {
    it('should update and return updated blackout', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow({ name: 'Updated Name' })],
      });

      const result = await service.updateBlackout(1, 'bo-001', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when blackout not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateBlackout(1, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return existing blackout when no fields to update', async () => {
      // Empty DTO → getBlackoutById
      mockClient.query.mockResolvedValueOnce({
        rows: [createMockBlackoutRow()],
      });

      const result = await service.updateBlackout(1, 'bo-001', {});

      expect(result.name).toBe('Summer Freeze');
    });
  });

  // -----------------------------------------------------------
  // deleteBlackout
  // -----------------------------------------------------------

  describe('deleteBlackout()', () => {
    it('should soft-delete successfully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'bo-001' }],
      });

      await expect(
        service.deleteBlackout(1, 'bo-001'),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when blackout not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteBlackout(1, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------
  // getConflicts — scope polymorphism
  // -----------------------------------------------------------

  describe('getConflicts()', () => {
    it('should return global conflicts', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'bo-001',
            name: 'Summer Freeze',
            start_date: '2026-07-15',
            end_date: '2026-07-31',
            scope_type: 'global',
          },
        ],
      });

      const result = await service.getConflicts(1, '2026-07-20', '2026-07-25');

      expect(result).toHaveLength(1);
      expect(result[0]?.blackoutId).toBe('bo-001');
      expect(result[0]?.name).toBe('Summer Freeze');
      expect(result[0]?.scopeType).toBe('global');
    });

    it('should return team-scoped conflicts with matching teamId', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'bo-002',
            name: 'Team Freeze',
            start_date: '2026-08-01',
            end_date: '2026-08-15',
            scope_type: 'team',
          },
        ],
      });

      const result = await service.getConflicts(
        1,
        '2026-08-01',
        '2026-08-10',
        42,
        undefined,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.scopeType).toBe('team');
    });

    it('should return empty when no conflicts', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getConflicts(1, '2026-01-01', '2026-01-05');

      expect(result).toHaveLength(0);
    });

    it('should pass both teamId and deptId to query', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getConflicts(1, '2026-07-20', '2026-07-25', 42, 7);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('scope_type'),
        [1, '2026-07-20', '2026-07-25', 42, 7],
      );
    });

    it('should pass null for undefined teamId/deptId', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.getConflicts(1, '2026-07-20', '2026-07-25');

      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [
        1,
        '2026-07-20',
        '2026-07-25',
        null,
        null,
      ]);
    });
  });
});
