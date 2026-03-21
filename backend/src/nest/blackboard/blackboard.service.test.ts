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

    it('getEntryById delegates to entries service', async () => {
      const expected = { id: 1, title: 'Test' };
      mockEntries.getEntryById.mockResolvedValueOnce(expected);

      const result = await service.getEntryById(1, 1, 5);

      expect(mockEntries.getEntryById).toHaveBeenCalledWith(1, 1, 5);
      expect(result).toBe(expected);
    });

    it('getEntryFull delegates to all sub-services', async () => {
      const entry = { id: 42, title: 'Full Entry' };
      const comments = { comments: [], total: 0, hasMore: false };
      const attachments = [{ id: 1, name: 'file.pdf' }];
      mockEntries.getEntryById.mockResolvedValueOnce(entry);
      mockComments.getComments.mockResolvedValueOnce(comments);
      mockAttachments.getAttachments.mockResolvedValueOnce(attachments);

      const result = await service.getEntryFull(1, 1, 5);

      expect(mockEntries.getEntryById).toHaveBeenCalledWith(1, 1, 5);
      expect(mockComments.getComments).toHaveBeenCalledWith(42, 1);
      expect(mockAttachments.getAttachments).toHaveBeenCalledWith(42, 1, 5);
      expect(result).toEqual({ entry, comments, attachments });
    });

    it('createEntry delegates to entries service', async () => {
      const expected = { id: 1, title: 'Test' };
      mockEntries.createEntry.mockResolvedValueOnce(expected);

      const result = await service.createEntry({} as never, 1, 5);

      expect(mockEntries.createEntry).toHaveBeenCalledWith({} as never, 1, 5);
      expect(result).toBe(expected);
    });

    it('updateEntry delegates to entries service', async () => {
      const expected = { id: 1, title: 'Updated' };
      mockEntries.updateEntry.mockResolvedValueOnce(expected);

      const result = await service.updateEntry(1, {} as never, 1, 5);

      expect(mockEntries.updateEntry).toHaveBeenCalledWith(1, {} as never, 1, 5);
      expect(result).toBe(expected);
    });

    it('deleteEntry delegates to entries service', async () => {
      mockEntries.deleteEntry.mockResolvedValueOnce({ message: 'Deleted' });

      const result = await service.deleteEntry(1, 1, 5, 'admin');

      expect(mockEntries.deleteEntry).toHaveBeenCalledWith(1, 1, 5, 'admin');
      expect(result.message).toBe('Deleted');
    });

    it('archiveEntry delegates to entries service', async () => {
      const expected = { id: 1, isActive: 3 };
      mockEntries.archiveEntry.mockResolvedValueOnce(expected);

      const result = await service.archiveEntry(1, 1, 5);

      expect(mockEntries.archiveEntry).toHaveBeenCalledWith(1, 1, 5);
      expect(result).toBe(expected);
    });

    it('unarchiveEntry delegates to entries service', async () => {
      const expected = { id: 1, isActive: 1 };
      mockEntries.unarchiveEntry.mockResolvedValueOnce(expected);

      const result = await service.unarchiveEntry(1, 1, 5);

      expect(mockEntries.unarchiveEntry).toHaveBeenCalledWith(1, 1, 5);
      expect(result).toBe(expected);
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

    it('unconfirmEntry delegates to confirmations service', async () => {
      mockConfirmations.unconfirmEntry.mockResolvedValueOnce({ message: 'OK' });

      const result = await service.unconfirmEntry(1, 5);

      expect(mockConfirmations.unconfirmEntry).toHaveBeenCalledWith(1, 5);
      expect(result.message).toBe('OK');
    });

    it('getConfirmationStatus delegates to confirmations service', async () => {
      const expected = [{ userId: 1, confirmed: true }];
      mockConfirmations.getConfirmationStatus.mockResolvedValueOnce(expected);

      const result = await service.getConfirmationStatus(1, 1);

      expect(mockConfirmations.getConfirmationStatus).toHaveBeenCalledWith(1, 1);
      expect(result).toBe(expected);
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
      const paginated = { comments: [], total: 0, hasMore: false };
      mockComments.getComments.mockResolvedValueOnce(paginated);

      const result = await service.getComments(1, 1);

      expect(mockComments.getComments).toHaveBeenCalledWith(1, 1, undefined, undefined);
      expect(result).toEqual(paginated);
    });

    it('getReplies delegates to comments service', async () => {
      const mockReplies = { getReplies: vi.fn() };
      Object.assign(mockComments, mockReplies);
      mockReplies.getReplies.mockResolvedValueOnce([{ id: 1, comment: 'Reply' }]);

      const result = await service.getReplies(1, 1);

      expect(mockReplies.getReplies).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual([{ id: 1, comment: 'Reply' }]);
    });

    it('addComment delegates to comments service', async () => {
      mockComments.addComment.mockResolvedValueOnce({ id: 1, message: 'Added' });

      const result = await service.addComment(1, 5, 1, 'Test comment', false, 2);

      expect(mockComments.addComment).toHaveBeenCalledWith(1, 5, 1, 'Test comment', false, 2);
      expect(result).toEqual({ id: 1, message: 'Added' });
    });

    it('deleteComment delegates to comments service', async () => {
      mockComments.deleteComment.mockResolvedValueOnce({ message: 'Deleted' });

      const result = await service.deleteComment(1, 1);

      expect(mockComments.deleteComment).toHaveBeenCalledWith(1, 1);
      expect(result.message).toBe('Deleted');
    });
  });

  describe('attachment operations', () => {
    it('uploadAttachment resolves entry then delegates to attachments service', async () => {
      const entry = { id: 42, title: 'Entry' };
      const expected = { id: 1, fileName: 'file.pdf' };
      mockEntries.getEntryById.mockResolvedValueOnce(entry);
      mockAttachments.uploadAttachment.mockResolvedValueOnce(expected);

      const file = { originalname: 'file.pdf' } as never;
      const result = await service.uploadAttachment(1, file, 1, 5);

      expect(mockEntries.getEntryById).toHaveBeenCalledWith(1, 1, 5);
      expect(mockAttachments.uploadAttachment).toHaveBeenCalledWith(42, file, 1, 5);
      expect(result).toBe(expected);
    });

    it('getAttachments resolves entry then delegates to attachments service', async () => {
      const entry = { id: 42, title: 'Entry' };
      const expected = [{ id: 1, name: 'file.pdf' }];
      mockEntries.getEntryById.mockResolvedValueOnce(entry);
      mockAttachments.getAttachments.mockResolvedValueOnce(expected);

      const result = await service.getAttachments(1, 1, 5);

      expect(mockEntries.getEntryById).toHaveBeenCalledWith(1, 1, 5);
      expect(mockAttachments.getAttachments).toHaveBeenCalledWith(42, 1, 5);
      expect(result).toBe(expected);
    });

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

    it('previewAttachment delegates to attachments service', async () => {
      const expected = {
        content: Buffer.from('preview'),
        originalName: 'file.pdf',
        mimeType: 'application/pdf',
        fileSize: 7,
      };
      mockAttachments.previewAttachment.mockResolvedValueOnce(expected);

      const result = await service.previewAttachment(1, 5, 1);

      expect(mockAttachments.previewAttachment).toHaveBeenCalledWith(1, 5, 1);
      expect(result).toBe(expected);
    });

    it('downloadByFileUuid delegates to attachments service', async () => {
      const expected = {
        content: Buffer.from('data'),
        originalName: 'file.pdf',
        mimeType: 'application/pdf',
        fileSize: 4,
      };
      mockAttachments.downloadByFileUuid.mockResolvedValueOnce(expected);

      const result = await service.downloadByFileUuid('some-uuid', 5, 1);

      expect(mockAttachments.downloadByFileUuid).toHaveBeenCalledWith('some-uuid', 5, 1);
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
