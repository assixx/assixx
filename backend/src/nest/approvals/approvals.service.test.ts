/**
 * Unit tests for ApprovalsService
 *
 * CRUD + status transitions (approve/reject) for approval lifecycle.
 * Mocked dependencies: DatabaseService (tenantTransaction), ActivityLoggerService.
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ApprovalsConfigService } from './approvals-config.service.js';
import { ApprovalsService } from './approvals.service.js';
import type { ApprovalListRow, ApprovalRow } from './approvals.types.js';
import type { CreateApprovalDto } from './dto/index.js';

// =============================================================
// Mock uuid to produce deterministic values
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('00000000-0000-7000-8000-000000000001'),
}));

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return { tenantTransaction: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}
type MockLogger = ReturnType<typeof createMockActivityLogger>;

function createMockConfigService() {
  return {
    resolveApprovers: vi.fn().mockResolvedValue([]),
  };
}
type MockConfigService = ReturnType<typeof createMockConfigService>;

// =============================================================
// Test Data Factories
// =============================================================

function makeApprovalRow(overrides: Partial<ApprovalRow> = {}): ApprovalRow {
  return {
    id: 1,
    uuid: '00000000-0000-7000-8000-000000000001',
    tenant_id: 10,
    addon_code: 'kvp',
    source_entity_type: 'suggestion',
    source_uuid: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
    title: 'Test Approval',
    description: null,
    requested_by: 5,
    assigned_to: null,
    status: 'pending',
    priority: 'medium',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    is_active: 1,
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeApprovalListRow(overrides: Partial<ApprovalListRow> = {}): ApprovalListRow {
  return {
    ...makeApprovalRow(),
    requested_by_name: 'Max Müller',
    decided_by_name: null,
    assigned_to_name: null,
    ...overrides,
  };
}

function makeCreateDto(overrides: Partial<CreateApprovalDto> = {}): CreateApprovalDto {
  return {
    addonCode: 'kvp',
    sourceEntityType: 'suggestion',
    sourceUuid: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
    title: 'New Approval Request',
    description: null,
    priority: 'medium',
    assignedTo: null,
    ...overrides,
  } as CreateApprovalDto;
}

// =============================================================
// Test Suite
// =============================================================

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let mockDb: MockDb;
  let mockLogger: MockLogger;
  let mockConfigService: MockConfigService;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockLogger = createMockActivityLogger();
    mockConfigService = createMockConfigService();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>): Promise<unknown> => {
        return await callback(mockClient);
      },
    );

    service = new ApprovalsService(
      mockDb as unknown as DatabaseService,
      mockLogger as unknown as ActivityLoggerService,
      mockConfigService as unknown as ApprovalsConfigService,
    );
  });

  // =============================================================
  // create
  // =============================================================

  describe('create()', () => {
    it('should return new approval with status pending', async () => {
      const insertedRow = makeApprovalRow({ status: 'pending' });
      const fullRow = makeApprovalListRow({ status: 'pending' });

      // INSERT RETURNING
      mockClient.query.mockResolvedValueOnce({ rows: [insertedRow] });
      // Re-fetch with JOINs
      mockClient.query.mockResolvedValueOnce({ rows: [fullRow] });

      const result = await service.create(makeCreateDto(), 10, 5);

      expect(result.status).toBe('pending');
    });

    it('should set correct fields from DTO', async () => {
      const dto = makeCreateDto({
        addonCode: 'tpm',
        sourceEntityType: 'card',
        sourceUuid: 'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb',
        title: 'TPM Approval',
        description: 'Needs review',
        priority: 'high',
        assignedTo: 20,
      });

      const insertedRow = makeApprovalRow({
        addon_code: 'tpm',
        source_entity_type: 'card',
        source_uuid: 'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb',
        title: 'TPM Approval',
        description: 'Needs review',
        priority: 'high',
        assigned_to: 20,
      });
      const fullRow = makeApprovalListRow({
        ...insertedRow,
        assigned_to_name: 'Lisa Schmidt',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [insertedRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [fullRow] });

      const result = await service.create(dto, 10, 5);

      expect(result.addonCode).toBe('tpm');
      expect(result.sourceEntityType).toBe('card');
      expect(result.sourceUuid).toBe('bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb');
      expect(result.title).toBe('TPM Approval');
      expect(result.description).toBe('Needs review');
      expect(result.priority).toBe('high');
      expect(result.assignedTo).toBe(20);
      expect(result.assignedToName).toBe('Lisa Schmidt');
    });

    it('should pass correct parameters to INSERT query', async () => {
      const insertedRow = makeApprovalRow();
      const fullRow = makeApprovalListRow();

      mockClient.query.mockResolvedValueOnce({ rows: [insertedRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [fullRow] });

      await service.create(makeCreateDto(), 10, 5);

      const insertCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(insertCall[0]).toContain('INSERT INTO approvals');
      expect(insertCall[1]).toContain(10); // tenantId
      expect(insertCall[1]).toContain(5); // requestedBy
      expect(insertCall[1]).toContain('kvp'); // addonCode
    });

    it('should log activity after creation', async () => {
      const insertedRow = makeApprovalRow();
      const fullRow = makeApprovalListRow();

      mockClient.query.mockResolvedValueOnce({ rows: [insertedRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [fullRow] });

      await service.create(makeCreateDto(), 10, 5);

      expect(mockLogger.logCreate).toHaveBeenCalledWith(
        10,
        5,
        'approval',
        fullRow.id,
        expect.stringContaining('Approval requested'),
        expect.objectContaining({ addonCode: 'kvp' }),
      );
    });

    it('should throw when INSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.create(makeCreateDto(), 10, 5)).rejects.toThrow(
        'Insert returned no rows',
      );
    });

    it('should throw when re-fetch after INSERT fails', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalRow()],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.create(makeCreateDto(), 10, 5)).rejects.toThrow(
        'Re-fetch after insert failed',
      );
    });
  });

  // =============================================================
  // findAll
  // =============================================================

  describe('findAll()', () => {
    it('should return paginated results', async () => {
      const row1 = makeApprovalListRow({ id: 1, title: 'First' });
      const row2 = makeApprovalListRow({ id: 2, title: 'Second' });

      // COUNT query
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // SELECT data
      mockClient.query.mockResolvedValueOnce({ rows: [row1, row2] });

      const result = await service.findAll({}, 5, 10);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply status filter', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow({ status: 'approved' })],
      });

      const result = await service.findAll({ status: 'approved' }, 5, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.status).toBe('approved');

      // Verify the status filter was included in query params
      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(countCall[1]).toContain('approved');
    });

    it('should apply addonCode filter', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow({ addon_code: 'tpm' })],
      });

      const result = await service.findAll({ addonCode: 'tpm' }, 5, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.addonCode).toBe('tpm');

      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(countCall[1]).toContain('tpm');
    });

    it('should apply priority filter', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow({ priority: 'high' })],
      });

      const result = await service.findAll({ priority: 'high' }, 5, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.priority).toBe('high');
    });

    it('should return empty when no results', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findAll({}, 5, 10);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should default total to 0 when COUNT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COUNT → empty
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // DATA → empty

      const result = await service.findAll({}, 5, 10);

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should respect page and limit', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '50' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow()],
      });

      const result = await service.findAll({ page: 3, limit: 10 }, 5, 10);

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);

      // Verify LIMIT and OFFSET in the data query
      const dataCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      expect(dataCall[1]).toContain(10); // limit
      expect(dataCall[1]).toContain(20); // offset = (3-1) * 10
    });

    it('should apply combined filters', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow()],
      });

      await service.findAll(
        {
          status: 'pending',
          addonCode: 'kvp',
          priority: 'high',
        },
        5,
        10,
      );

      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(countCall[1]).toEqual(['pending', 'kvp', 'high']);
    });

    // -----------------------------------------------------------
    // search filter (Phase 1.2b — D3 convention, ILIKE on title OR description)
    // -----------------------------------------------------------

    it('should apply search filter (ILIKE on title OR description)', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow({ title: 'Wartung Pumpe 3' })],
      });

      const result = await service.findAll({ search: 'Wartung' }, 5, 10);

      expect(result.items).toHaveLength(1);

      // COUNT call must contain ILIKE pattern + the wrapped search term as the only filter param.
      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(countCall[0]).toContain('ILIKE');
      expect(countCall[0]).toContain('a.title');
      expect(countCall[0]).toContain('a.description');
      expect(countCall[1]).toEqual(['%Wartung%']);
    });

    it('should drop search WHERE clause when search is empty string', async () => {
      // Backwards-compat invariant: empty string === undefined (no filter applied).
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.findAll({ search: '' }, 5, 10);

      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(countCall[0]).not.toContain('ILIKE');
      expect(countCall[1]).toEqual([]);
    });

    it('should combine search with other filters in correct param order', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow()],
      });

      await service.findAll(
        {
          status: 'pending',
          addonCode: 'kvp',
          priority: 'high',
          search: 'urgent',
        },
        5,
        10,
      );

      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      // Order matches push order: status, addonCode, priority, search.
      expect(countCall[1]).toEqual(['pending', 'kvp', 'high', '%urgent%']);
      expect(countCall[0]).toContain('ILIKE');
    });
  });

  // =============================================================
  // findById
  // =============================================================

  describe('findById()', () => {
    it('should return approval by UUID', async () => {
      const row = makeApprovalListRow();
      mockClient.query.mockResolvedValueOnce({ rows: [row] });

      const result = await service.findById(row.uuid);

      expect(result.uuid).toBe(row.uuid.trim());
      expect(result.title).toBe(row.title);
      expect(result.requestedByName).toBe('Max Müller');
    });

    it('should throw NotFoundException when UUID not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findById('nonexistent-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // findByRequester
  // =============================================================

  describe('findByRequester()', () => {
    it('should return approvals requested by user', async () => {
      const row1 = makeApprovalListRow({ id: 1, requested_by: 5 });
      const row2 = makeApprovalListRow({ id: 2, requested_by: 5 });

      mockClient.query.mockResolvedValueOnce({ rows: [row1, row2] });

      const result = await service.findByRequester(5);

      expect(result).toHaveLength(2);
      expect(result[0]?.requestedBy).toBe(5);
      expect(result[1]?.requestedBy).toBe(5);
    });

    it('should return empty array when user has no approvals', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findByRequester(999);

      expect(result).toHaveLength(0);
    });

    it('should pass userId as query parameter', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.findByRequester(42);

      const call = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(call[1]).toContain(42);
    });
  });

  // =============================================================
  // findByAssignee
  // =============================================================

  describe('findByAssignee()', () => {
    it('should return approvals assigned to user', async () => {
      const row = makeApprovalListRow({
        assigned_to: 20,
        assigned_to_name: 'Lisa Schmidt',
      });

      // COUNT
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      // DATA
      mockClient.query.mockResolvedValueOnce({ rows: [row] });

      const result = await service.findByAssignee(20, 10, {});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.assignedTo).toBe(20);
      expect(result.items[0]?.assignedToName).toBe('Lisa Schmidt');
    });

    it('should return empty when no approvals assigned', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findByAssignee(999, 10, {});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should default total to 0 when COUNT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COUNT → empty
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // DATA → empty

      const result = await service.findByAssignee(20, 10, {});

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should respect explicit page and limit', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      mockClient.query.mockResolvedValueOnce({ rows: [makeApprovalListRow({ assigned_to: 20 })] });

      const result = await service.findByAssignee(20, 10, { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      const dataCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      expect(dataCall[1]).toContain(10); // limit
      expect(dataCall[1]).toContain(10); // offset = (2-1)*10
    });

    it('should apply status filter for assignee', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [makeApprovalListRow({ assigned_to: 20, status: 'pending' })],
      });

      const result = await service.findByAssignee(20, 10, { status: 'pending' });

      expect(result.items).toHaveLength(1);
      const countCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(countCall[1]).toContain(20);
      expect(countCall[1]).toContain('pending');
    });
  });

  // =============================================================
  // approve
  // =============================================================

  describe('approve()', () => {
    it('should change status to approved', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const approvedRow = makeApprovalListRow({
        status: 'approved',
        decided_by: 20,
        decided_at: '2026-01-15T12:00:00.000Z',
        decided_by_name: 'Admin User',
      });

      // SELECT FOR UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      // UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // Re-fetch with JOINs
      mockClient.query.mockResolvedValueOnce({ rows: [approvedRow] });

      const result = await service.approve('test-uuid', 10, 20);

      expect(result.status).toBe('approved');
    });

    it('should set decided_by and decided_at', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const approvedRow = makeApprovalListRow({
        status: 'approved',
        decided_by: 20,
        decided_at: '2026-01-15T12:00:00.000Z',
        decided_by_name: 'Admin User',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [approvedRow] });

      const result = await service.approve('test-uuid', 10, 20);

      expect(result.decidedBy).toBe(20);
      expect(result.decidedAt).toBe('2026-01-15T12:00:00.000Z');
      expect(result.decidedByName).toBe('Admin User');
    });

    it('should throw NotFoundException for unknown UUID', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.approve('nonexistent-uuid', 10, 20)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already decided approval', async () => {
      const alreadyApproved = makeApprovalRow({
        status: 'approved',
        requested_by: 5,
      });
      mockClient.query.mockResolvedValueOnce({ rows: [alreadyApproved] });

      await expect(service.approve('test-uuid', 10, 20)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for self-approval', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 20, // same as decidedBy
      });
      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });

      await expect(service.approve('test-uuid', 10, 20)).rejects.toThrow(ForbiddenException);
    });

    it('should include optional note', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const approvedRow = makeApprovalListRow({
        status: 'approved',
        decided_by: 20,
        decided_at: '2026-01-15T12:00:00.000Z',
        decision_note: 'Looks good',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [approvedRow] });

      const result = await service.approve('test-uuid', 10, 20, 'Looks good');

      expect(result.decisionNote).toBe('Looks good');

      // Verify note was passed to UPDATE query
      const updateCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      expect(updateCall[1]).toContain('Looks good');
    });

    it('should log activity after approval', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const approvedRow = makeApprovalListRow({
        status: 'approved',
        decided_by: 20,
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [approvedRow] });

      await service.approve('test-uuid', 10, 20);

      expect(mockLogger.logUpdate).toHaveBeenCalledWith(
        10,
        20,
        'approval',
        approvedRow.id,
        expect.stringContaining('approved'),
        expect.objectContaining({ status: 'approved' }),
      );
    });
  });

  // =============================================================
  // reject
  // =============================================================

  describe('reject()', () => {
    it('should change status to rejected', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const rejectedRow = makeApprovalListRow({
        status: 'rejected',
        decided_by: 20,
        decided_at: '2026-01-15T12:00:00.000Z',
        decision_note: 'Not justified',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [rejectedRow] });

      const result = await service.reject('test-uuid', 10, 20, 'Not justified');

      expect(result.status).toBe('rejected');
    });

    it('should include the decision_note', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const rejectedRow = makeApprovalListRow({
        status: 'rejected',
        decided_by: 20,
        decision_note: 'Budget exceeded',
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [rejectedRow] });

      const result = await service.reject('test-uuid', 10, 20, 'Budget exceeded');

      expect(result.decisionNote).toBe('Budget exceeded');

      const updateCall = mockClient.query.mock.calls[1] as [string, unknown[]];
      expect(updateCall[1]).toContain('Budget exceeded');
    });

    it('should throw ForbiddenException for self-rejection', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 20, // same as decidedBy
      });
      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });

      await expect(service.reject('test-uuid', 10, 20, 'Reason')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for unknown UUID', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.reject('nonexistent-uuid', 10, 20, 'Reason')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for already rejected approval', async () => {
      const alreadyRejected = makeApprovalRow({
        status: 'rejected',
        requested_by: 5,
      });
      mockClient.query.mockResolvedValueOnce({ rows: [alreadyRejected] });

      await expect(service.reject('test-uuid', 10, 20, 'Duplicate rejection')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log activity after rejection', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const rejectedRow = makeApprovalListRow({
        status: 'rejected',
        decided_by: 20,
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [rejectedRow] });

      await service.reject('test-uuid', 10, 20, 'Not valid');

      expect(mockLogger.logUpdate).toHaveBeenCalledWith(
        10,
        20,
        'approval',
        rejectedRow.id,
        expect.stringContaining('rejected'),
        expect.objectContaining({ status: 'rejected' }),
      );
    });
  });

  // =============================================================
  // getStats
  // =============================================================

  describe('getStats()', () => {
    it('should return correct counts', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ pending: '5', approved: '12', rejected: '3', total: '20' }],
      });

      const result = await service.getStats();

      expect(result.pending).toBe(5);
      expect(result.approved).toBe(12);
      expect(result.rejected).toBe(3);
      expect(result.total).toBe(20);
    });

    it('should return zeros when empty', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ pending: '0', approved: '0', rejected: '0', total: '0' }],
      });

      const result = await service.getStats();

      expect(result.pending).toBe(0);
      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should filter by userId when provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ pending: '2', approved: '1', rejected: '0', total: '3' }],
      });

      const result = await service.getStats(42);

      expect(result.total).toBe(3);

      const call = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(call[1]).toContain(42);
      expect(call[0]).toContain('assigned_to');
    });

    it('should not filter by userId when omitted', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ pending: '0', approved: '0', rejected: '0', total: '0' }],
      });

      await service.getStats();

      const call = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(call[1]).toEqual([]);
    });

    it('should handle undefined row gracefully', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [undefined] });

      const result = await service.getStats();

      expect(result.pending).toBe(0);
      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // =============================================================
  // Edge cases — shared decide() logic
  // =============================================================

  describe('decide() edge cases', () => {
    it('should throw when re-fetch after UPDATE fails', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // re-fetch returns nothing

      await expect(service.approve('test-uuid', 10, 20)).rejects.toThrow(
        'Re-fetch after update failed',
      );
    });

    it('should use FOR UPDATE lock in SELECT', async () => {
      const pendingRow = makeApprovalRow({
        status: 'pending',
        requested_by: 5,
      });
      const approvedRow = makeApprovalListRow({ status: 'approved' });

      mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [approvedRow] });

      await service.approve('test-uuid', 10, 20);

      const selectCall = mockClient.query.mock.calls[0] as [string, unknown[]];
      expect(selectCall[0]).toContain('FOR UPDATE');
    });

    it('should reject approval of already-approved request via reject()', async () => {
      const approvedRow = makeApprovalRow({
        status: 'approved',
        requested_by: 5,
      });
      mockClient.query.mockResolvedValueOnce({ rows: [approvedRow] });

      await expect(service.reject('test-uuid', 10, 20, 'Too late')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
