/**
 * Blackboard Service (Facade) – Unit Tests
 *
 * Tests that the facade correctly delegates to sub-services.
 * This is a pure delegation layer — no own business logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BlackboardAttachmentsService } from './blackboard-attachments.service.js';
import type { BlackboardCommentsService } from './blackboard-comments.service.js';
import type { BlackboardConfirmationsService } from './blackboard-confirmations.service.js';
import type { BlackboardEntriesService } from './blackboard-entries.service.js';
import { BlackboardService } from './blackboard.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: BlackboardService;
  mockEntries: Record<string, ReturnType<typeof vi.fn>>;
  mockComments: Record<string, ReturnType<typeof vi.fn>>;
  mockConfirmations: Record<string, ReturnType<typeof vi.fn>>;
  mockAttachments: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockEntries = {
    listEntries: vi.fn(),
    getEntryById: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    archiveEntry: vi.fn(),
    unarchiveEntry: vi.fn(),
    getDashboardEntries: vi.fn(),
  };
  const mockComments = {
    getComments: vi.fn(),
    addComment: vi.fn(),
    deleteComment: vi.fn(),
  };
  const mockConfirmations = {
    confirmEntry: vi.fn(),
    unconfirmEntry: vi.fn(),
    getConfirmationStatus: vi.fn(),
    getUnconfirmedCount: vi.fn(),
  };
  const mockAttachments = {
    getAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
    previewAttachment: vi.fn(),
    downloadByFileUuid: vi.fn(),
    deleteAttachment: vi.fn(),
  };

  const service = new BlackboardService(
    mockEntries as unknown as BlackboardEntriesService,
    mockComments as unknown as BlackboardCommentsService,
    mockConfirmations as unknown as BlackboardConfirmationsService,
    mockAttachments as unknown as BlackboardAttachmentsService,
  );

  return {
    service,
    mockEntries,
    mockComments,
    mockConfirmations,
    mockAttachments,
  };
}

// ============================================================
// Delegation Tests
// ============================================================

describe('BlackboardService – delegation', () => {
  let service: BlackboardService;
  let mockEntries: Record<string, ReturnType<typeof vi.fn>>;
  let mockComments: Record<string, ReturnType<typeof vi.fn>>;
  let mockConfirmations: Record<string, ReturnType<typeof vi.fn>>;
  let mockAttachments: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockEntries = result.mockEntries;
    mockComments = result.mockComments;
    mockConfirmations = result.mockConfirmations;
    mockAttachments = result.mockAttachments;
  });

  describe('entry operations', () => {
    it('listEntries delegates to entries service', async () => {
      const expected = { entries: [], pagination: {} };
      mockEntries.listEntries.mockResolvedValueOnce(expected);

      const result = await service.listEntries(1, 5, {} as never);

      expect(mockEntries.listEntries).toHaveBeenCalledWith(1, 5, {} as never);
      expect(result).toBe(expected);
    });

    it('createEntry delegates to entries service', async () => {
      const expected = { id: 1, title: 'Test' };
      mockEntries.createEntry.mockResolvedValueOnce(expected);

      const result = await service.createEntry({} as never, 1, 5);

      expect(mockEntries.createEntry).toHaveBeenCalledWith({} as never, 1, 5);
      expect(result).toBe(expected);
    });

    it('deleteEntry delegates to entries service', async () => {
      mockEntries.deleteEntry.mockResolvedValueOnce({ message: 'Deleted' });

      const result = await service.deleteEntry(1, 1, 5, 'admin');

      expect(mockEntries.deleteEntry).toHaveBeenCalledWith(1, 1, 5, 'admin');
      expect(result.message).toBe('Deleted');
    });

    it('getDashboardEntries delegates to entries service', async () => {
      mockEntries.getDashboardEntries.mockResolvedValueOnce([]);

      const result = await service.getDashboardEntries(1, 5, 3);

      expect(mockEntries.getDashboardEntries).toHaveBeenCalledWith(1, 5, 3);
      expect(result).toEqual([]);
    });
  });

  describe('confirmation operations', () => {
    it('confirmEntry delegates to confirmations service', async () => {
      mockConfirmations.confirmEntry.mockResolvedValueOnce({ message: 'OK' });

      const result = await service.confirmEntry(1, 5);

      expect(mockConfirmations.confirmEntry).toHaveBeenCalledWith(1, 5);
      expect(result.message).toBe('OK');
    });

    it('getUnconfirmedCount delegates to confirmations service', async () => {
      mockConfirmations.getUnconfirmedCount.mockResolvedValueOnce({ count: 3 });

      const result = await service.getUnconfirmedCount(5, 1);

      expect(mockConfirmations.getUnconfirmedCount).toHaveBeenCalledWith(5, 1);
      expect(result.count).toBe(3);
    });
  });

  describe('comment operations', () => {
    it('getComments delegates to comments service', async () => {
      mockComments.getComments.mockResolvedValueOnce([]);

      const result = await service.getComments(1, 1);

      expect(mockComments.getComments).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual([]);
    });

    it('deleteComment delegates to comments service', async () => {
      mockComments.deleteComment.mockResolvedValueOnce({ message: 'Deleted' });

      const result = await service.deleteComment(1, 1);

      expect(mockComments.deleteComment).toHaveBeenCalledWith(1, 1);
      expect(result.message).toBe('Deleted');
    });
  });

  describe('attachment operations', () => {
    it('downloadAttachment delegates to attachments service', async () => {
      const expected = {
        content: Buffer.from('test'),
        originalName: 'file.pdf',
        mimeType: 'application/pdf',
        fileSize: 4,
      };
      mockAttachments.downloadAttachment.mockResolvedValueOnce(expected);

      const result = await service.downloadAttachment(1, 5, 1);

      expect(mockAttachments.downloadAttachment).toHaveBeenCalledWith(1, 5, 1);
      expect(result).toBe(expected);
    });

    it('deleteAttachment delegates to attachments service', async () => {
      mockAttachments.deleteAttachment.mockResolvedValueOnce({
        message: 'Deleted',
      });

      const result = await service.deleteAttachment(1, 5, 1);

      expect(mockAttachments.deleteAttachment).toHaveBeenCalledWith(1, 5, 1);
      expect(result.message).toBe('Deleted');
    });
  });
});
