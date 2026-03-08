/**
 * DTO validation tests for Work Orders schemas
 *
 * Tests: WorkOrderStatusSchema, WorkOrderPrioritySchema, WorkOrderSourceTypeSchema,
 *        UuidParamSchema, PageSchema, LimitSchema, CreateWorkOrderSchema,
 *        UpdateWorkOrderSchema, UpdateStatusSchema, AssignUsersSchema,
 *        CreateCommentSchema, ListWorkOrdersQuerySchema
 * Pattern: ADR-018 Phase 8 — Zod .safeParse() assertions.
 */
import { describe, expect, it } from 'vitest';

import { AssignUsersSchema } from './assign-users.dto.js';
import {
  LimitSchema,
  PageSchema,
  UuidParamSchema,
  WorkOrderPrioritySchema,
  WorkOrderSourceTypeSchema,
  WorkOrderStatusSchema,
} from './common.dto.js';
import { CreateCommentSchema } from './create-comment.dto.js';
import { CreateWorkOrderSchema } from './create-work-order.dto.js';
import { ListWorkOrdersQuerySchema } from './list-work-orders-query.dto.js';
import { UpdateStatusSchema } from './update-status.dto.js';
import { UpdateWorkOrderSchema } from './update-work-order.dto.js';

const VALID_UUID = '019c9547-9fc0-771a-b022-3767e233d6f3';
const VALID_UUID_2 = '019c9547-9fc0-771a-b022-3767e233d6f4';

// =============================================================
// WorkOrderStatusSchema (Enum)
// =============================================================

describe('WorkOrderStatusSchema', () => {
  it.each(['open', 'in_progress', 'completed', 'verified'] as const)(
    'should accept status=%s',
    (value) => {
      expect(WorkOrderStatusSchema.safeParse(value).success).toBe(true);
    },
  );

  it('should reject invalid status', () => {
    expect(WorkOrderStatusSchema.safeParse('pending').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(WorkOrderStatusSchema.safeParse('').success).toBe(false);
  });

  it('should reject number', () => {
    expect(WorkOrderStatusSchema.safeParse(1).success).toBe(false);
  });

  it('should reject null', () => {
    expect(WorkOrderStatusSchema.safeParse(null).success).toBe(false);
  });

  it('should reject uppercase variant', () => {
    expect(WorkOrderStatusSchema.safeParse('Open').success).toBe(false);
  });
});

// =============================================================
// WorkOrderPrioritySchema (Enum)
// =============================================================

describe('WorkOrderPrioritySchema', () => {
  it.each(['low', 'medium', 'high'] as const)(
    'should accept priority=%s',
    (value) => {
      expect(WorkOrderPrioritySchema.safeParse(value).success).toBe(true);
    },
  );

  it('should reject invalid priority', () => {
    expect(WorkOrderPrioritySchema.safeParse('critical').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(WorkOrderPrioritySchema.safeParse('').success).toBe(false);
  });

  it('should reject number', () => {
    expect(WorkOrderPrioritySchema.safeParse(2).success).toBe(false);
  });

  it('should reject null', () => {
    expect(WorkOrderPrioritySchema.safeParse(null).success).toBe(false);
  });
});

// =============================================================
// WorkOrderSourceTypeSchema (Enum)
// =============================================================

describe('WorkOrderSourceTypeSchema', () => {
  it.each(['tpm_defect', 'kvp_proposal', 'manual'] as const)(
    'should accept sourceType=%s',
    (value) => {
      expect(WorkOrderSourceTypeSchema.safeParse(value).success).toBe(true);
    },
  );

  it('should reject invalid source type', () => {
    expect(WorkOrderSourceTypeSchema.safeParse('kvp').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(WorkOrderSourceTypeSchema.safeParse('').success).toBe(false);
  });

  it('should reject null', () => {
    expect(WorkOrderSourceTypeSchema.safeParse(null).success).toBe(false);
  });
});

// =============================================================
// UuidParamSchema
// =============================================================

describe('UuidParamSchema', () => {
  it('should accept valid UUID', () => {
    expect(UuidParamSchema.safeParse({ uuid: VALID_UUID }).success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(UuidParamSchema.safeParse({ uuid: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('should reject missing uuid field', () => {
    expect(UuidParamSchema.safeParse({}).success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(UuidParamSchema.safeParse({ uuid: '' }).success).toBe(false);
  });
});

// =============================================================
// PageSchema (coerced number)
// =============================================================

describe('PageSchema', () => {
  it('should default to 1 when undefined', () => {
    expect(PageSchema.parse(undefined)).toBe(1);
  });

  it('should accept positive integer', () => {
    expect(PageSchema.parse(5)).toBe(5);
  });

  it('should coerce string to number', () => {
    expect(PageSchema.parse('3')).toBe(3);
  });

  it('should reject zero', () => {
    expect(PageSchema.safeParse(0).success).toBe(false);
  });

  it('should reject negative number', () => {
    expect(PageSchema.safeParse(-1).success).toBe(false);
  });

  it('should reject non-integer', () => {
    expect(PageSchema.safeParse(1.5).success).toBe(false);
  });
});

// =============================================================
// LimitSchema (coerced number)
// =============================================================

describe('LimitSchema', () => {
  it('should default to 20 when undefined', () => {
    expect(LimitSchema.parse(undefined)).toBe(20);
  });

  it('should accept 1 (minimum)', () => {
    expect(LimitSchema.parse(1)).toBe(1);
  });

  it('should accept 500 (maximum)', () => {
    expect(LimitSchema.parse(500)).toBe(500);
  });

  it('should coerce string to number', () => {
    expect(LimitSchema.parse('50')).toBe(50);
  });

  it('should reject zero', () => {
    expect(LimitSchema.safeParse(0).success).toBe(false);
  });

  it('should reject 501 (over max)', () => {
    expect(LimitSchema.safeParse(501).success).toBe(false);
  });

  it('should reject negative number', () => {
    expect(LimitSchema.safeParse(-5).success).toBe(false);
  });

  it('should reject non-integer', () => {
    expect(LimitSchema.safeParse(10.5).success).toBe(false);
  });
});

// =============================================================
// CreateWorkOrderSchema
// =============================================================

describe('CreateWorkOrderSchema', () => {
  const validManual = {
    title: 'Leckage in Halle 3 beheben',
    description: 'Wasserleitung tropft seit gestern',
    priority: 'high' as const,
    sourceType: 'manual' as const,
    dueDate: '2026-03-10',
  };

  const validTpmDefect = {
    title: 'TPM Mangel: Ölstand zu niedrig',
    sourceType: 'tpm_defect' as const,
    sourceUuid: VALID_UUID,
  };

  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept valid manual work order', () => {
    expect(CreateWorkOrderSchema.safeParse(validManual).success).toBe(true);
  });

  it('should accept valid TPM defect work order', () => {
    expect(CreateWorkOrderSchema.safeParse(validTpmDefect).success).toBe(true);
  });

  it('should accept minimal payload (title only)', () => {
    const result = CreateWorkOrderSchema.parse({ title: 'Reparatur' });
    expect(result.title).toBe('Reparatur');
    expect(result.priority).toBe('medium');
    expect(result.sourceType).toBe('manual');
    expect(result.assigneeUuids).toEqual([]);
  });

  // -----------------------------------------------------------
  // title validation
  // -----------------------------------------------------------

  it('should reject empty title', () => {
    expect(
      CreateWorkOrderSchema.safeParse({ ...validManual, title: '' }).success,
    ).toBe(false);
  });

  it('should reject whitespace-only title', () => {
    expect(
      CreateWorkOrderSchema.safeParse({ ...validManual, title: '   ' }).success,
    ).toBe(false);
  });

  it('should reject title longer than 500 chars', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        ...validManual,
        title: 'A'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('should accept title with exactly 500 chars', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        ...validManual,
        title: 'A'.repeat(500),
      }).success,
    ).toBe(true);
  });

  it('should trim whitespace from title', () => {
    const result = CreateWorkOrderSchema.parse({
      ...validManual,
      title: '  Reparatur  ',
    });
    expect(result.title).toBe('Reparatur');
  });

  // -----------------------------------------------------------
  // description validation
  // -----------------------------------------------------------

  it('should accept null description', () => {
    const result = CreateWorkOrderSchema.parse({
      ...validManual,
      description: null,
    });
    expect(result.description).toBeNull();
  });

  it('should accept undefined description', () => {
    const result = CreateWorkOrderSchema.parse({
      title: 'Test',
    });
    expect(result.description).toBeUndefined();
  });

  it('should reject description longer than 5000 chars', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        ...validManual,
        description: 'A'.repeat(5001),
      }).success,
    ).toBe(false);
  });

  it('should trim whitespace from description', () => {
    const result = CreateWorkOrderSchema.parse({
      ...validManual,
      description: '  Text  ',
    });
    expect(result.description).toBe('Text');
  });

  // -----------------------------------------------------------
  // priority defaults
  // -----------------------------------------------------------

  it('should default priority to medium', () => {
    const result = CreateWorkOrderSchema.parse({ title: 'Test' });
    expect(result.priority).toBe('medium');
  });

  it.each(['low', 'medium', 'high'] as const)(
    'should accept priority=%s',
    (priority) => {
      expect(
        CreateWorkOrderSchema.safeParse({ ...validManual, priority }).success,
      ).toBe(true);
    },
  );

  // -----------------------------------------------------------
  // sourceType + sourceUuid refinements
  // -----------------------------------------------------------

  it('should reject tpm_defect without sourceUuid', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        title: 'Test',
        sourceType: 'tpm_defect',
      }).success,
    ).toBe(false);
  });

  it('should reject manual with sourceUuid', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        title: 'Test',
        sourceType: 'manual',
        sourceUuid: VALID_UUID,
      }).success,
    ).toBe(false);
  });

  it('should accept tpm_defect with sourceUuid', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        title: 'Test',
        sourceType: 'tpm_defect',
        sourceUuid: VALID_UUID,
      }).success,
    ).toBe(true);
  });

  it('should accept manual without sourceUuid', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        title: 'Test',
        sourceType: 'manual',
      }).success,
    ).toBe(true);
  });

  it('should accept kvp_proposal with sourceUuid', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        title: 'KVP: Verbesserung Linie 4',
        sourceType: 'kvp_proposal',
        sourceUuid: VALID_UUID,
      }).success,
    ).toBe(true);
  });

  it('should reject kvp_proposal without sourceUuid', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        title: 'KVP: Verbesserung Linie 4',
        sourceType: 'kvp_proposal',
      }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // assigneeUuids validation
  // -----------------------------------------------------------

  it('should default assigneeUuids to empty array', () => {
    const result = CreateWorkOrderSchema.parse({ title: 'Test' });
    expect(result.assigneeUuids).toEqual([]);
  });

  it('should accept array with valid UUIDs', () => {
    const result = CreateWorkOrderSchema.parse({
      ...validManual,
      assigneeUuids: [VALID_UUID, VALID_UUID_2],
    });
    expect(result.assigneeUuids).toHaveLength(2);
  });

  it('should reject more than 10 assignees', () => {
    const uuids = Array.from({ length: 11 }, (_, i: number) =>
      VALID_UUID.replace(/f3$/, i.toString().padStart(2, '0')),
    );
    expect(
      CreateWorkOrderSchema.safeParse({
        ...validManual,
        assigneeUuids: uuids,
      }).success,
    ).toBe(false);
  });

  it('should reject invalid UUID in array', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        ...validManual,
        assigneeUuids: ['not-a-uuid'],
      }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // dueDate validation
  // -----------------------------------------------------------

  it('should accept valid ISO date', () => {
    const result = CreateWorkOrderSchema.parse({
      ...validManual,
      dueDate: '2026-12-31',
    });
    expect(result.dueDate).toBe('2026-12-31');
  });

  it('should accept null dueDate', () => {
    const result = CreateWorkOrderSchema.parse({
      ...validManual,
      dueDate: null,
    });
    expect(result.dueDate).toBeNull();
  });

  it('should accept undefined dueDate', () => {
    const result = CreateWorkOrderSchema.parse({ title: 'Test' });
    expect(result.dueDate).toBeUndefined();
  });

  it('should reject invalid date format', () => {
    expect(
      CreateWorkOrderSchema.safeParse({
        ...validManual,
        dueDate: '31.12.2026',
      }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // Missing required fields
  // -----------------------------------------------------------

  it('should reject missing title', () => {
    expect(CreateWorkOrderSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// UpdateWorkOrderSchema
// =============================================================

describe('UpdateWorkOrderSchema', () => {
  // -----------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------

  it('should accept empty object (all fields optional)', () => {
    expect(UpdateWorkOrderSchema.safeParse({}).success).toBe(true);
  });

  it('should accept full update', () => {
    const result = UpdateWorkOrderSchema.parse({
      title: 'Neuer Titel',
      description: 'Neue Beschreibung',
      priority: 'high',
      dueDate: '2026-06-15',
    });
    expect(result.title).toBe('Neuer Titel');
    expect(result.priority).toBe('high');
  });

  // -----------------------------------------------------------
  // title validation
  // -----------------------------------------------------------

  it('should reject empty title', () => {
    expect(UpdateWorkOrderSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('should reject whitespace-only title', () => {
    expect(UpdateWorkOrderSchema.safeParse({ title: '   ' }).success).toBe(
      false,
    );
  });

  it('should reject title longer than 500 chars', () => {
    expect(
      UpdateWorkOrderSchema.safeParse({ title: 'A'.repeat(501) }).success,
    ).toBe(false);
  });

  it('should trim whitespace from title', () => {
    const result = UpdateWorkOrderSchema.parse({ title: '  Trimmed  ' });
    expect(result.title).toBe('Trimmed');
  });

  // -----------------------------------------------------------
  // description validation
  // -----------------------------------------------------------

  it('should accept null description (clear)', () => {
    const result = UpdateWorkOrderSchema.parse({ description: null });
    expect(result.description).toBeNull();
  });

  it('should reject description longer than 5000 chars', () => {
    expect(
      UpdateWorkOrderSchema.safeParse({ description: 'A'.repeat(5001) })
        .success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // priority validation
  // -----------------------------------------------------------

  it.each(['low', 'medium', 'high'] as const)(
    'should accept priority=%s',
    (priority) => {
      expect(UpdateWorkOrderSchema.safeParse({ priority }).success).toBe(true);
    },
  );

  it('should reject invalid priority', () => {
    expect(
      UpdateWorkOrderSchema.safeParse({ priority: 'urgent' }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // dueDate validation
  // -----------------------------------------------------------

  it('should accept null dueDate (clear)', () => {
    const result = UpdateWorkOrderSchema.parse({ dueDate: null });
    expect(result.dueDate).toBeNull();
  });

  it('should reject invalid date format', () => {
    expect(
      UpdateWorkOrderSchema.safeParse({ dueDate: '2026/03/10' }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateStatusSchema
// =============================================================

describe('UpdateStatusSchema', () => {
  it.each(['open', 'in_progress', 'completed', 'verified'] as const)(
    'should accept status=%s',
    (status) => {
      expect(UpdateStatusSchema.safeParse({ status }).success).toBe(true);
    },
  );

  it('should reject invalid status', () => {
    expect(UpdateStatusSchema.safeParse({ status: 'cancelled' }).success).toBe(
      false,
    );
  });

  it('should reject missing status', () => {
    expect(UpdateStatusSchema.safeParse({}).success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(UpdateStatusSchema.safeParse({ status: '' }).success).toBe(false);
  });
});

// =============================================================
// AssignUsersSchema
// =============================================================

describe('AssignUsersSchema', () => {
  it('should accept single UUID', () => {
    const result = AssignUsersSchema.parse({ userUuids: [VALID_UUID] });
    expect(result.userUuids).toHaveLength(1);
  });

  it('should accept multiple UUIDs', () => {
    const result = AssignUsersSchema.parse({
      userUuids: [VALID_UUID, VALID_UUID_2],
    });
    expect(result.userUuids).toHaveLength(2);
  });

  it('should accept exactly 10 UUIDs (maximum)', () => {
    const uuids = Array.from({ length: 10 }, (_, i: number) =>
      VALID_UUID.replace(/f3$/, i.toString().padStart(2, '0')),
    );
    expect(AssignUsersSchema.safeParse({ userUuids: uuids }).success).toBe(
      true,
    );
  });

  it('should reject empty array', () => {
    expect(AssignUsersSchema.safeParse({ userUuids: [] }).success).toBe(false);
  });

  it('should reject more than 10 UUIDs', () => {
    const uuids = Array.from({ length: 11 }, (_, i: number) =>
      VALID_UUID.replace(/f3$/, i.toString().padStart(2, '0')),
    );
    expect(AssignUsersSchema.safeParse({ userUuids: uuids }).success).toBe(
      false,
    );
  });

  it('should reject invalid UUID in array', () => {
    expect(
      AssignUsersSchema.safeParse({ userUuids: ['not-a-uuid'] }).success,
    ).toBe(false);
  });

  it('should reject missing userUuids', () => {
    expect(AssignUsersSchema.safeParse({}).success).toBe(false);
  });

  it('should reject non-array value', () => {
    expect(AssignUsersSchema.safeParse({ userUuids: VALID_UUID }).success).toBe(
      false,
    );
  });
});

// =============================================================
// CreateCommentSchema
// =============================================================

describe('CreateCommentSchema', () => {
  it('should accept valid comment', () => {
    const result = CreateCommentSchema.parse({
      content: 'Reparatur gestartet',
    });
    expect(result.content).toBe('Reparatur gestartet');
  });

  it('should reject empty content', () => {
    expect(CreateCommentSchema.safeParse({ content: '' }).success).toBe(false);
  });

  it('should reject whitespace-only content', () => {
    expect(CreateCommentSchema.safeParse({ content: '   ' }).success).toBe(
      false,
    );
  });

  it('should reject content longer than 5000 chars', () => {
    expect(
      CreateCommentSchema.safeParse({ content: 'A'.repeat(5001) }).success,
    ).toBe(false);
  });

  it('should accept content with exactly 5000 chars', () => {
    expect(
      CreateCommentSchema.safeParse({ content: 'A'.repeat(5000) }).success,
    ).toBe(true);
  });

  it('should trim whitespace from content', () => {
    const result = CreateCommentSchema.parse({ content: '  Trimmed  ' });
    expect(result.content).toBe('Trimmed');
  });

  it('should reject missing content', () => {
    expect(CreateCommentSchema.safeParse({}).success).toBe(false);
  });

  // -----------------------------------------------------------
  // parentId (optional reply threading)
  // -----------------------------------------------------------

  it('should accept comment without parentId', () => {
    const result = CreateCommentSchema.parse({ content: 'Top-level' });
    expect(result.parentId).toBeUndefined();
  });

  it('should accept valid parentId', () => {
    const result = CreateCommentSchema.parse({
      content: 'Antwort',
      parentId: 42,
    });
    expect(result.parentId).toBe(42);
  });

  it('should coerce parentId from string', () => {
    const result = CreateCommentSchema.parse({
      content: 'Antwort',
      parentId: '42',
    });
    expect(result.parentId).toBe(42);
  });

  it('should reject parentId = 0', () => {
    expect(
      CreateCommentSchema.safeParse({ content: 'Test', parentId: 0 }).success,
    ).toBe(false);
  });

  it('should reject negative parentId', () => {
    expect(
      CreateCommentSchema.safeParse({ content: 'Test', parentId: -1 }).success,
    ).toBe(false);
  });

  it('should reject non-integer parentId', () => {
    expect(
      CreateCommentSchema.safeParse({ content: 'Test', parentId: 1.5 }).success,
    ).toBe(false);
  });
});

// =============================================================
// ListWorkOrdersQuerySchema
// =============================================================

describe('ListWorkOrdersQuerySchema', () => {
  // -----------------------------------------------------------
  // Happy path (all optional)
  // -----------------------------------------------------------

  it('should accept empty query (all defaults)', () => {
    const result = ListWorkOrdersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.status).toBeUndefined();
    expect(result.priority).toBeUndefined();
    expect(result.sourceType).toBeUndefined();
    expect(result.sourceUuid).toBeUndefined();
    expect(result.assigneeUuid).toBeUndefined();
  });

  it('should accept sourceUuid filter', () => {
    const result = ListWorkOrdersQuerySchema.parse({
      sourceUuid: VALID_UUID,
    });
    expect(result.sourceUuid).toBe(VALID_UUID);
  });

  it('should reject invalid sourceUuid', () => {
    expect(
      ListWorkOrdersQuerySchema.safeParse({ sourceUuid: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('should accept full query with all filters', () => {
    const result = ListWorkOrdersQuerySchema.parse({
      status: 'open',
      priority: 'high',
      sourceType: 'tpm_defect',
      assigneeUuid: VALID_UUID,
      page: '2',
      limit: '50',
    });
    expect(result.status).toBe('open');
    expect(result.priority).toBe('high');
    expect(result.sourceType).toBe('tpm_defect');
    expect(result.assigneeUuid).toBe(VALID_UUID);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  // -----------------------------------------------------------
  // status filter
  // -----------------------------------------------------------

  it.each(['open', 'in_progress', 'completed', 'verified'] as const)(
    'should accept status=%s',
    (status) => {
      expect(ListWorkOrdersQuerySchema.safeParse({ status }).success).toBe(
        true,
      );
    },
  );

  it('should reject invalid status filter', () => {
    expect(
      ListWorkOrdersQuerySchema.safeParse({ status: 'cancelled' }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // priority filter
  // -----------------------------------------------------------

  it.each(['low', 'medium', 'high'] as const)(
    'should accept priority=%s',
    (priority) => {
      expect(ListWorkOrdersQuerySchema.safeParse({ priority }).success).toBe(
        true,
      );
    },
  );

  it('should reject invalid priority filter', () => {
    expect(
      ListWorkOrdersQuerySchema.safeParse({ priority: 'critical' }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // sourceType filter
  // -----------------------------------------------------------

  it.each(['tpm_defect', 'kvp_proposal', 'manual'] as const)(
    'should accept sourceType=%s',
    (sourceType) => {
      expect(ListWorkOrdersQuerySchema.safeParse({ sourceType }).success).toBe(
        true,
      );
    },
  );

  it('should reject invalid sourceType filter', () => {
    expect(
      ListWorkOrdersQuerySchema.safeParse({ sourceType: 'kvp' }).success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // assigneeUuid filter
  // -----------------------------------------------------------

  it('should accept valid assigneeUuid', () => {
    expect(
      ListWorkOrdersQuerySchema.safeParse({ assigneeUuid: VALID_UUID }).success,
    ).toBe(true);
  });

  it('should reject invalid assigneeUuid', () => {
    expect(
      ListWorkOrdersQuerySchema.safeParse({ assigneeUuid: 'not-a-uuid' })
        .success,
    ).toBe(false);
  });

  // -----------------------------------------------------------
  // pagination coercion
  // -----------------------------------------------------------

  it('should coerce page from string', () => {
    const result = ListWorkOrdersQuerySchema.parse({ page: '5' });
    expect(result.page).toBe(5);
  });

  it('should coerce limit from string', () => {
    const result = ListWorkOrdersQuerySchema.parse({ limit: '100' });
    expect(result.limit).toBe(100);
  });

  it('should reject page=0', () => {
    expect(ListWorkOrdersQuerySchema.safeParse({ page: '0' }).success).toBe(
      false,
    );
  });

  it('should reject limit=501', () => {
    expect(ListWorkOrdersQuerySchema.safeParse({ limit: '501' }).success).toBe(
      false,
    );
  });
});
