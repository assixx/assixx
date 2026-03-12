import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { OrganigramLayoutService } from './organigram-layout.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('00000000-0000-7000-8000-000000000001'),
}));

// =============================================================
// Helpers
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function createPositionRow(overrides?: Record<string, unknown>) {
  return {
    uuid: 'a0000000-0000-0000-0000-000000000001',
    entity_type: 'area' as const,
    entity_uuid: '11111111-1111-1111-1111-111111111111',
    position_x: '100.50',
    position_y: '200.75',
    width: '300.00',
    height: '150.00',
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('OrganigramLayoutService', () => {
  let service: OrganigramLayoutService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new OrganigramLayoutService(mockDb as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================
  // getPositions
  // =============================================================

  describe('getPositions', () => {
    it('should return empty array when no positions exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getPositions(1);

      expect(result).toEqual([]);
    });

    it('should return mapped positions with correct types', async () => {
      mockDb.query.mockResolvedValueOnce([createPositionRow()]);

      const result = await service.getPositions(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        uuid: 'a0000000-0000-0000-0000-000000000001',
        entityType: 'area',
        entityUuid: '11111111-1111-1111-1111-111111111111',
        positionX: 100.5,
        positionY: 200.75,
        width: 300,
        height: 150,
      });
    });

    it('should trim CHAR(36) padded UUIDs', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPositionRow({
          uuid: 'short-uuid                          ',
          entity_uuid: 'entity-uuid                         ',
        }),
      ]);

      const result = await service.getPositions(1);

      expect(result[0]?.uuid).toBe('short-uuid');
      expect(result[0]?.entityUuid).toBe('entity-uuid');
    });

    it('should convert numeric strings to numbers', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPositionRow({
          position_x: '0.00',
          position_y: '0.00',
          width: '200.00',
          height: '80.00',
        }),
      ]);

      const result = await service.getPositions(1);

      expect(result[0]?.positionX).toBe(0);
      expect(result[0]?.positionY).toBe(0);
      expect(result[0]?.width).toBe(200);
      expect(result[0]?.height).toBe(80);
    });

    it('should filter by tenant_id and is_active = 1', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getPositions(42);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('tenant_id = $1');
      expect(sql).toContain('is_active = 1');
      expect(mockDb.query.mock.calls[0]?.[1]).toEqual([42]);
    });

    it('should return multiple positions', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPositionRow({ entity_type: 'area' }),
        createPositionRow({
          uuid: 'b0000000-0000-0000-0000-000000000002',
          entity_type: 'department',
          entity_uuid: '22222222-2222-2222-2222-222222222222',
        }),
      ]);

      const result = await service.getPositions(1);

      expect(result).toHaveLength(2);
      expect(result[0]?.entityType).toBe('area');
      expect(result[1]?.entityType).toBe('department');
    });
  });

  // =============================================================
  // upsertPositions
  // =============================================================

  describe('upsertPositions', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) =>
          fn(mockClient),
      );
    });

    it('should upsert a single position via transaction', async () => {
      await service.upsertPositions(1, {
        positions: [
          {
            entityType: 'area',
            entityUuid: '11111111-1111-1111-1111-111111111111',
            positionX: 100,
            positionY: 200,
            width: 300,
            height: 150,
          },
        ],
      });

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
      expect(mockClient.query).toHaveBeenCalledOnce();
    });

    it('should upsert batch positions in a single transaction', async () => {
      await service.upsertPositions(1, {
        positions: [
          {
            entityType: 'area',
            entityUuid: '11111111-1111-1111-1111-111111111111',
            positionX: 0,
            positionY: 0,
            width: 200,
            height: 80,
          },
          {
            entityType: 'department',
            entityUuid: '22222222-2222-2222-2222-222222222222',
            positionX: 100,
            positionY: 100,
            width: 200,
            height: 80,
          },
          {
            entityType: 'team',
            entityUuid: '33333333-3333-3333-3333-333333333333',
            positionX: 200,
            positionY: 200,
            width: 200,
            height: 80,
          },
        ],
      });

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should use INSERT ... ON CONFLICT DO UPDATE SQL', async () => {
      await service.upsertPositions(1, {
        positions: [
          {
            entityType: 'area',
            entityUuid: '11111111-1111-1111-1111-111111111111',
            positionX: 0,
            positionY: 0,
            width: 200,
            height: 80,
          },
        ],
      });

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('INSERT INTO org_chart_positions');
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
    });

    it('should pass correct parameters in order', async () => {
      await service.upsertPositions(42, {
        positions: [
          {
            entityType: 'department',
            entityUuid: 'd0000000-0000-0000-0000-000000000001',
            positionX: 10,
            positionY: 20,
            width: 300,
            height: 100,
          },
        ],
      });

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      // $1 = uuid (generated), $2 = tenantId, $3-$8 = dto fields
      expect(params?.[0]).toBe('00000000-0000-7000-8000-000000000001');
      expect(params?.[1]).toBe(42);
      expect(params?.[2]).toBe('department');
      expect(params?.[3]).toBe('d0000000-0000-0000-0000-000000000001');
      expect(params?.[4]).toBe(10);
      expect(params?.[5]).toBe(20);
      expect(params?.[6]).toBe(300);
      expect(params?.[7]).toBe(100);
    });
  });

  // =============================================================
  // deletePosition
  // =============================================================

  describe('deletePosition', () => {
    let mockClient: { query: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = { query: vi.fn() };
      mockDb.tenantTransaction.mockImplementation(
        async (fn: (client: typeof mockClient) => Promise<void>) =>
          fn(mockClient),
      );
    });

    it('should soft-delete by setting is_active = 4', async () => {
      await service.deletePosition(1, 'area', 'some-uuid');

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE org_chart_positions');
      expect(sql).toContain('is_active = 4');
    });

    it('should filter by tenant_id, entity_type, and entity_uuid', async () => {
      await service.deletePosition(42, 'department', 'dept-uuid');

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([42, 'department', 'dept-uuid']);
    });

    it('should use tenantTransaction', async () => {
      await service.deletePosition(1, 'team', 'team-uuid');

      expect(mockDb.tenantTransaction).toHaveBeenCalledOnce();
    });
  });
});
