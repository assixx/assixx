/**
 * KVP Lifecycle Service – Unit Tests
 *
 * Mocked dependencies: DatabaseService (db.query), ActivityLoggerService,
 * kvp.helpers (isUuid).
 *
 * Tests: share/unshare (org-level visibility changes), archive/unarchive
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
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function createShareDto(overrides?: Partial<ShareSuggestionDto>): ShareSuggestionDto {
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
    it('should share at specified org level via UPDATE', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service.shareSuggestion(
        42,
        createShareDto({ orgLevel: 'team', orgId: 5 }),
        1,
        100,
      );

      expect(result.message).toBe('Suggestion shared successfully');
      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('UPDATE kvp_suggestions'),
        ['team', 5, 100, 42, 1],
      );
    });

    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.shareSuggestion(42, createShareDto(), 1, 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use uuid column when id is UUID', async () => {
      mockIsUuid.mockReturnValueOnce(true);
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await service.shareSuggestion('abc-uuid-123', createShareDto(), 1, 100);

      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('uuid'),
        expect.arrayContaining(['abc-uuid-123']),
      );
    });
  });

  // -----------------------------------------------------------
  // unshareSuggestion
  // -----------------------------------------------------------

  describe('unshareSuggestion()', () => {
    it('should unshare and reset to team level with single UPDATE', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service.unshareSuggestion(42, 1);

      expect(result.message).toBe('Suggestion unshared successfully');
      expect(mockDb.query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining("org_level = 'team'"),
        [42, 1],
      );
    });

    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.unshareSuggestion(42, 1)).rejects.toThrow(NotFoundException);
    });

    it('should use org_id = team_id in the UPDATE query', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      await service.unshareSuggestion(42, 1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('org_id = team_id'),
        [42, 1],
      );
    });
  });

  // -----------------------------------------------------------
  // archiveSuggestion
  // -----------------------------------------------------------

  describe('archiveSuggestion()', () => {
    it('should archive suggestion and log activity', async () => {
      // Q1: findSuggestionOrThrow SELECT
      mockDb.query.mockResolvedValueOnce([{ id: 42, title: 'Mein Vorschlag', status: 'open' }]);
      // Q2: UPDATE status='archived' (tenantQuery)
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.archiveSuggestion(42, 1, 100);

      expect(result.message).toBe('Suggestion archived successfully');
      expect(mockDb.tenantQuery).toHaveBeenCalledWith(
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

      await expect(service.archiveSuggestion(42, 1, 100)).rejects.toThrow(NotFoundException);
    });

    it('should use uuid column when id is UUID', async () => {
      mockIsUuid.mockReturnValueOnce(true);
      mockDb.query.mockResolvedValueOnce([{ id: 42, title: 'Test', status: 'open' }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.archiveSuggestion('abc-uuid', 1, 100);

      expect(mockDb.query).toHaveBeenNthCalledWith(1, expect.stringContaining('uuid'), [
        'abc-uuid',
        1,
      ]);
    });
  });

  // -----------------------------------------------------------
  // unarchiveSuggestion
  // -----------------------------------------------------------

  describe('unarchiveSuggestion()', () => {
    it('should restore suggestion and log activity', async () => {
      // Q1: findSuggestionOrThrow SELECT
      mockDb.query.mockResolvedValueOnce([{ id: 42, title: 'Mein Vorschlag', status: 'archived' }]);
      // Q2: UPDATE status='restored' (tenantQuery)
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.unarchiveSuggestion(42, 1, 100);

      expect(result.message).toBe('Suggestion restored successfully');
      expect(mockDb.tenantQuery).toHaveBeenCalledWith(
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

      await expect(service.unarchiveSuggestion(42, 1, 100)).rejects.toThrow(NotFoundException);
    });
  });
});
