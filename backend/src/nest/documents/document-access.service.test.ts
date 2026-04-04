/**
 * Unit tests for DocumentAccessService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Access control by role + scope, query builder (pure),
 *        filter application, read status check.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { DocumentAccessService } from './document-access.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
}

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    access_scope: 'company',
    owner_user_id: 5,
    conversation_id: null,
    ...overrides,
  };
}

// =============================================================
// DocumentAccessService
// =============================================================

describe('DocumentAccessService', () => {
  let service: DocumentAccessService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new DocumentAccessService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // checkDocumentAccess
  // =============================================================

  describe('checkDocumentAccess', () => {
    it('should return false when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkDocumentAccess(makeDocument() as never, 999, 10);

      expect(result).toBe(false);
    });

    it('should allow admin access to non-chat documents', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);

      const result = await service.checkDocumentAccess(
        makeDocument({ access_scope: 'personal', owner_user_id: 99 }) as never,
        5,
        10,
      );

      expect(result).toBe(true);
    });

    it('should allow root access to non-chat documents', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'root' }]);

      const result = await service.checkDocumentAccess(makeDocument() as never, 1, 10);

      expect(result).toBe(true);
    });

    it('should deny admin access to chat docs they are not participant of', async () => {
      // getUserRole returns admin
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      // isConversationParticipant returns empty (not a participant)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkDocumentAccess(
        makeDocument({
          access_scope: 'chat',
          conversation_id: 42,
        }) as never,
        5,
        10,
      );

      expect(result).toBe(false);
    });

    it('should allow admin access to chat docs they ARE participant of', async () => {
      // getUserRole returns admin
      mockDb.query.mockResolvedValueOnce([{ role: 'admin' }]);
      // isConversationParticipant returns match
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      const result = await service.checkDocumentAccess(
        makeDocument({
          access_scope: 'chat',
          conversation_id: 42,
        }) as never,
        5,
        10,
      );

      expect(result).toBe(true);
    });

    it('should deny root access to chat docs they are not participant of', async () => {
      // getUserRole returns root
      mockDb.query.mockResolvedValueOnce([{ role: 'root' }]);
      // isConversationParticipant returns empty
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkDocumentAccess(
        makeDocument({
          access_scope: 'chat',
          conversation_id: 7,
        }) as never,
        1,
        10,
      );

      expect(result).toBe(false);
    });

    it('should allow employee access to company documents', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      const result = await service.checkDocumentAccess(
        makeDocument({ access_scope: 'company' }) as never,
        5,
        10,
      );

      expect(result).toBe(true);
    });

    it('should allow owner access to personal documents', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      const result = await service.checkDocumentAccess(
        makeDocument({ access_scope: 'personal', owner_user_id: 5 }) as never,
        5,
        10,
      );

      expect(result).toBe(true);
    });

    it('should deny non-owner access to personal documents', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      const result = await service.checkDocumentAccess(
        makeDocument({ access_scope: 'personal', owner_user_id: 99 }) as never,
        5,
        10,
      );

      expect(result).toBe(false);
    });

    it('should check conversation membership for chat documents', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);
      // isConversationParticipant
      mockDb.query.mockResolvedValueOnce([{ user_id: 5 }]);

      const result = await service.checkDocumentAccess(
        makeDocument({
          access_scope: 'chat',
          conversation_id: 1,
        }) as never,
        5,
        10,
      );

      expect(result).toBe(true);
    });

    it('should deny chat access when no conversation_id', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      const result = await service.checkDocumentAccess(
        makeDocument({
          access_scope: 'chat',
          conversation_id: null,
        }) as never,
        5,
        10,
      );

      expect(result).toBe(false);
    });

    it('should return false for unknown scope', async () => {
      mockDb.query.mockResolvedValueOnce([{ role: 'employee' }]);

      const result = await service.checkDocumentAccess(
        makeDocument({ access_scope: 'unknown' }) as never,
        5,
        10,
      );

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // isDocumentRead
  // =============================================================

  describe('isDocumentRead', () => {
    it('should return true when read status exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ read_at: new Date() }]);

      const result = await service.isDocumentRead(1, 5, 10);

      expect(result).toBe(true);
    });

    it('should return false when not read', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.isDocumentRead(1, 5, 10);

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // buildDocumentQuery (pure)
  // =============================================================

  describe('buildDocumentQuery', () => {
    it('should build base query for admin with chat privacy filter', () => {
      const result = service.buildDocumentQuery(10, 1, {}, true, 5);

      expect(result.baseQuery).toContain('WHERE d.tenant_id');
      expect(result.params).toContain(10);
      expect(result.params).toContain(1);
      // Admin queries must include chat privacy filter
      expect(result.baseQuery).toContain('conversation_participants');
      expect(result.baseQuery).toContain("d.access_scope != 'chat'");
      expect(result.params).toContain(5);
    });

    it('should add access scope filter for non-admin', () => {
      const result = service.buildDocumentQuery(10, 1, {}, false, 5);

      expect(result.baseQuery).toContain('access_scope');
      expect(result.baseQuery).toContain('conversation_participants');
      expect(result.params).toContain(5);
    });

    it('should include chat in non-admin access scope filter', () => {
      const result = service.buildDocumentQuery(10, 1, {}, false, 5);

      // Non-admin scope filter must allow 'chat' through — chat privacy check
      // (conversation_participants) already restricts to participants only.
      // Without this, employees see 0 chat attachments in Document Explorer.
      expect(result.baseQuery).toContain("d.access_scope = 'chat'");
    });

    it('should not duplicate chat scope for admin queries', () => {
      const result = service.buildDocumentQuery(10, 1, {}, true, 5);

      // Admin queries skip the scope filter entirely, only chat privacy applies
      expect(result.baseQuery).not.toContain("d.access_scope = 'company'");
      expect(result.baseQuery).toContain("d.access_scope != 'chat'");
    });

    it('should apply category filter', () => {
      const result = service.buildDocumentQuery(10, 1, { category: 'report' }, true, 5);

      expect(result.baseQuery).toContain('d.category');
      expect(result.params).toContain('report');
    });

    it('should apply search filter', () => {
      const result = service.buildDocumentQuery(10, 1, { search: 'invoice' }, true, 5);

      expect(result.baseQuery).toContain('ILIKE');
      expect(result.params).toContain('%invoice%');
    });
  });
});
