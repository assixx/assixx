/**
 * Unit tests for DocumentStorageService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: getDocumentContent (download count), resolveFileContent
 *        (blob vs filesystem), writeFileToDisk/readFileFromDisk
 *        (path traversal protection).
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { DocumentStorageService } from './document-storage.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('file-data')),
  },
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenant_id: 10,
    filename: 'report.pdf',
    original_name: 'My Report.pdf',
    mime_type: 'application/pdf',
    file_size: 1024,
    file_content: null,
    file_path: null,
    ...overrides,
  };
}

// =============================================================
// DocumentStorageService
// =============================================================

describe('DocumentStorageService', () => {
  let service: DocumentStorageService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new DocumentStorageService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getDocumentContent
  // =============================================================

  describe('getDocumentContent', () => {
    it('should increment download count and return content from blob', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const doc = makeDocument({
        file_content: Buffer.from('blob-data'),
      });

      const result = await service.getDocumentContent(doc as never);

      expect(result.originalName).toBe('My Report.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should return content from filesystem', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const doc = makeDocument({ file_path: 'uploads/test.pdf' });

      const result = await service.getDocumentContent(doc as never);

      expect(result.content).toBeDefined();
    });
  });

  // =============================================================
  // resolveFileContent
  // =============================================================

  describe('resolveFileContent', () => {
    it('should return blob content if available', async () => {
      const doc = makeDocument({
        file_content: Buffer.from('blob'),
      });

      const result = await service.resolveFileContent(doc as never);

      expect(result).toEqual(Buffer.from('blob'));
    });

    it('should read from disk if no blob', async () => {
      const doc = makeDocument({ file_path: 'uploads/doc.pdf' });

      const result = await service.resolveFileContent(doc as never);

      expect(result).toBeDefined();
    });

    it('should throw when no content or path', async () => {
      const doc = makeDocument();

      await expect(service.resolveFileContent(doc as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // writeFileToDisk
  // =============================================================

  describe('writeFileToDisk', () => {
    it('should write file with mkdir', async () => {
      await expect(
        service.writeFileToDisk('uploads/test/file.pdf', Buffer.from('data')),
      ).resolves.toBeUndefined();
    });

    it('should reject path traversal', async () => {
      await expect(
        service.writeFileToDisk('../../../etc/passwd', Buffer.from('data')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =============================================================
  // readFileFromDisk
  // =============================================================

  describe('readFileFromDisk', () => {
    it('should read file from valid path', async () => {
      const result = await service.readFileFromDisk('uploads/test.pdf');

      expect(result).toBeDefined();
    });

    it('should reject path traversal', async () => {
      await expect(
        service.readFileFromDisk('../../../etc/shadow'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
