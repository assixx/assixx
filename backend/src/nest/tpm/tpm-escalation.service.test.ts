/**
 * Unit tests for TpmEscalationService
 *
 * Mocked dependencies: DatabaseService (query, queryOne, tenantTransaction,
 * transaction), TpmCardStatusService (markCardOverdue),
 * TpmNotificationService (notifyMaintenanceOverdue).
 *
 * Tests: getConfig (DB + defaults), updateConfig (UPSERT),
 * handleEscalation/processOverdueCards (isProcessing guard, candidates,
 * FOR UPDATE SKIP LOCKED, escalation flow, team lead resolution),
 * onModuleInit (startup recovery).
 *
 * Pattern: transaction callback receives mockClient with query() mock.
 * Escalation is system-level (no RLS) — uses db.transaction not tenantTransaction.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { TpmCardStatusService } from './tpm-card-status.service.js';
import { TpmEscalationService } from './tpm-escalation.service.js';
import type { TpmNotificationService } from './tpm-notification.service.js';
import type { TpmEscalationConfigRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const qf = vi.fn().mockResolvedValue([]);
  const qof = vi.fn().mockResolvedValue(null);
  return {
    query: qf,
    tenantQuery: qf,
    queryOne: qof,
    tenantQueryOne: qof,
    systemQuery: vi.fn().mockResolvedValue([]),
    systemQueryOne: vi.fn().mockResolvedValue(null),
    tenantTransaction: vi.fn(),
    transaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

function createMockCardStatusService() {
  return {
    markCardOverdue: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockNotificationService() {
  return {
    notifyMaintenanceOverdue: vi.fn(),
  };
}

function createConfigRow(overrides?: Partial<TpmEscalationConfigRow>): TpmEscalationConfigRow {
  return {
    id: 1,
    tenant_id: 10,
    escalation_after_hours: 24,
    notify_team_lead: true,
    notify_department_lead: true,
    created_at: '2026-02-19T10:00:00.000Z',
    updated_at: '2026-02-19T10:00:00.000Z',
    ...overrides,
  };
}

interface OverdueCandidate {
  id: number;
  uuid: string;
  tenant_id: number;
  card_code: string;
  title: string;
  asset_id: number;
  asset_name: string | null;
  interval_type: string;
  status: string;
}

function createOverdueCandidate(overrides?: Partial<OverdueCandidate>): OverdueCandidate {
  return {
    id: 100,
    uuid: 'card-uuid-overdue-001',
    tenant_id: 10,
    card_code: 'BW5',
    title: 'Ölstand prüfen',
    asset_id: 42,
    asset_name: 'Presse P17',
    interval_type: 'weekly',
    status: 'red',
    ...overrides,
  };
}

// =============================================================
// TpmEscalationService
// =============================================================

describe('TpmEscalationService', () => {
  let service: TpmEscalationService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let mockCardStatusService: ReturnType<typeof createMockCardStatusService>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  const mockActivityLogger = {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };
    mockCardStatusService = createMockCardStatusService();
    mockNotificationService = createMockNotificationService();

    mockDb.transaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new TpmEscalationService(
      mockDb as unknown as DatabaseService,
      mockCardStatusService as unknown as TpmCardStatusService,
      mockNotificationService as unknown as TpmNotificationService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getConfig
  // =============================================================

  describe('getConfig()', () => {
    it('should return config from DB when row exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce(createConfigRow());

      const config = await service.getConfig(10);

      expect(config.escalationAfterHours).toBe(24);
      expect(config.notifyTeamLead).toBe(true);
      expect(config.notifyDepartmentLead).toBe(true);
      expect(config.createdAt).toBe('2026-02-19T10:00:00.000Z');
    });

    it('should return default config when no row exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const config = await service.getConfig(10);

      expect(config.escalationAfterHours).toBe(48);
      expect(config.notifyTeamLead).toBe(true);
      expect(config.notifyDepartmentLead).toBe(false);
    });

    it('should query with correct tenantId', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await service.getConfig(99);

      const params = mockDb.queryOne.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(99);
    });
  });

  // =============================================================
  // updateConfig
  // =============================================================

  describe('updateConfig()', () => {
    it('should UPSERT config and return mapped result', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          createConfigRow({
            escalation_after_hours: 72,
            notify_department_lead: true,
          }),
        ],
      });

      const result = await service.updateConfig(10, 1, {
        escalationAfterHours: 72,
        notifyTeamLead: true,
        notifyDepartmentLead: true,
      });

      expect(result.escalationAfterHours).toBe(72);
      expect(result.notifyDepartmentLead).toBe(true);
    });

    it('should use ON CONFLICT DO UPDATE in SQL', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createConfigRow()],
      });

      await service.updateConfig(10, 1, {
        escalationAfterHours: 24,
        notifyTeamLead: true,
      });

      const sql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
      expect(sql).toContain('RETURNING');
    });

    it('should use tenantTransaction for mutation', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createConfigRow()],
      });

      await service.updateConfig(10, 1, {
        escalationAfterHours: 24,
      });

      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    });

    it('should throw when UPSERT returns no rows', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateConfig(10, 1, { escalationAfterHours: 24 })).rejects.toThrow(
        'UPSERT tpm_escalation_config returned no rows',
      );
    });

    it('should default notifyTeamLead to true and notifyDepartmentLead to false', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createConfigRow()],
      });

      await service.updateConfig(10, 1, {
        escalationAfterHours: 48,
      });

      const params = mockClient.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[2]).toBe(true); // notifyTeamLead default
      expect(params?.[3]).toBe(false); // notifyDepartmentLead default
    });
  });

  // =============================================================
  // handleEscalation / processOverdueCards
  // =============================================================

  describe('handleEscalation()', () => {
    it('should find overdue candidates via SQL query', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await service.handleEscalation();

      const sql = mockDb.systemQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain("status = 'red'");
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
      expect(sql).toContain('current_due_date');
      expect(sql).toContain('make_interval');
    });

    it('should do nothing when no candidates found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await service.handleEscalation();

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockCardStatusService.markCardOverdue).not.toHaveBeenCalled();
    });

    it('should escalate each candidate card', async () => {
      const candidates = [
        createOverdueCandidate({ id: 100 }),
        createOverdueCandidate({ id: 200, card_code: 'BW3' }),
      ];
      mockDb.systemQuery.mockResolvedValueOnce(candidates);

      // Per candidate: FOR UPDATE SKIP LOCKED → found
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 100 }],
      });
      // resolveTeamLead for candidate 1
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });
      // FOR UPDATE SKIP LOCKED → found (candidate 2)
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 200 }],
      });
      // resolveTeamLead for candidate 2
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      expect(mockCardStatusService.markCardOverdue).toHaveBeenCalledTimes(2);
    });

    it('should use FOR UPDATE SKIP LOCKED when locking card', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE SKIP LOCKED');
    });

    it('should call markCardOverdue with correct params', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([
        createOverdueCandidate({ id: 100, tenant_id: 10 }),
      ]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      expect(mockCardStatusService.markCardOverdue).toHaveBeenCalledWith(mockClient, 10, 100);
    });

    it('should notify team lead after successful escalation', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      expect(mockNotificationService.notifyMaintenanceOverdue).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          uuid: 'card-uuid-overdue-001',
          cardCode: 'BW5',
          status: 'overdue',
        }),
        5,
      );
    });

    it('should skip notification when no team lead found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce(null);

      await service.handleEscalation();

      expect(mockNotificationService.notifyMaintenanceOverdue).not.toHaveBeenCalled();
    });

    it('should skip card when already locked by another instance', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      // SKIP LOCKED → no row returned (another instance holds the lock)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.handleEscalation();

      expect(mockCardStatusService.markCardOverdue).not.toHaveBeenCalled();
      expect(mockNotificationService.notifyMaintenanceOverdue).not.toHaveBeenCalled();
    });

    it('should skip when isProcessing is true', async () => {
      // Simulate isProcessing = true via reflection
      (service as unknown as { isProcessing: boolean }).isProcessing = true;

      await service.handleEscalation();

      expect(mockDb.systemQuery).not.toHaveBeenCalled();
    });

    it('should reset isProcessing after error in processing', async () => {
      mockDb.systemQuery.mockRejectedValueOnce(new Error('DB down'));

      await service.handleEscalation();

      // isProcessing should be false after error
      const isProcessing = (service as unknown as { isProcessing: boolean }).isProcessing;
      expect(isProcessing).toBe(false);
    });

    it('should continue processing other candidates when one fails', async () => {
      const candidates = [
        createOverdueCandidate({ id: 100 }),
        createOverdueCandidate({ id: 200, card_code: 'IV7' }),
      ];
      mockDb.systemQuery.mockResolvedValueOnce(candidates);

      // First card: lock fails with error
      mockDb.transaction.mockRejectedValueOnce(new Error('Lock failed'));
      // Restore normal transaction for second card
      mockDb.transaction.mockImplementationOnce(
        async (callback: (client: typeof mockClient) => Promise<unknown>) => {
          return await callback(mockClient);
        },
      );
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 200 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      expect(mockCardStatusService.markCardOverdue).toHaveBeenCalledTimes(1);
      expect(mockCardStatusService.markCardOverdue).toHaveBeenCalledWith(mockClient, 10, 200);
    });

    it('should include assetName in notification card when available', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([
        createOverdueCandidate({ asset_name: 'Fräse F9' }),
      ]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      const notificationCard = mockNotificationService.notifyMaintenanceOverdue.mock
        .calls[0]?.[1] as Record<string, unknown>;
      expect(notificationCard.assetName).toBe('Fräse F9');
    });

    it('should omit assetName from notification card when null', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate({ asset_name: null })]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      const notificationCard = mockNotificationService.notifyMaintenanceOverdue.mock
        .calls[0]?.[1] as Record<string, unknown>;
      expect(notificationCard).not.toHaveProperty('assetName');
    });
  });

  // =============================================================
  // onModuleInit (startup recovery)
  // =============================================================

  describe('onModuleInit()', () => {
    it('should call processOverdueCards on startup', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.onModuleInit();

      expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
      expect(mockCardStatusService.markCardOverdue).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // resolveTeamLead (tested through handleEscalation)
  // =============================================================

  describe('resolveTeamLead()', () => {
    it('should query teams + asset_teams for team lead', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain('teams');
      expect(sql).toContain('asset_teams');
      expect(sql).toContain('team_lead_id');
    });

    it('should filter for active teams only', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([createOverdueCandidate()]);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
      mockDb.queryOne.mockResolvedValueOnce({ team_lead_id: 5 });

      await service.handleEscalation();

      const sql = mockDb.queryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });
  });
});
