/**
 * Unit tests for Documents Helpers
 *
 * Phase 6: Pure function tests — 1 test per function.
 * DB helpers (getDocumentRow, insertDocumentRecord, getDocumentsCount) skipped — tested via integration.
 */
import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import {
  buildDocumentFilters,
  buildDocumentUpdateClause,
  enrichDocument,
  parseTags,
  validateDocumentInput,
} from './documents.helpers.js';
import type { DbDocument, DocumentCreateInput } from './documents.service.js';

describe('documents.helpers', () => {
  it('parseTags should handle array, JSON string, null, and invalid input', () => {
    expect(parseTags(['tag1', 'tag2'])).toEqual(['tag1', 'tag2']);
    expect(parseTags('["a","b"]')).toEqual(['a', 'b']);
    expect(parseTags(null)).toEqual([]);
    expect(parseTags('not-json')).toEqual([]);
  });

  it('enrichDocument should map DB document to API response with download URL', () => {
    const doc: DbDocument = {
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
    };

    const result = enrichDocument(doc, true);

    expect(result.downloadUrl).toBe('/api/v2/documents/1/download');
    expect(result.storedFilename).toBe('abc-uuid-123.pdf');
    expect(result.isRead).toBe(true);
    expect(result.uploaderName).toBe('Admin User');
  });

  it('buildDocumentFilters should pass through query params with isActive', () => {
    const result = buildDocumentFilters(
      { category: 'contract', search: 'test' } as Parameters<typeof buildDocumentFilters>[0],
      1,
    );

    expect(result.isActive).toBe(1);
    expect(result.category).toBe('contract');
    expect(result.search).toBe('test');
  });

  it('buildDocumentUpdateClause should build SET clause from DTO fields', () => {
    const result = buildDocumentUpdateClause({
      filename: 'new-name.pdf',
      tags: ['tag1', 'tag2'],
    });

    expect(result.updates).toContain('filename = $1');
    expect(result.updates).toContain('tags = $2');
    expect(result.params[0]).toBe('new-name.pdf');
    expect(result.params[1]).toBe('["tag1","tag2"]');
  });

  it('validateDocumentInput should throw on invalid category', () => {
    const input = {
      category: 'INVALID',
      mimeType: 'application/pdf',
    } as DocumentCreateInput;

    expect(() => validateDocumentInput(input)).toThrow(BadRequestException);
  });
});
