/**
 * Unit tests for TpmExecutionsService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction),
 * TpmCardStatusService (markCardCompleted), ActivityLoggerService.
 * Tests: createExecution (Flow A no-approval, Flow B approval, documentation
 * validation, activity logger), getExecution (found/not found),
 * listExecutionsForCard, listPendingApprovals, addPhoto (max 5 limit),
 * getPhotos.
 *
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { TpmCardStatusService } from './tpm-card-status.service.js';
import type { TpmExecutionJoinRow } from './tpm-executions.helpers.js';
import { TpmExecutionsService } from './tpm-executions.service.js';
import type { TpmNotificationService } from './tpm-notification.service.js';
import type { TpmSchedulingService } from './tpm-scheduling.service.js';
import type {
  TpmCardExecutionPhotoRow,
  TpmCardRow,
  TpmDefectPhotoRow,
  TpmExecutionDefectRow,
} from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockCardStatusService() {
  return {
    markCardCompleted: vi.fn(),
  };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockNotificationService() {
  return {
    notifyMaintenanceCompleted: vi.fn(),
    notifyApprovalRequired: vi.fn(),
  };
}

function createCardRow(overrides?: Partial<TpmCardRow>): TpmCardRow {
  return {
    id: 1,
    uuid: 'card-uuid-001                            ',
    tenant_id: 10,
    plan_id: 100,
    machine_id: 42,
    template_id: null,
    card_code: 'BT1',
    card_role: 'operator',
    interval_type: 'weekly',
    interval_order: 2,
    title: 'Sichtprüfung',
    description: null,
    location_description: null,
    location_photo_url: null,
    requires_approval: false,
    status: 'red',
    current_due_date: '2026-03-01',
    last_completed_at: null,
    last_completed_by: null,
    sort_order: 1,
    custom_fields: {},
    custom_interval_days: null,
    is_active: 1,
    created_by: 5,
    created_at: '2026-02-18T00:00:00.000Z',
    updated_at: '2026-02-18T00:00:00.000Z',
    ...overrides,
  };
}

function createExecutionRow(
  overrides?: Partial<TpmExecutionJoinRow>,
): TpmExecutionJoinRow {
  return {
    id: 1,
    uuid: 'exec-uuid-001                            ',
    tenant_id: 10,
    card_id: 1,
    executed_by: 7,
    execution_date: '2026-03-01',
    documentation: 'Alles geprüft, keine Auffälligkeiten',
    approval_status: 'none',
    approved_by: null,
    approved_at: null,
    approval_note: null,
    custom_data: {},
    no_issues_found: true,
    actual_duration_minutes: null,
    actual_staff_count: null,
    created_at: '2026-03-01T08:30:00.000Z',
    updated_at: '2026-03-01T08:30:00.000Z',
    card_uuid: 'card-uuid-001                            ',
    executed_by_name: 'Max Mustermann',
    approved_by_name: undefined,
    photo_count: 0,
    ...overrides,
  };
}

function createPhotoRow(
  overrides?: Partial<TpmCardExecutionPhotoRow>,
): TpmCardExecutionPhotoRow {
  return {
    id: 1,
    uuid: 'photo-uuid-001                           ',
    tenant_id: 10,
    execution_id: 1,
    file_path: '/uploads/tpm/photo1.jpg',
    file_name: 'photo1.jpg',
    file_size: 2_000_000,
    mime_type: 'image/jpeg',
    sort_order: 0,
    created_at: '2026-03-01T08:31:00.000Z',
    ...overrides,
  };
}

function createDefectRow(
  overrides?: Partial<TpmExecutionDefectRow>,
): TpmExecutionDefectRow {
  return {
    id: 5,
    uuid: 'defect-uuid-001                          ',
    tenant_id: 10,
    execution_id: 1,
    title: 'Leckage am Ventil',
    description: null,
    position_number: 1,
    is_active: 1,
    created_at: '2026-03-02T10:00:00.000Z',
    updated_at: '2026-03-02T10:00:00.000Z',
    ...overrides,
  };
}

function createDefectPhotoRow(
  overrides?: Partial<TpmDefectPhotoRow>,
): TpmDefectPhotoRow {
  return {
    id: 1,
    uuid: 'defect-photo-uuid-001                    ',
    tenant_id: 10,
    defect_id: 5,
    file_path: '/uploads/tpm/10/defects/abc/photo.jpg',
    file_name: 'riss.jpg',
    file_size: 2_500_000,
    mime_type: 'image/jpeg',
    sort_order: 0,
    created_at: '2026-03-02T10:05:00.000Z',
    ...overrides,
  };
}

// =============================================================
// TpmExecutionsService
// =============================================================

describe('TpmExecutionsService', () => {
  let service: TpmExecutionsService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockCardStatusService: ReturnType<typeof createMockCardStatusService>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  const mockSchedulingService = {
    advanceSchedule: vi.fn().mockResolvedValue('2026-04-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockCardStatusService = createMockCardStatusService();
    mockActivityLogger = createMockActivityLogger();
    mockNotificationService = createMockNotificationService();

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmExecutionsService(
      mockDb as unknown as DatabaseService,
      mockCardStatusService as unknown as TpmCardStatusService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockNotificationService as unknown as TpmNotificationService,
      mockSchedulingService as unknown as TpmSchedulingService,
    );
  });

  // =============================================================
  // createExecution
  // =============================================================

  describe('createExecution()', () => {
    /** Zod default fields that unit tests must provide (bypassing validation) */
    const dtoDefaults = { customData: {}, defects: [] } as const;

    it('should create execution with Flow A (no approval)', async () => {
      // lockCardByUuid
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      // markCardCompleted → Flow A
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      // insertExecution
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'none' })],
      });

      const result = await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
      });

      expect(result.uuid).toBe('exec-uuid-001');
      expect(result.approvalStatus).toBe('none');
    });

    it('should create execution with Flow B (approval required)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: true })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'yellow',
        requiresApproval: true,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });

      const result = await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
        documentation: 'Durchführungsbericht',
      });

      expect(result.approvalStatus).toBe('pending');
    });

    it('should throw BadRequestException when approval card has issues but no documentation', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: true })],
      });

      await expect(
        service.createExecution(10, 'card-uuid-001', 7, {
          ...dtoDefaults,
          noIssuesFound: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty documentation string when issues found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: true })],
      });

      await expect(
        service.createExecution(10, 'card-uuid-001', 7, {
          ...dtoDefaults,
          noIssuesFound: false,
          documentation: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow approval card without documentation when noIssuesFound is true', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: true })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'yellow',
        requiresApproval: true,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'pending' })],
      });

      const result = await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
        noIssuesFound: true,
      });

      expect(result.approvalStatus).toBe('pending');
    });

    it('should pass enhanced fields through to INSERT', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createExecutionRow({
            no_issues_found: true,
            actual_duration_minutes: 45,
            actual_staff_count: 2,
          }),
        ],
      });

      await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
        executionDate: '2026-02-20',
        noIssuesFound: true,
        actualDurationMinutes: 45,
        actualStaffCount: 2,
      });

      // INSERT is the 2nd call (index 1): [0]=lockCardByUuid, [1]=INSERT
      const insertParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(insertParams?.[4]).toBe('2026-02-20'); // executionDate
      expect(insertParams?.[8]).toBe(true); // no_issues_found
      expect(insertParams?.[9]).toBe(45); // actual_duration_minutes
      expect(insertParams?.[10]).toBe(2); // actual_staff_count
    });

    it('should throw NotFoundException when card not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createExecution(10, 'nonexistent', 7, { ...dtoDefaults }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call activity logger after successful creation', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red' })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow()],
      });

      await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
      });

      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        7,
        'tpm_execution',
        42,
        expect.stringContaining('card-uuid-001'),
        expect.objectContaining({ executionUuid: 'exec-uuid-001' }),
      );
    });

    it('should use FOR UPDATE lock on card', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red' })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow()],
      });

      await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
      });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });

    it('should insert participants when participantUuids provided', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      // INSERT execution
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'none' })],
      });
      // SELECT users by UUID
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            uuid: 'user-uuid-001                            ',
            first_name: 'Max',
            last_name: 'Müller',
          },
          {
            id: 11,
            uuid: 'user-uuid-002                            ',
            first_name: 'Anna',
            last_name: 'Schmidt',
          },
        ],
      });
      // INSERT participants
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
        participantUuids: ['user-uuid-001', 'user-uuid-002'],
      });

      expect(result.participants).toHaveLength(2);
      expect(result.participants?.[0]?.firstName).toBe('Max');
      expect(result.participants?.[1]?.lastName).toBe('Schmidt');

      // Verify INSERT into tpm_execution_participants
      const insertSql = mockClient.query.mock.calls[3]?.[0] as string;
      expect(insertSql).toContain('tpm_execution_participants');
    });

    it('should skip participant insertion when participantUuids is empty', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'none' })],
      });

      const result = await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
        participantUuids: [],
      });

      // Only 2 client.query calls: lockCard + INSERT execution
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(result.participants).toBeUndefined();
    });

    it('should return empty participants when no matching users found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      mockCardStatusService.markCardCompleted.mockResolvedValueOnce({
        targetStatus: 'green',
        requiresApproval: false,
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow({ approval_status: 'none' })],
      });
      // SELECT users returns empty (UUIDs unknown)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.createExecution(10, 'card-uuid-001', 7, {
        ...dtoDefaults,
        participantUuids: ['nonexistent-uuid'],
      });

      // No INSERT participants call (3 total: lock + exec INSERT + user SELECT)
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result.participants).toEqual([]);
    });
  });

  // =============================================================
  // getExecution
  // =============================================================

  describe('getExecution()', () => {
    it('should return a mapped execution', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createExecutionRow());

      const result = await service.getExecution(10, 'exec-uuid-001');

      expect(result.uuid).toBe('exec-uuid-001');
      expect(result.executedBy).toBe(7);
      expect(result.cardUuid).toBe('card-uuid-001');
    });

    it('should map photoCount and executedByName from join row', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createExecutionRow({
          photo_count: 3,
          executed_by_name: 'Warren Buffett',
          approved_by_name: 'Charlie Munger',
          approval_status: 'approved',
        }),
      );

      const result = await service.getExecution(10, 'exec-uuid-001');

      expect(result.photoCount).toBe(3);
      expect(result.executedByName).toBe('Warren Buffett');
      expect(result.approvedByName).toBe('Charlie Munger');
    });

    it('should map enhanced fields (noIssuesFound, duration, staff)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createExecutionRow({
          no_issues_found: false,
          actual_duration_minutes: 30,
          actual_staff_count: 3,
        }),
      );

      const result = await service.getExecution(10, 'exec-uuid-001');

      expect(result.noIssuesFound).toBe(false);
      expect(result.actualDurationMinutes).toBe(30);
      expect(result.actualStaffCount).toBe(3);
    });

    it('should map participants from join row', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        createExecutionRow({
          participants: [
            { uuid: 'user-uuid-001', firstName: 'Max', lastName: 'Müller' },
            { uuid: 'user-uuid-002', firstName: 'Anna', lastName: 'Schmidt' },
          ],
        }),
      );

      const result = await service.getExecution(10, 'exec-uuid-001');

      expect(result.participants).toHaveLength(2);
      expect(result.participants?.[0]?.firstName).toBe('Max');
      expect(result.participants?.[1]?.uuid).toBe('user-uuid-002');
    });

    it('should omit participants when not present in row', async () => {
      const row = createExecutionRow();
      delete row.participants;
      mockDb.queryOne.mockResolvedValueOnce(row);

      const result = await service.getExecution(10, 'exec-uuid-001');

      expect(result.participants).toBeUndefined();
    });

    it('should omit photoCount when not present in row', async () => {
      const row = createExecutionRow();
      delete row.photo_count;
      mockDb.queryOne.mockResolvedValueOnce(row);

      const result = await service.getExecution(10, 'exec-uuid-001');

      expect(result.photoCount).toBeUndefined();
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.getExecution(10, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // listExecutionsForCard
  // =============================================================

  describe('listExecutionsForCard()', () => {
    it('should return paginated executions', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '5' });
      mockDb.query.mockResolvedValueOnce([
        createExecutionRow(),
        createExecutionRow({ id: 2, uuid: 'exec-uuid-002' }),
      ]);

      const result = await service.listExecutionsForCard(
        10,
        'card-uuid-001',
        1,
        20,
      );

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should handle empty result', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '0' });
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listExecutionsForCard(
        10,
        'card-uuid-001',
        1,
        20,
      );

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  // =============================================================
  // listPendingApprovals
  // =============================================================

  describe('listPendingApprovals()', () => {
    it('should return pending executions paginated', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ count: '3' });
      mockDb.query.mockResolvedValueOnce([
        createExecutionRow({ approval_status: 'pending' }),
      ]);

      const result = await service.listPendingApprovals(10, 1, 20);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(1);
    });

    it('should handle null count result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.listPendingApprovals(10, 1, 20);

      expect(result.total).toBe(0);
    });
  });

  // =============================================================
  // addPhoto
  // =============================================================

  describe('addPhoto()', () => {
    it('should add a photo to an execution', async () => {
      // lockExecutionByUuid
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow()],
      });
      // getPhotoCount → 2
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });
      // INSERT photo
      mockClient.query.mockResolvedValueOnce({
        rows: [createPhotoRow()],
      });

      const result = await service.addPhoto(10, 'exec-uuid-001', 1, {
        filePath: '/uploads/tpm/photo1.jpg',
        fileName: 'photo1.jpg',
        fileSize: 2_000_000,
        mimeType: 'image/jpeg',
      });

      expect(result.uuid).toBe('photo-uuid-001');
      expect(result.fileName).toBe('photo1.jpg');
    });

    it('should throw BadRequestException when photo limit exceeded (max 5)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow()],
      });
      // Already 5 photos
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      await expect(
        service.addPhoto(10, 'exec-uuid-001', 1, {
          filePath: '/uploads/tpm/photo6.jpg',
          fileName: 'photo6.jpg',
          fileSize: 1_000_000,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when execution not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.addPhoto(10, 'nonexistent', 1, {
          filePath: '/uploads/tpm/photo.jpg',
          fileName: 'photo.jpg',
          fileSize: 1_000_000,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use sort_order based on current photo count', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createExecutionRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createPhotoRow({ sort_order: 3 })],
      });

      await service.addPhoto(10, 'exec-uuid-001', 1, {
        filePath: '/uploads/tpm/photo4.jpg',
        fileName: 'photo4.jpg',
        fileSize: 1_000_000,
        mimeType: 'image/jpeg',
      });

      // INSERT params: sort_order is at index 7 (0-based)
      const insertParams = mockClient.query.mock.calls[2]?.[1] as unknown[];
      expect(insertParams?.[7]).toBe(3);
    });
  });

  // =============================================================
  // getPhotos
  // =============================================================

  describe('getPhotos()', () => {
    it('should return photos sorted by sort_order', async () => {
      mockDb.query.mockResolvedValueOnce([
        createPhotoRow({ sort_order: 0 }),
        createPhotoRow({ id: 2, sort_order: 1 }),
      ]);

      const result = await service.getPhotos(10, 'exec-uuid-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.sortOrder).toBe(0);
    });

    it('should return empty array when no photos', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getPhotos(10, 'exec-uuid-001');

      expect(result).toHaveLength(0);
    });
  });

  // =============================================================
  // addDefectPhoto
  // =============================================================

  describe('addDefectPhoto()', () => {
    it('should add a photo to a defect', async () => {
      // lockDefectByUuid
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectRow()],
      });
      // getDefectPhotoCount → 2
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });
      // INSERT photo
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectPhotoRow()],
      });

      const result = await service.addDefectPhoto(10, 'defect-uuid-001', 7, {
        filePath: '/uploads/tpm/10/defects/abc/photo.jpg',
        fileName: 'riss.jpg',
        fileSize: 2_500_000,
        mimeType: 'image/jpeg',
      });

      expect(result.uuid).toBe('defect-photo-uuid-001');
      expect(result.fileName).toBe('riss.jpg');
      expect(result.fileSize).toBe(2_500_000);
    });

    it('should throw BadRequestException when photo limit exceeded (max 5)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectRow()],
      });
      // Already 5 photos
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      await expect(
        service.addDefectPhoto(10, 'defect-uuid-001', 7, {
          filePath: '/uploads/tpm/10/defects/abc/photo6.jpg',
          fileName: 'photo6.jpg',
          fileSize: 1_000_000,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when defect not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.addDefectPhoto(10, 'nonexistent', 7, {
          filePath: '/uploads/tpm/photo.jpg',
          fileName: 'photo.jpg',
          fileSize: 1_000_000,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use sort_order based on current photo count', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectPhotoRow({ sort_order: 3 })],
      });

      await service.addDefectPhoto(10, 'defect-uuid-001', 7, {
        filePath: '/uploads/tpm/10/defects/abc/photo4.jpg',
        fileName: 'photo4.jpg',
        fileSize: 1_000_000,
        mimeType: 'image/jpeg',
      });

      // INSERT params: sort_order is at index 7 (0-based)
      const insertParams = mockClient.query.mock.calls[2]?.[1] as unknown[];
      expect(insertParams?.[7]).toBe(3);
    });

    it('should use FOR UPDATE lock on defect', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectRow()],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [createDefectPhotoRow()],
      });

      await service.addDefectPhoto(10, 'defect-uuid-001', 7, {
        filePath: '/uploads/tpm/photo.jpg',
        fileName: 'photo.jpg',
        fileSize: 1_000_000,
        mimeType: 'image/jpeg',
      });

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
      expect(lockSql).toContain('tpm_execution_defects');
    });
  });

  // =============================================================
  // getDefectPhotos
  // =============================================================

  describe('getDefectPhotos()', () => {
    it('should return photos sorted by sort_order', async () => {
      mockDb.query.mockResolvedValueOnce([
        createDefectPhotoRow({ sort_order: 0 }),
        createDefectPhotoRow({ id: 2, sort_order: 1 }),
      ]);

      const result = await service.getDefectPhotos(10, 'defect-uuid-001');

      expect(result).toHaveLength(2);
      expect(result[0]?.sortOrder).toBe(0);
      expect(result[1]?.sortOrder).toBe(1);
    });

    it('should return empty array when no photos', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDefectPhotos(10, 'defect-uuid-001');

      expect(result).toHaveLength(0);
    });

    it('should map defect photo fields correctly', async () => {
      mockDb.query.mockResolvedValueOnce([createDefectPhotoRow()]);

      const result = await service.getDefectPhotos(10, 'defect-uuid-001');

      expect(result[0]?.uuid).toBe('defect-photo-uuid-001');
      expect(result[0]?.fileName).toBe('riss.jpg');
      expect(result[0]?.mimeType).toBe('image/jpeg');
      expect(result[0]?.fileSize).toBe(2_500_000);
    });
  });
});
