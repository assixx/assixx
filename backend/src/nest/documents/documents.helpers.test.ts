/**
 * Unit tests for Documents Helpers
 *
 * Phase 6: Pure function tests — 1 test per function.
 * Phase 13 Batch D: Deepened — edge cases, DB helpers, all branches.
 */
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  buildDocumentFilters,
  buildDocumentUpdateClause,
  enrichDocument,
  getDocumentRow,
  getDocumentsCount,
  insertDocumentRecord,
  parseTags,
  validateDocumentInput,
} from './documents.helpers.js';
import type { DbDocument, DocumentCreateInput } from './documents.service.js';

// ============================================
// Mock Factory
// ============================================

function createMockDbDocument(overrides?: Partial<DbDocument>): DbDocument {
  return {
    id: 1,
    tenant_id: 10,
    filename: 'report.pdf',
    original_name: 'quarterly-report.pdf',
    file_size: 5000,
    mime_type: 'application/pdf',
    category: 'general',
    access_scope: 'company',
    owner_user_id: null,
    target_team_id: null,
    target_department_id: null,
    description: 'Q1 Report',
    salary_year: null,
    salary_month: null,
    blackboard_entry_id: null,
    conversation_id: null,
    tags: null,
    is_active: 1,
    created_by: 5,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
    file_uuid: 'abc-uuid-123',
    file_checksum: null,
    file_path: null,
    file_content: null,
    storage_type: 'filesystem',
    download_count: 42,
    uploaded_by_name: 'Admin User',
    ...overrides,
  };
}

// ============================================
// parseTags
// ============================================

describe('parseTags', () => {
  it('should handle array, JSON string, null, and invalid input', () => {
    expect(parseTags(['tag1', 'tag2'])).toEqual(['tag1', 'tag2']);
    expect(parseTags('["a","b"]')).toEqual(['a', 'b']);
    expect(parseTags(null)).toEqual([]);
    expect(parseTags('not-json')).toEqual([]);
  });

  it('should return empty for undefined', () => {
    expect(parseTags(undefined)).toEqual([]);
  });

  it('should filter non-string elements from array', () => {
    expect(parseTags(['valid', 42, null, 'also-valid'])).toEqual([
      'valid',
      'also-valid',
    ]);
  });

  it('should return empty for non-array JSON parse result', () => {
    expect(parseTags('{"key":"value"}')).toEqual([]);
  });

  it('should return empty for empty array', () => {
    expect(parseTags([])).toEqual([]);
  });

  it('should return empty for non-array non-string input', () => {
    expect(parseTags(42)).toEqual([]);
    expect(parseTags(true)).toEqual([]);
  });
});

// ============================================
// enrichDocument
// ============================================

describe('enrichDocument', () => {
  it('should map DB document to API response with download URL', () => {
    const doc = createMockDbDocument();
    const result = enrichDocument(doc, true);

    expect(result.downloadUrl).toBe('/api/v2/documents/1/download');
    expect(result.previewUrl).toBe('/api/v2/documents/1/preview');
    expect(result.storedFilename).toBe('abc-uuid-123.pdf');
    expect(result.isRead).toBe(true);
    expect(result.uploaderName).toBe('Admin User');
  });

  it('should fall back storedFilename to filename when file_uuid is null', () => {
    const doc = createMockDbDocument({ file_uuid: null });
    const result = enrichDocument(doc, false);

    expect(result.storedFilename).toBe('report.pdf');
    expect(result.isRead).toBe(false);
  });

  it('should fall back storedFilename to filename when file_uuid is empty', () => {
    const doc = createMockDbDocument({ file_uuid: '' });
    const result = enrichDocument(doc, false);

    expect(result.storedFilename).toBe('report.pdf');
  });

  it('should default uploaderName to Unknown when uploaded_by_name is null', () => {
    const doc = createMockDbDocument({ uploaded_by_name: null });
    const result = enrichDocument(doc, true);

    expect(result.uploaderName).toBe('Unknown');
  });

  it('should handle empty original_name (no extension)', () => {
    const doc = createMockDbDocument({ original_name: '' });
    const result = enrichDocument(doc, true);

    expect(result.storedFilename).toBe('abc-uuid-123');
  });
});

// ============================================
// buildDocumentFilters
// ============================================

describe('buildDocumentFilters', () => {
  it('should pass through query params with isActive', () => {
    const result = buildDocumentFilters(
      { category: 'contract', search: 'test' } as Parameters<
        typeof buildDocumentFilters
      >[0],
      1,
    );

    expect(result.isActive).toBe(1);
    expect(result.category).toBe('contract');
    expect(result.search).toBe('test');
  });

  it('should handle empty query (all undefined)', () => {
    const result = buildDocumentFilters(
      {} as Parameters<typeof buildDocumentFilters>[0],
      0,
    );

    expect(result.isActive).toBe(0);
    expect(result.category).toBeUndefined();
    expect(result.search).toBeUndefined();
  });
});

// ============================================
// buildDocumentUpdateClause
// ============================================

describe('buildDocumentUpdateClause', () => {
  it('should build SET clause from DTO fields', () => {
    const result = buildDocumentUpdateClause({
      filename: 'new-name.pdf',
      tags: ['tag1', 'tag2'],
    });

    expect(result.updates).toContain('filename = $1');
    expect(result.updates).toContain('tags = $2');
    expect(result.params[0]).toBe('new-name.pdf');
    expect(result.params[1]).toBe('["tag1","tag2"]');
  });

  it('should include only updated_at when DTO is empty', () => {
    const result = buildDocumentUpdateClause({});

    expect(result.updates).toEqual(['updated_at = NOW()']);
    expect(result.params).toHaveLength(0);
    expect(result.paramIndex).toBe(1);
  });

  it('should handle all 4 fields', () => {
    const result = buildDocumentUpdateClause({
      filename: 'a.pdf',
      category: 'contract',
      description: 'Updated',
      tags: ['x'],
    });

    expect(result.updates).toHaveLength(5); // updated_at + 4
    expect(result.paramIndex).toBe(5);
    expect(result.params).toHaveLength(4);
  });

  it('should handle category-only update', () => {
    const result = buildDocumentUpdateClause({ category: 'payroll' });

    expect(result.updates).toContain('category = $1');
    expect(result.params).toEqual(['payroll']);
  });

  it('should handle description-only update', () => {
    const result = buildDocumentUpdateClause({ description: 'New desc' });

    expect(result.updates).toContain('description = $1');
    expect(result.params).toEqual(['New desc']);
  });
});

// ============================================
// validateDocumentInput
// ============================================

describe('validateDocumentInput', () => {
  it('should throw on invalid category', () => {
    const input = {
      category: 'INVALID',
      mimeType: 'application/pdf',
    } as DocumentCreateInput;

    expect(() => validateDocumentInput(input)).toThrow(BadRequestException);
  });

  it('should throw on invalid mime type', () => {
    const input = {
      category: 'general',
      mimeType: 'application/zip',
    } as DocumentCreateInput;

    expect(() => validateDocumentInput(input)).toThrow('File type not allowed');
  });

  it('should not throw for valid category and mime type', () => {
    const input = {
      category: 'contract',
      mimeType: 'application/pdf',
    } as DocumentCreateInput;

    expect(() => validateDocumentInput(input)).not.toThrow();
  });

  it('should accept all valid categories', () => {
    const categories = [
      'general',
      'contract',
      'certificate',
      'payroll',
      'training',
      'other',
      'blackboard',
      'chat',
    ];
    for (const category of categories) {
      expect(() =>
        validateDocumentInput({
          category,
          mimeType: 'image/jpeg',
        } as DocumentCreateInput),
      ).not.toThrow();
    }
  });
});

// ============================================
// DB Helpers (mocked DatabaseService)
// ============================================

describe('getDocumentRow', () => {
  it('should return document when found', async () => {
    const mockDoc = createMockDbDocument();
    const mockDb = { query: vi.fn().mockResolvedValue([mockDoc]) };

    const result = await getDocumentRow(mockDb as never, 1, 10);

    expect(result).toBe(mockDoc);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND tenant_id = $2'),
      [1, 10],
    );
  });

  it('should return null when not found', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue([]) };

    const result = await getDocumentRow(mockDb as never, 999, 10);

    expect(result).toBeNull();
  });
});

describe('insertDocumentRecord', () => {
  it('should return inserted document ID', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue([{ id: 42 }]) };
    const data: DocumentCreateInput = {
      fileUuid: 'uuid-7',
      filename: 'test.pdf',
      originalName: 'test.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
      category: 'general',
      accessScope: 'company',
    };

    const result = await insertDocumentRecord(mockDb as never, data, 5, 10);

    expect(result).toBe(42);
    expect(mockDb.query).toHaveBeenCalledOnce();
  });

  it('should throw when insert returns no ID', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue([]) };
    const data = {
      fileUuid: 'uuid-7',
      filename: 'test.pdf',
      originalName: 'test.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
      category: 'general',
      accessScope: 'company',
    } as DocumentCreateInput;

    await expect(
      insertDocumentRecord(mockDb as never, data, 5, 10),
    ).rejects.toThrow('Failed to create document');
  });
});

describe('getDocumentsCount', () => {
  it('should parse count from query result', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue([{ count: '25' }]) };

    const result = await getDocumentsCount(
      mockDb as never,
      'SELECT d.*, u.username as uploaded_by_name FROM documents d',
      [10],
    );

    expect(result).toBe(25);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*) as count'),
      [10],
    );
  });

  it('should return 0 when no rows', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue([]) };

    const result = await getDocumentsCount(
      mockDb as never,
      'SELECT d.*, u.username as uploaded_by_name FROM x',
      [],
    );

    expect(result).toBe(0);
  });
});
