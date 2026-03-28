/**
 * Work Orders Helpers — Unit Tests
 *
 * Tests all pure mapper functions and the status transition matrix.
 * No DI, no DB, no mocks — pure input/output assertions.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { describe, expect, it } from 'vitest';

import { toIsoString, toIsoStringOrNull } from '../../utils/db-helpers.js';
import {
  type SourcePhotoRow,
  isValidStatusTransition,
  mapAssigneeRowToApi,
  mapCalendarWorkOrderRow,
  mapCommentRowToApi,
  mapPhotoRowToApi,
  mapSourcePhotoRowToApi,
  mapWorkOrderRowToApi,
  mapWorkOrderRowToListItem,
} from './work-orders.helpers.js';
import type {
  CalendarWorkOrderRow,
  WorkOrderAssigneeWithNameRow,
  WorkOrderCommentWithNameRow,
  WorkOrderPhotoRow,
  WorkOrderStatus,
  WorkOrderWithCountsRow,
} from './work-orders.types.js';

// ============================================================================
// Factory functions
// ============================================================================

function createWorkOrderRow(
  overrides: Partial<WorkOrderWithCountsRow> = {},
): WorkOrderWithCountsRow {
  return {
    id: 1,
    uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
    tenant_id: 1,
    title: 'Ölwechsel durchführen',
    description: 'Motor-Öl wechseln an Anlage M-001',
    status: 'open',
    priority: 'medium',
    source_type: 'tpm_defect',
    source_uuid: '019c9547-aaaa-771a-b022-111111111111',
    due_date: '2026-03-10',
    created_by: 5,
    completed_at: null,
    verified_at: null,
    verified_by: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: '2026-03-01T08:00:00.000Z',
    updated_at: '2026-03-01T08:00:00.000Z',
    created_by_name: 'Max Müller',
    assignee_count: '2',
    assignee_names: 'Anna Schmidt, Bob Weber',
    comment_count: '3',
    photo_count: '1',
    ...overrides,
  };
}

function createAssigneeRow(
  overrides: Partial<WorkOrderAssigneeWithNameRow> = {},
): WorkOrderAssigneeWithNameRow {
  return {
    id: 10,
    uuid: '019c9547-bbbb-771a-b022-222222222222',
    tenant_id: 1,
    work_order_id: 1,
    user_id: 42,
    assigned_at: '2026-03-01T09:00:00.000Z',
    assigned_by: 5,
    first_name: 'Anna',
    last_name: 'Schmidt',
    profile_picture: null,
    ...overrides,
  };
}

function createCommentRow(
  overrides: Partial<WorkOrderCommentWithNameRow> = {},
): WorkOrderCommentWithNameRow {
  return {
    id: 20,
    uuid: '019c9547-cccc-771a-b022-333333333333',
    tenant_id: 1,
    work_order_id: 1,
    user_id: 42,
    content: 'Arbeit begonnen, Ersatzteile bestellt',
    is_status_change: false,
    old_status: null,
    new_status: null,
    parent_id: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: '2026-03-02T10:00:00.000Z',
    updated_at: '2026-03-02T10:00:00.000Z',
    first_name: 'Anna',
    last_name: 'Schmidt',
    profile_picture: null,
    reply_count: '0',
    ...overrides,
  };
}

function createPhotoRow(overrides: Partial<WorkOrderPhotoRow> = {}): WorkOrderPhotoRow {
  return {
    id: 30,
    uuid: '019c9547-dddd-771a-b022-444444444444',
    tenant_id: 1,
    work_order_id: 1,
    uploaded_by: 42,
    file_path: 'uploads/work-orders/1/uuid/photo.jpg',
    file_name: 'reparatur-foto.jpg',
    file_size: 1_234_567,
    mime_type: 'image/jpeg',
    sort_order: 0,
    created_at: '2026-03-02T11:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// toIsoString
// ============================================================================

describe('toIsoString', () => {
  it('should return string value as-is', () => {
    const result = toIsoString('2026-03-01T08:00:00.000Z');
    expect(result).toBe('2026-03-01T08:00:00.000Z');
  });

  it('should convert Date to ISO string', () => {
    const date = new Date('2026-03-01T08:00:00.000Z');
    const result = toIsoString(date);
    expect(result).toBe('2026-03-01T08:00:00.000Z');
  });
});

// ============================================================================
// toIsoStringOrNull
// ============================================================================

describe('toIsoStringOrNull', () => {
  it('should return null for null input', () => {
    expect(toIsoStringOrNull(null)).toBeNull();
  });

  it('should return string value as-is', () => {
    expect(toIsoStringOrNull('2026-03-01T08:00:00.000Z')).toBe('2026-03-01T08:00:00.000Z');
  });

  it('should convert Date to ISO string', () => {
    const date = new Date('2026-03-01T08:00:00.000Z');
    expect(toIsoStringOrNull(date)).toBe('2026-03-01T08:00:00.000Z');
  });
});

// ============================================================================
// mapWorkOrderRowToApi
// ============================================================================

describe('mapWorkOrderRowToApi', () => {
  it('should map all fields correctly', () => {
    const row = createWorkOrderRow();
    const assignees = [mapAssigneeRowToApi(createAssigneeRow())];
    const result = mapWorkOrderRowToApi(row, assignees);

    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result.title).toBe('Ölwechsel durchführen');
    expect(result.description).toBe('Motor-Öl wechseln an Anlage M-001');
    expect(result.status).toBe('open');
    expect(result.priority).toBe('medium');
    expect(result.sourceType).toBe('tpm_defect');
    expect(result.sourceUuid).toBe('019c9547-aaaa-771a-b022-111111111111');
    expect(result.sourceTitle).toBeNull();
    expect(result.sourceExpectedBenefit).toBeNull();
    expect(result.dueDate).toBe('2026-03-10');
    expect(result.createdBy).toBe(5);
    expect(result.createdByName).toBe('Max Müller');
    expect(result.assignees).toHaveLength(1);
    expect(result.commentCount).toBe(3);
    expect(result.photoCount).toBe(1);
    expect(result.isActive).toBe(IS_ACTIVE.ACTIVE);
    expect(result.completedAt).toBeNull();
    expect(result.verifiedAt).toBeNull();
    expect(result.verifiedBy).toBeNull();
    expect(result.verifiedByName).toBeNull();
    expect(result.createdAt).toBe('2026-03-01T08:00:00.000Z');
    expect(result.updatedAt).toBe('2026-03-01T08:00:00.000Z');
  });

  it('should default to empty assignees array', () => {
    const row = createWorkOrderRow();
    const result = mapWorkOrderRowToApi(row);
    expect(result.assignees).toEqual([]);
  });

  it('should trim uuid whitespace', () => {
    const row = createWorkOrderRow({ uuid: '  019c9547-9fc0  ' });
    const result = mapWorkOrderRowToApi(row);
    expect(result.uuid).toBe('019c9547-9fc0');
  });

  it('should trim source_uuid whitespace', () => {
    const row = createWorkOrderRow({ source_uuid: '  abc-123  ' });
    const result = mapWorkOrderRowToApi(row);
    expect(result.sourceUuid).toBe('abc-123');
  });

  it('should handle null source_uuid', () => {
    const row = createWorkOrderRow({ source_uuid: null });
    const result = mapWorkOrderRowToApi(row);
    expect(result.sourceUuid).toBeNull();
  });

  it('should handle null description', () => {
    const row = createWorkOrderRow({ description: null });
    const result = mapWorkOrderRowToApi(row);
    expect(result.description).toBeNull();
  });

  it('should convert count strings to numbers', () => {
    const row = createWorkOrderRow({
      comment_count: '42',
      photo_count: '7',
    });
    const result = mapWorkOrderRowToApi(row);
    expect(result.commentCount).toBe(42);
    expect(result.photoCount).toBe(7);
  });

  it('should convert completed_at and verified_at dates', () => {
    const row = createWorkOrderRow({
      completed_at: '2026-03-05T14:00:00.000Z',
      verified_at: '2026-03-06T10:00:00.000Z',
      verified_by: 3,
    });
    const result = mapWorkOrderRowToApi(row);
    expect(result.completedAt).toBe('2026-03-05T14:00:00.000Z');
    expect(result.verifiedAt).toBe('2026-03-06T10:00:00.000Z');
    expect(result.verifiedBy).toBe(3);
  });
});

// ============================================================================
// mapWorkOrderRowToListItem
// ============================================================================

describe('mapWorkOrderRowToListItem', () => {
  it('should map all list fields correctly', () => {
    const row = createWorkOrderRow();
    const result = mapWorkOrderRowToListItem(row);

    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result.title).toBe('Ölwechsel durchführen');
    expect(result.status).toBe('open');
    expect(result.priority).toBe('medium');
    expect(result.sourceType).toBe('tpm_defect');
    expect(result.dueDate).toBe('2026-03-10');
    expect(result.createdByName).toBe('Max Müller');
    expect(result.assigneeCount).toBe(2);
    expect(result.assigneeNames).toBe('Anna Schmidt, Bob Weber');
    expect(result.commentCount).toBe(3);
    expect(result.photoCount).toBe(1);
    expect(result.createdAt).toBe('2026-03-01T08:00:00.000Z');
    expect(result.updatedAt).toBe('2026-03-01T08:00:00.000Z');
  });

  it('should handle null assignee_names as empty string', () => {
    const row = createWorkOrderRow({ assignee_names: null });
    const result = mapWorkOrderRowToListItem(row);
    expect(result.assigneeNames).toBe('');
  });

  it('should convert count strings to numbers', () => {
    const row = createWorkOrderRow({
      assignee_count: '0',
      comment_count: '0',
      photo_count: '0',
    });
    const result = mapWorkOrderRowToListItem(row);
    expect(result.assigneeCount).toBe(0);
    expect(result.commentCount).toBe(0);
    expect(result.photoCount).toBe(0);
  });
});

// ============================================================================
// mapAssigneeRowToApi
// ============================================================================

describe('mapAssigneeRowToApi', () => {
  it('should map all fields correctly', () => {
    const row = createAssigneeRow();
    const result = mapAssigneeRowToApi(row);

    expect(result.uuid).toBe('019c9547-bbbb-771a-b022-222222222222');
    expect(result.userId).toBe(42);
    expect(result.userName).toBe('Anna Schmidt');
    expect(result.profilePicture).toBeNull();
    expect(result.assignedAt).toBe('2026-03-01T09:00:00.000Z');
  });

  it('should trim uuid whitespace', () => {
    const row = createAssigneeRow({ uuid: '  trimmed-uuid  ' });
    const result = mapAssigneeRowToApi(row);
    expect(result.uuid).toBe('trimmed-uuid');
  });

  it('should handle names with leading/trailing spaces', () => {
    const row = createAssigneeRow({
      first_name: ' Hans ',
      last_name: ' Meier ',
    });
    const result = mapAssigneeRowToApi(row);
    expect(result.userName).toBe('Hans   Meier');
  });
});

// ============================================================================
// mapCommentRowToApi
// ============================================================================

describe('mapCommentRowToApi', () => {
  it('should map regular comment correctly', () => {
    const row = createCommentRow();
    const result = mapCommentRowToApi(row);

    expect(result.id).toBe(20);
    expect(result.uuid).toBe('019c9547-cccc-771a-b022-333333333333');
    expect(result.userId).toBe(42);
    expect(result.firstName).toBe('Anna');
    expect(result.lastName).toBe('Schmidt');
    expect(result.profilePicture).toBeNull();
    expect(result.content).toBe('Arbeit begonnen, Ersatzteile bestellt');
    expect(result.isStatusChange).toBe(false);
    expect(result.oldStatus).toBeNull();
    expect(result.newStatus).toBeNull();
    expect(result.parentId).toBeNull();
    expect(result.replyCount).toBe(0);
    expect(result.createdAt).toBe('2026-03-02T10:00:00.000Z');
  });

  it('should map status-change comment correctly', () => {
    const row = createCommentRow({
      is_status_change: true,
      old_status: 'open',
      new_status: 'in_progress',
      content: 'Status geändert: Offen → In Bearbeitung',
    });
    const result = mapCommentRowToApi(row);

    expect(result.isStatusChange).toBe(true);
    expect(result.oldStatus).toBe('open');
    expect(result.newStatus).toBe('in_progress');
  });

  it('should map reply comment with parentId', () => {
    const row = createCommentRow({ parent_id: 10 });
    const result = mapCommentRowToApi(row);

    expect(result.parentId).toBe(10);
  });

  it('should map profile picture when present', () => {
    const row = createCommentRow({
      profile_picture: 'uploads/avatars/anna.jpg',
    });
    const result = mapCommentRowToApi(row);

    expect(result.profilePicture).toBe('uploads/avatars/anna.jpg');
  });

  it('should convert reply_count string to number', () => {
    const row = createCommentRow({ reply_count: '5' });
    const result = mapCommentRowToApi(row);

    expect(result.replyCount).toBe(5);
  });
});

// ============================================================================
// mapPhotoRowToApi
// ============================================================================

describe('mapPhotoRowToApi', () => {
  it('should map all fields correctly', () => {
    const row = createPhotoRow();
    const result = mapPhotoRowToApi(row);

    expect(result.uuid).toBe('019c9547-dddd-771a-b022-444444444444');
    expect(result.uploadedBy).toBe(42);
    expect(result.filePath).toBe('uploads/work-orders/1/uuid/photo.jpg');
    expect(result.fileName).toBe('reparatur-foto.jpg');
    expect(result.fileSize).toBe(1_234_567);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sortOrder).toBe(0);
    expect(result.createdAt).toBe('2026-03-02T11:00:00.000Z');
  });

  it('should trim uuid whitespace', () => {
    const row = createPhotoRow({ uuid: '  photo-uuid  ' });
    const result = mapPhotoRowToApi(row);
    expect(result.uuid).toBe('photo-uuid');
  });
});

// ============================================================================
// mapSourcePhotoRowToApi
// ============================================================================

describe('mapSourcePhotoRowToApi', () => {
  const baseRow: SourcePhotoRow = {
    uuid: '  019caf7b-be0f-70c4-b4e1-6b14d55c5bcd  ',
    file_path: 'uploads/tpm/2/defects/abc/photo.jpg',
    file_name: 'Kentaro_Miura.jpg',
    file_size: 14_499,
    mime_type: 'image/jpeg',
    created_at: '2026-03-02T16:57:28.331Z',
  };

  it('should map all fields correctly', () => {
    const result = mapSourcePhotoRowToApi(baseRow);

    expect(result).toEqual({
      uuid: '019caf7b-be0f-70c4-b4e1-6b14d55c5bcd',
      filePath: 'uploads/tpm/2/defects/abc/photo.jpg',
      fileName: 'Kentaro_Miura.jpg',
      fileSize: 14_499,
      mimeType: 'image/jpeg',
      createdAt: '2026-03-02T16:57:28.331Z',
    });
  });

  it('should trim uuid whitespace', () => {
    const result = mapSourcePhotoRowToApi(baseRow);
    expect(result.uuid).not.toContain(' ');
  });

  it('should convert Date created_at to ISO string', () => {
    const result = mapSourcePhotoRowToApi({
      ...baseRow,
      created_at: new Date('2026-01-20T09:15:00Z'),
    });
    expect(result.createdAt).toBe('2026-01-20T09:15:00.000Z');
  });

  it('should handle PNG mime type', () => {
    const result = mapSourcePhotoRowToApi({
      ...baseRow,
      mime_type: 'image/png',
      file_name: 'screenshot.png',
    });
    expect(result.mimeType).toBe('image/png');
    expect(result.fileName).toBe('screenshot.png');
  });
});

// ============================================================================
// normalizeFilePath (via mapSourcePhotoRowToApi)
// ============================================================================

describe('normalizeFilePath (via mapSourcePhotoRowToApi)', () => {
  const baseRow: SourcePhotoRow = {
    uuid: 'test-uuid',
    file_path: '',
    file_name: 'photo.jpg',
    file_size: 1000,
    mime_type: 'image/jpeg',
    created_at: '2026-03-01T00:00:00.000Z',
  };

  it('should keep already-relative path unchanged', () => {
    const result = mapSourcePhotoRowToApi({
      ...baseRow,
      file_path: 'uploads/tpm/2/defects/abc/photo.jpg',
    });
    expect(result.filePath).toBe('uploads/tpm/2/defects/abc/photo.jpg');
  });

  it('should strip absolute Docker prefix from KVP path', () => {
    const result = mapSourcePhotoRowToApi({
      ...baseRow,
      file_path: '/app/backend/uploads/kvp/1/abc/photo.jpg',
    });
    expect(result.filePath).toBe('uploads/kvp/1/abc/photo.jpg');
  });

  it('should handle path without uploads/ prefix', () => {
    const result = mapSourcePhotoRowToApi({
      ...baseRow,
      file_path: '/some/other/path/photo.jpg',
    });
    expect(result.filePath).toBe('/some/other/path/photo.jpg');
  });
});

// ============================================================================
// mapCalendarWorkOrderRow
// ============================================================================

function createCalendarWorkOrderRow(
  overrides: Partial<CalendarWorkOrderRow> = {},
): CalendarWorkOrderRow {
  return {
    uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
    title: 'Ölwechsel durchführen',
    due_date: '2026-03-10',
    status: 'open',
    priority: 'medium',
    source_type: 'tpm_defect',
    ...overrides,
  };
}

describe('mapCalendarWorkOrderRow', () => {
  it('should map all fields correctly', () => {
    const row = createCalendarWorkOrderRow();
    const result = mapCalendarWorkOrderRow(row);

    expect(result.uuid).toBe('019c9547-9fc0-771a-b022-3767e233d6f3');
    expect(result.title).toBe('Ölwechsel durchführen');
    expect(result.dueDate).toBe('2026-03-10');
    expect(result.status).toBe('open');
    expect(result.priority).toBe('medium');
    expect(result.sourceType).toBe('tpm_defect');
  });

  it('should trim uuid whitespace', () => {
    const row = createCalendarWorkOrderRow({ uuid: '  abc-123  ' });
    const result = mapCalendarWorkOrderRow(row);
    expect(result.uuid).toBe('abc-123');
  });

  it('should pass through all status values', () => {
    for (const status of ['open', 'in_progress', 'completed', 'verified'] as const) {
      const result = mapCalendarWorkOrderRow(createCalendarWorkOrderRow({ status }));
      expect(result.status).toBe(status);
    }
  });

  it('should pass through all priority values', () => {
    for (const priority of ['low', 'medium', 'high'] as const) {
      const result = mapCalendarWorkOrderRow(createCalendarWorkOrderRow({ priority }));
      expect(result.priority).toBe(priority);
    }
  });

  it('should handle manual source type', () => {
    const result = mapCalendarWorkOrderRow(createCalendarWorkOrderRow({ source_type: 'manual' }));
    expect(result.sourceType).toBe('manual');
  });
});

// ============================================================================
// isValidStatusTransition
// ============================================================================

describe('isValidStatusTransition', () => {
  // --- Allowed transitions ---
  const allowedTransitions: [WorkOrderStatus, WorkOrderStatus][] = [
    ['open', 'in_progress'],
    ['open', 'completed'],
    ['in_progress', 'completed'],
    ['completed', 'verified'],
    ['completed', 'in_progress'],
    ['verified', 'completed'],
  ];

  for (const [from, to] of allowedTransitions) {
    it(`should allow ${from} → ${to}`, () => {
      expect(isValidStatusTransition(from, to)).toBe(true);
    });
  }

  // --- Forbidden transitions ---
  const forbiddenTransitions: [WorkOrderStatus, WorkOrderStatus][] = [
    ['open', 'open'],
    ['open', 'verified'],
    ['in_progress', 'open'],
    ['in_progress', 'in_progress'],
    ['in_progress', 'verified'],
    ['completed', 'open'],
    ['completed', 'completed'],
    ['verified', 'open'],
    ['verified', 'in_progress'],
    ['verified', 'verified'],
  ];

  for (const [from, to] of forbiddenTransitions) {
    it(`should forbid ${from} → ${to}`, () => {
      expect(isValidStatusTransition(from, to)).toBe(false);
    });
  }

  it('should return false for unknown source status', () => {
    expect(isValidStatusTransition('unknown' as WorkOrderStatus, 'open')).toBe(false);
  });
});
