import { describe, expect, it } from 'vitest';

import { AttachmentIdParamSchema } from './attachment-id-param.dto.js';
import { AddCommentSchema } from './comment.dto.js';
import { CreateEntrySchema } from './create-entry.dto.js';
import { DashboardQuerySchema } from './dashboard-query.dto.js';
import { FileUuidParamSchema } from './file-uuid-param.dto.js';
import { ListEntriesQuerySchema } from './list-entries-query.dto.js';
import { UpdateEntrySchema } from './update-entry.dto.js';

// =============================================================
// CreateEntrySchema
// =============================================================

describe('CreateEntrySchema', () => {
  const valid = { title: 'Important Notice', content: 'Please read this.' };

  it('should accept valid entry', () => {
    expect(CreateEntrySchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing title', () => {
    expect(
      CreateEntrySchema.safeParse({ content: 'Some content' }).success,
    ).toBe(false);
  });

  it('should reject title longer than 200 characters', () => {
    expect(
      CreateEntrySchema.safeParse({ ...valid, title: 'T'.repeat(201) })
        .success,
    ).toBe(false);
  });

  it('should reject content longer than 5000 characters', () => {
    expect(
      CreateEntrySchema.safeParse({ ...valid, content: 'C'.repeat(5001) })
        .success,
    ).toBe(false);
  });

  it.each(['company', 'department', 'team', 'area'] as const)(
    'should accept orgLevel=%s',
    (orgLevel) => {
      expect(
        CreateEntrySchema.safeParse({ ...valid, orgLevel }).success,
      ).toBe(true);
    },
  );

  it.each(['low', 'medium', 'high', 'urgent'] as const)(
    'should accept priority=%s',
    (priority) => {
      expect(
        CreateEntrySchema.safeParse({ ...valid, priority }).success,
      ).toBe(true);
    },
  );

  it('should reject invalid priority', () => {
    expect(
      CreateEntrySchema.safeParse({ ...valid, priority: 'critical' }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateEntrySchema
// =============================================================

describe('UpdateEntrySchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateEntrySchema.safeParse({}).success).toBe(true);
  });

  it.each([0, 1, 3, 4] as const)(
    'should accept isActive=%d',
    (isActive) => {
      expect(UpdateEntrySchema.safeParse({ isActive }).success).toBe(true);
    },
  );

  it('should reject isActive=2 (not in allowed set)', () => {
    expect(UpdateEntrySchema.safeParse({ isActive: 2 }).success).toBe(false);
  });

  it('should reject isActive=5 (not in allowed set)', () => {
    expect(UpdateEntrySchema.safeParse({ isActive: 5 }).success).toBe(false);
  });
});

// =============================================================
// ListEntriesQuerySchema
// =============================================================

describe('ListEntriesQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListEntriesQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce isActive from string and validate allowed values', () => {
    const result = ListEntriesQuerySchema.safeParse({ isActive: '1' });

    expect(result.success).toBe(true);
  });

  it('should reject isActive=2 (not in allowed set)', () => {
    expect(
      ListEntriesQuerySchema.safeParse({ isActive: '2' }).success,
    ).toBe(false);
  });

  it('should reject search longer than 100 characters', () => {
    expect(
      ListEntriesQuerySchema.safeParse({ search: 'X'.repeat(101) }).success,
    ).toBe(false);
  });

  it.each(['ASC', 'DESC'] as const)(
    'should accept sortDir=%s',
    (sortDir) => {
      expect(
        ListEntriesQuerySchema.safeParse({ sortDir }).success,
      ).toBe(true);
    },
  );

  it('should reject invalid sortDir', () => {
    expect(
      ListEntriesQuerySchema.safeParse({ sortDir: 'asc' }).success,
    ).toBe(false);
  });
});

// =============================================================
// AddCommentSchema
// =============================================================

describe('AddCommentSchema (Blackboard)', () => {
  it('should accept valid comment', () => {
    const data = AddCommentSchema.parse({ comment: 'Great post!' });

    expect(data.isInternal).toBe(false);
  });

  it('should reject empty comment', () => {
    expect(AddCommentSchema.safeParse({ comment: '' }).success).toBe(false);
  });

  it('should reject comment longer than 5000 characters', () => {
    expect(
      AddCommentSchema.safeParse({ comment: 'C'.repeat(5001) }).success,
    ).toBe(false);
  });
});

// =============================================================
// DashboardQuerySchema
// =============================================================

describe('DashboardQuerySchema', () => {
  it('should accept empty query', () => {
    expect(DashboardQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce limit from string', () => {
    const data = DashboardQuerySchema.parse({ limit: '5' });

    expect(data.limit).toBe(5);
  });

  it('should reject limit > 10', () => {
    expect(
      DashboardQuerySchema.safeParse({ limit: '11' }).success,
    ).toBe(false);
  });
});

// =============================================================
// FileUuidParamSchema / AttachmentIdParamSchema
// =============================================================

describe('FileUuidParamSchema', () => {
  it('should accept valid UUID', () => {
    expect(
      FileUuidParamSchema.safeParse({
        fileUuid: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(
      FileUuidParamSchema.safeParse({ fileUuid: 'not-a-uuid' }).success,
    ).toBe(false);
  });
});

describe('AttachmentIdParamSchema', () => {
  it('should coerce attachmentId from string', () => {
    const data = AttachmentIdParamSchema.parse({ attachmentId: '7' });

    expect(data.attachmentId).toBe(7);
  });

  it('should reject non-positive attachmentId', () => {
    expect(
      AttachmentIdParamSchema.safeParse({ attachmentId: '0' }).success,
    ).toBe(false);
  });
});
