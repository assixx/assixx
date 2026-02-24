/**
 * KVP Lifecycle Service – Unit Tests
 *
 * Mocked dependencies: DatabaseService (db.query), ActivityLoggerService,
 * kvp.helpers (isUuid).
 *
 * Tests: share/unshare (junction table management), archive/unarchive
 * (state transitions + activity logging), NotFoundException paths.
 *
 * Note: db.query() returns arrays directly (DatabaseService wrapper extracts rows).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import { KvpLifecycleService } from './kvp-lifecycle.service.js';

// =============================================================
// Module Mocks
// =============================================================

const mockIsUuid = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock('./kvp.helpers.js', () => ({
  isUuid: mockIsUuid,
}));

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function createShareDto(
  overrides?: Partial<ShareSuggestionDto>,
): ShareSuggestionDto {
  return {
    orgLevel: 'team',
    orgId: 5,
    ...overrides,
  } as ShareSuggestionDto;
}

// =============================================================
// Test Suite
// =============================================================

describe('KvpLifecycleService', () => {
  let service: KvpLifecycleService;
  let mockDb: MockDb;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    mockIsUuid.mockReturnValue(false);

    service = new KvpLifecycleService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // -----------------------------------------------------------
  // shareSuggestion
  // -----------------------------------------------------------

  describe('shareSuggestion()', () => {
    it('should share at team level and insert junction table entry', async () => {
      // Q1: UPDATE RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // Q2: INSERT junction table
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.shareSuggestion(
        42,
        createShareDto({ orgLevel: 'team', orgId: 5 }),
        1,
        100,
      );

      expect(result.message).toBe('Suggestion shared successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('kvp_suggestion_organizations'),
        [42, 'team', 5, 1],
      );
    });

    it('should insert junction table entry for machine org level', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.shareSuggestion(
        42,
        createShareDto({ orgLevel: 'machine', orgId: 10 }),
        1,
        100,
      );

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('ON CONFLICT'),
        [42, 'machine', 10, 1],
      );
    });

    it('should skip junction table for company org level', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await service.shareSuggestion(
        42,
        createShareDto({ orgLevel: 'company' as any, orgId: 1 }),
        1,
        100,
      );

      // Only UPDATE, no junction INSERT
      expect(mockDb.query).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.shareSuggestion(42, createShareDto(), 1, 100),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use uuid column when id is UUID', async () => {
      mockIsUuid.mockReturnValueOnce(true);
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.shareSuggestion(
        'abc-uuid-123',
        createShareDto(),
        1,
        100,
      );

      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('uuid'),
        expect.arrayContaining(['abc-uuid-123']),
      );
    });
  });

  // -----------------------------------------------------------
  // unshareSuggestion
  // -----------------------------------------------------------

  describe('unshareSuggestion()', () => {
    it('should unshare and reset to team level', async () => {
      // Q1: SELECT current share info
      mockDb.query.mockResolvedValueOnce([
        { id: 42, org_level: 'team', org_id: 5 },
      ]);
      // Q2: DELETE junction table
      mockDb.query.mockResolvedValueOnce([]);
      // Q3: UPDATE reset
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unshareSuggestion(42, 1, 99);

      expect(result.message).toBe('Suggestion unshared successfully');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
      // Verify DELETE from junction
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM kvp_suggestion_organizations'),
        [42, 'team', 5],
      );
      // Verify reset UPDATE
      expect(mockDb.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("org_level = 'team'"),
        [99, 42, 1],
      );
    });

    it('should skip junction table delete for non-team/machine org level', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 42, org_level: 'company', org_id: 1 },
      ]);
      // No DELETE, just UPDATE reset
      mockDb.query.mockResolvedValueOnce([]);

      await service.unshareSuggestion(42, 1, 99);

      // Only SELECT + UPDATE, no DELETE
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.unshareSuggestion(42, 1, 99),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete junction for machine org level', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 42, org_level: 'machine', org_id: 10 },
      ]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.unshareSuggestion(42, 1, 99);

      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE'),
        [42, 'machine', 10],
      );
    });
  });

  // -----------------------------------------------------------
  // archiveSuggestion
  // -----------------------------------------------------------

  describe('archiveSuggestion()', () => {
    it('should archive suggestion and log activity', async () => {
      // Q1: findSuggestionOrThrow SELECT
      mockDb.query.mockResolvedValueOnce([
        { id: 42, title: 'Mein Vorschlag', status: 'open' },
      ]);
      // Q2: UPDATE status='archived'
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.archiveSuggestion(42, 1, 100);

      expect(result.message).toBe('Suggestion archived successfully');
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("status = 'archived'"),
        [42, 1],
      );
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        100,
        'kvp',
        42,
        expect.stringContaining('archiviert'),
        { status: 'open' },
        { status: 'archived' },
      );
    });

    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.archiveSuggestion(42, 1, 100),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use uuid column when id is UUID', async () => {
      mockIsUuid.mockReturnValueOnce(true);
      mockDb.query.mockResolvedValueOnce([
        { id: 42, title: 'Test', status: 'open' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.archiveSuggestion('abc-uuid', 1, 100);

      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('uuid'),
        ['abc-uuid', 1],
      );
    });
  });

  // -----------------------------------------------------------
  // unarchiveSuggestion
  // -----------------------------------------------------------

  describe('unarchiveSuggestion()', () => {
    it('should restore suggestion and log activity', async () => {
      // Q1: findSuggestionOrThrow SELECT
      mockDb.query.mockResolvedValueOnce([
        { id: 42, title: 'Mein Vorschlag', status: 'archived' },
      ]);
      // Q2: UPDATE status='restored'
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unarchiveSuggestion(42, 1, 100);

      expect(result.message).toBe('Suggestion restored successfully');
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("status = 'restored'"),
        [42, 1],
      );
      expect(mockActivityLogger.logUpdate).toHaveBeenCalledWith(
        1,
        100,
        'kvp',
        42,
        expect.stringContaining('wiederhergestellt'),
        { status: 'archived' },
        { status: 'restored' },
      );
    });

    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.unarchiveSuggestion(42, 1, 100),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
