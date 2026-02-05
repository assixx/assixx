import { describe, expect, it } from 'vitest';

import { ListDocumentsQueryDto } from './query-documents.dto.js';
import { UpdateDocumentDto } from './update-document.dto.js';

/**
 * Documents DTOs use unexported schemas.
 * Access via static .schema property from nestjs-zod createZodDto.
 */
const updateSchema = UpdateDocumentDto.schema;
const listSchema = ListDocumentsQueryDto.schema;

// =============================================================
// updateDocumentSchema (via UpdateDocumentDto.schema)
// =============================================================

describe('UpdateDocumentDto schema', () => {
  it('should accept empty object (all optional)', () => {
    expect(updateSchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid partial update', () => {
    expect(
      updateSchema.safeParse({
        filename: 'report.pdf',
        category: 'payroll',
        isPublic: false,
      }).success,
    ).toBe(true);
  });

  it('should accept tags array', () => {
    expect(updateSchema.safeParse({ tags: ['important', 'hr'] }).success).toBe(
      true,
    );
  });

  it('should reject tags array with more than 20 items', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);

    expect(updateSchema.safeParse({ tags }).success).toBe(false);
  });

  it('should reject tag longer than 50 characters', () => {
    expect(updateSchema.safeParse({ tags: ['X'.repeat(51)] }).success).toBe(
      false,
    );
  });

  it('should reject filename longer than 255 characters', () => {
    expect(updateSchema.safeParse({ filename: 'F'.repeat(256) }).success).toBe(
      false,
    );
  });
});

// =============================================================
// listDocumentsQuerySchema (via ListDocumentsQueryDto.schema)
// =============================================================

describe('ListDocumentsQueryDto schema', () => {
  it('should accept empty query with defaults', () => {
    const data = listSchema.parse({});

    expect(data.isActive).toBe(1);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
  });

  it.each([
    'personal',
    'team',
    'department',
    'company',
    'payroll',
    'blackboard',
    'chat',
  ] as const)('should accept accessScope=%s', (accessScope) => {
    expect(listSchema.safeParse({ accessScope }).success).toBe(true);
  });

  it('should reject invalid accessScope', () => {
    expect(listSchema.safeParse({ accessScope: 'private' }).success).toBe(
      false,
    );
  });

  it('should coerce ownerUserId from string', () => {
    const data = listSchema.parse({ ownerUserId: '5' });

    expect(data.ownerUserId).toBe(5);
  });

  it('should reject salaryYear out of range', () => {
    expect(listSchema.safeParse({ salaryYear: '1999' }).success).toBe(false);
  });

  it('should reject salaryMonth out of range', () => {
    expect(listSchema.safeParse({ salaryMonth: '13' }).success).toBe(false);
  });

  it('should reject search longer than 200 characters', () => {
    expect(listSchema.safeParse({ search: 'X'.repeat(201) }).success).toBe(
      false,
    );
  });

  it('should reject limit > 100', () => {
    expect(listSchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});
