/**
 * Work Orders Comments Service -- Unit Tests
 *
 * Tests addComment, listComments, listReplies, deleteComment with mocked DB + ActivityLogger.
 * Covers happy paths, NotFoundException, ForbiddenException, and threading validation.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { WorkOrderCommentsService } from './work-orders-comments.service.js';
import type { WorkOrderCommentWithNameRow } from './work-orders.types.js';

// ============================================================================
// Mock uuid
// ============================================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('019c9999-aaaa-7000-0000-000000000001'),
}));

// ============================================================================
// Constants
// ============================================================================

const TENANT_ID = 1;
const USER_ID = 42;
const WORK_ORDER_UUID = '019c9547-9fc0-771a-b022-3767e233d6f3';
const COMMENT_UUID = '019c9547-cccc-771a-b022-333333333333';

// ============================================================================
// Test helpers
// ============================================================================

const mockDb = {
  query: vi.fn(),
  queryOne: vi.fn(),
};

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
};

function createService(): WorkOrderCommentsService {
  return new WorkOrderCommentsService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
  );
}

function createWorkOrderRow(
  overrides: Partial<{ id: number; title: string }> = {},
): { id: number; title: string } {
  return {
    id: 10,
    title: 'Ölwechsel durchführen',
    ...overrides,
  };
}

function createCommentRow(
  overrides: Partial<WorkOrderCommentWithNameRow> = {},
): WorkOrderCommentWithNameRow {
  return {
    id: 20,
    uuid: COMMENT_UUID,
    tenant_id: TENANT_ID,
    work_order_id: 10,
    user_id: USER_ID,
    content: 'Ersatzteile bestellt',
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

// ============================================================================
// Setup
// ============================================================================

let service: WorkOrderCommentsService;

beforeEach(() => {
  vi.clearAllMocks();
  service = createService();
});

// ============================================================================
// addComment
// ============================================================================

describe('addComment', () => {
  it('should insert comment and return mapped API type', async () => {
    const woRow = createWorkOrderRow();
    const commentRow = createCommentRow({ content: 'Neuer Kommentar' });

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce(commentRow); // INSERT RETURNING

    const result = await service.addComment(
      TENANT_ID,
      USER_ID,
      WORK_ORDER_UUID,
      'Neuer Kommentar',
    );

    expect(result.uuid).toBe(COMMENT_UUID);
    expect(result.userId).toBe(USER_ID);
    expect(result.firstName).toBe('Anna');
    expect(result.lastName).toBe('Schmidt');
    expect(result.profilePicture).toBeNull();
    expect(result.content).toBe('Neuer Kommentar');
    expect(result.isStatusChange).toBe(false);
    expect(result.oldStatus).toBeNull();
    expect(result.newStatus).toBeNull();
    expect(result.parentId).toBeNull();
    expect(result.replyCount).toBe(0);
    expect(result.createdAt).toBe('2026-03-02T10:00:00.000Z');

    // Verify resolveWorkOrder query
    expect(mockDb.queryOne).toHaveBeenCalledTimes(2);
    expect(mockDb.queryOne.mock.calls[0][1]).toEqual([
      WORK_ORDER_UUID,
      TENANT_ID,
    ]);

    // Verify INSERT query params (includes parent_id = null)
    expect(mockDb.queryOne.mock.calls[1][1]).toEqual([
      '019c9999-aaaa-7000-0000-000000000001', // mocked uuidv7
      TENANT_ID,
      woRow.id,
      USER_ID,
      'Neuer Kommentar',
      null,
    ]);

    // Activity logger fires (void, non-awaited)
    expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      'work_order_comment',
      woRow.id,
      `Kommentar zu "${woRow.title}" hinzugefügt`,
      { workOrderUuid: WORK_ORDER_UUID },
    );
  });

  it('should throw NotFoundException when work order does not exist', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null); // resolveWorkOrder returns null

    await expect(
      service.addComment(TENANT_ID, USER_ID, WORK_ORDER_UUID, 'Test'),
    ).rejects.toThrow(NotFoundException);

    expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when INSERT returns null', async () => {
    const woRow = createWorkOrderRow();

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce(null); // INSERT returns null

    await expect(
      service.addComment(TENANT_ID, USER_ID, WORK_ORDER_UUID, 'Test'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ============================================================================
// listComments
// ============================================================================

describe('listComments', () => {
  it('should return paginated comments with correct values', async () => {
    const woRow = createWorkOrderRow();
    const rows = [
      createCommentRow({ id: 20, content: 'Erster Kommentar' }),
      createCommentRow({ id: 21, content: 'Zweiter Kommentar', user_id: 99 }),
    ];

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce({ count: '2' }); // COUNT query
    mockDb.query.mockResolvedValueOnce(rows); // SELECT with LIMIT/OFFSET

    const result = await service.listComments(
      TENANT_ID,
      WORK_ORDER_UUID,
      1,
      10,
    );

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].content).toBe('Erster Kommentar');
    expect(result.items[1].content).toBe('Zweiter Kommentar');

    // Verify LIMIT/OFFSET params: [wo.id, limit, offset]
    expect(mockDb.query.mock.calls[0][1]).toEqual([woRow.id, 10, 0]);
  });

  it('should return empty items when no comments exist', async () => {
    const woRow = createWorkOrderRow();

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce({ count: '0' }); // COUNT = 0
    mockDb.query.mockResolvedValueOnce([]); // no rows

    const result = await service.listComments(
      TENANT_ID,
      WORK_ORDER_UUID,
      1,
      10,
    );

    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items).toEqual([]);
  });

  it('should calculate correct offset for page > 1', async () => {
    const woRow = createWorkOrderRow();

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce({ count: '25' }); // COUNT
    mockDb.query.mockResolvedValueOnce([]); // rows (irrelevant for this check)

    const result = await service.listComments(
      TENANT_ID,
      WORK_ORDER_UUID,
      3,
      10,
    );

    // offset = (3-1) * 10 = 20
    expect(mockDb.query.mock.calls[0][1]).toEqual([woRow.id, 10, 20]);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(25);
  });

  it('should throw NotFoundException when work order does not exist', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null); // resolveWorkOrder

    await expect(
      service.listComments(TENANT_ID, WORK_ORDER_UUID, 1, 10),
    ).rejects.toThrow(NotFoundException);
  });

  it('should handle null count result gracefully', async () => {
    const woRow = createWorkOrderRow();

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce(null); // COUNT returns null
    mockDb.query.mockResolvedValueOnce([]); // no rows

    const result = await service.listComments(
      TENANT_ID,
      WORK_ORDER_UUID,
      1,
      10,
    );

    expect(result.total).toBe(0);
  });
});

// ============================================================================
// deleteComment
// ============================================================================

describe('deleteComment', () => {
  it('should soft-delete own comment successfully', async () => {
    const comment = { id: 20, user_id: USER_ID, work_order_id: 10 };
    mockDb.queryOne.mockResolvedValueOnce(comment);
    mockDb.query.mockResolvedValueOnce([]); // UPDATE is_active = ${IS_ACTIVE.DELETED}

    await service.deleteComment(TENANT_ID, USER_ID, COMMENT_UUID, false);

    // Verify SELECT to find comment
    expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    expect(mockDb.queryOne.mock.calls[0][1]).toEqual([COMMENT_UUID, TENANT_ID]);

    // Verify UPDATE is_active = 4
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    expect(mockDb.query.mock.calls[0][1]).toEqual([comment.id]);

    // Activity logger fires
    expect(mockActivityLogger.logDelete).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      'work_order_comment',
      comment.work_order_id,
      'Kommentar gelöscht',
      { commentUuid: COMMENT_UUID },
    );
  });

  it('should throw NotFoundException when comment does not exist', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    await expect(
      service.deleteComment(TENANT_ID, USER_ID, COMMENT_UUID, false),
    ).rejects.toThrow(NotFoundException);

    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when non-owner non-admin tries to delete', async () => {
    const otherUserId = 99;
    const comment = { id: 20, user_id: otherUserId, work_order_id: 10 };
    mockDb.queryOne.mockResolvedValueOnce(comment);

    await expect(
      service.deleteComment(TENANT_ID, USER_ID, COMMENT_UUID, false),
    ).rejects.toThrow(ForbiddenException);

    // No UPDATE should happen
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('should allow admin to delete any comment', async () => {
    const otherUserId = 99;
    const comment = { id: 20, user_id: otherUserId, work_order_id: 10 };
    mockDb.queryOne.mockResolvedValueOnce(comment);
    mockDb.query.mockResolvedValueOnce([]); // UPDATE

    await service.deleteComment(TENANT_ID, USER_ID, COMMENT_UUID, true);

    // UPDATE should have been called (not rejected)
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    expect(mockDb.query.mock.calls[0][1]).toEqual([comment.id]);

    expect(mockActivityLogger.logDelete).toHaveBeenCalledOnce();
  });

  it('should allow owner to delete even when isAdmin is true', async () => {
    const comment = { id: 20, user_id: USER_ID, work_order_id: 10 };
    mockDb.queryOne.mockResolvedValueOnce(comment);
    mockDb.query.mockResolvedValueOnce([]);

    await service.deleteComment(TENANT_ID, USER_ID, COMMENT_UUID, true);

    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// addComment with parentId (reply threading)
// ============================================================================

describe('addComment with parentId', () => {
  it('should insert reply when parent is valid top-level comment', async () => {
    const woRow = createWorkOrderRow();
    const parentRow = { id: 100, parent_id: null };
    const replyRow = createCommentRow({
      content: 'Antwort',
      parent_id: 100,
    });

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce(parentRow) // validateParent
      .mockResolvedValueOnce(replyRow); // INSERT RETURNING

    const result = await service.addComment(
      TENANT_ID,
      USER_ID,
      WORK_ORDER_UUID,
      'Antwort',
      100,
    );

    expect(result.parentId).toBe(100);
    expect(result.content).toBe('Antwort');

    // Verify INSERT params include parentId
    expect(mockDb.queryOne.mock.calls[2][1]).toEqual([
      '019c9999-aaaa-7000-0000-000000000001',
      TENANT_ID,
      woRow.id,
      USER_ID,
      'Antwort',
      100,
    ]);
  });

  it('should throw NotFoundException when parent comment does not exist', async () => {
    const woRow = createWorkOrderRow();

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce(null); // validateParent → not found

    await expect(
      service.addComment(TENANT_ID, USER_ID, WORK_ORDER_UUID, 'Reply', 999),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when replying to a reply (nested)', async () => {
    const woRow = createWorkOrderRow();
    const nestedParent = { id: 50, parent_id: 10 }; // already a reply

    mockDb.queryOne
      .mockResolvedValueOnce(woRow) // resolveWorkOrder
      .mockResolvedValueOnce(nestedParent); // validateParent → is a reply

    await expect(
      service.addComment(TENANT_ID, USER_ID, WORK_ORDER_UUID, 'Nested', 50),
    ).rejects.toThrow(BadRequestException);
  });
});

// ============================================================================
// listReplies
// ============================================================================

describe('listReplies', () => {
  it('should return replies for a comment', async () => {
    const woRow = createWorkOrderRow();
    const replies = [
      createCommentRow({ id: 30, content: 'Antwort 1', parent_id: 20 }),
      createCommentRow({ id: 31, content: 'Antwort 2', parent_id: 20 }),
    ];

    mockDb.queryOne.mockResolvedValueOnce(woRow); // resolveWorkOrder
    mockDb.query.mockResolvedValueOnce(replies);

    const result = await service.listReplies(TENANT_ID, WORK_ORDER_UUID, 20);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Antwort 1');
    expect(result[0].parentId).toBe(20);
    expect(result[1].content).toBe('Antwort 2');

    // Verify query params: [wo.id, commentId]
    expect(mockDb.query.mock.calls[0][1]).toEqual([woRow.id, 20]);
  });

  it('should return empty array when no replies exist', async () => {
    const woRow = createWorkOrderRow();

    mockDb.queryOne.mockResolvedValueOnce(woRow);
    mockDb.query.mockResolvedValueOnce([]);

    const result = await service.listReplies(TENANT_ID, WORK_ORDER_UUID, 20);

    expect(result).toEqual([]);
  });

  it('should throw NotFoundException when work order does not exist', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null);

    await expect(
      service.listReplies(TENANT_ID, WORK_ORDER_UUID, 20),
    ).rejects.toThrow(NotFoundException);
  });
});
