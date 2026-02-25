/**
 * Unit tests for TpmCardStatusService
 *
 * Tests the complete card status state machine:
 *   green   → red     (setCardDue)
 *   red     → green   (markCardCompleted, Flow A — no approval)
 *   red     → yellow  (markCardCompleted, Flow B — approval required)
 *   red     → overdue (markCardOverdue)
 *   yellow  → green   (approveCard)
 *   yellow  → red     (rejectCard)
 *   overdue → green   (markCardCompleted, Flow A)
 *   overdue → yellow  (markCardCompleted, Flow B)
 *
 * Mocked: PoolClient with query() mock.
 * Every method receives a client for transaction composability.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TpmCardStatusService } from './tpm-card-status.service.js';
import type { TpmCardRow } from './tpm.types.js';

// =============================================================
// Mock factories
// =============================================================

function createMockClient() {
  return { query: vi.fn() };
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
    status: 'green',
    current_due_date: null,
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

// =============================================================
// TpmCardStatusService
// =============================================================

describe('TpmCardStatusService', () => {
  let service: TpmCardStatusService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    service = new TpmCardStatusService();
  });

  // =============================================================
  // setCardDue (green → red)
  // =============================================================

  describe('setCardDue()', () => {
    it('should transition green → red with due date', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'green' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.setCardDue(mockClient, 10, 1, new Date('2026-03-01'));

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain("status = 'red'");
      expect(updateSql).toContain('current_due_date');

      const updateParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(updateParams?.[0]).toBe('2026-03-01');
    });

    it('should throw BadRequestException for red → red', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red' })],
      });

      await expect(
        service.setCardDue(mockClient, 10, 1, new Date('2026-03-01')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow yellow → red transition (valid per state machine)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'yellow' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.setCardDue(mockClient, 10, 1, new Date('2026-03-01')),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException for overdue → red via setCardDue', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'overdue' })],
      });

      await expect(
        service.setCardDue(mockClient, 10, 1, new Date('2026-03-01')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when card not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.setCardDue(mockClient, 10, 999, new Date('2026-03-01')),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use FOR UPDATE lock', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'green' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.setCardDue(mockClient, 10, 1, new Date('2026-03-01'));

      const lockSql = mockClient.query.mock.calls[0]?.[0] as string;
      expect(lockSql).toContain('FOR UPDATE');
    });
  });

  // =============================================================
  // markCardCompleted
  // =============================================================

  describe('markCardCompleted()', () => {
    it('should transition red → green (Flow A, no approval)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.markCardCompleted(mockClient, 10, 1, 7);

      expect(result.targetStatus).toBe('green');
      expect(result.requiresApproval).toBe(false);

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain("status = 'green'");
      expect(updateSql).toContain('last_completed_at');
      expect(updateSql).toContain('last_completed_by');
      expect(updateSql).toContain('current_due_date = NULL');
    });

    it('should transition red → yellow (Flow B, approval required)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: true })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.markCardCompleted(mockClient, 10, 1, 7);

      expect(result.targetStatus).toBe('yellow');
      expect(result.requiresApproval).toBe(true);

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain("status = 'yellow'");
    });

    it('should transition overdue → green (Flow A)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'overdue', requires_approval: false })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.markCardCompleted(mockClient, 10, 1, 7);

      expect(result.targetStatus).toBe('green');
      expect(result.requiresApproval).toBe(false);
    });

    it('should transition overdue → yellow (Flow B)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'overdue', requires_approval: true })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.markCardCompleted(mockClient, 10, 1, 7);

      expect(result.targetStatus).toBe('yellow');
      expect(result.requiresApproval).toBe(true);
    });

    it('should throw BadRequestException for green → complete', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'green' })],
      });

      await expect(
        service.markCardCompleted(mockClient, 10, 1, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for yellow → complete', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'yellow' })],
      });

      await expect(
        service.markCardCompleted(mockClient, 10, 1, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set userId in last_completed_by for Flow A', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red', requires_approval: false })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.markCardCompleted(mockClient, 10, 1, 42);

      const updateParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(updateParams?.[0]).toBe(42);
    });
  });

  // =============================================================
  // markCardOverdue (red → overdue)
  // =============================================================

  describe('markCardOverdue()', () => {
    it('should transition red → overdue', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'red' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.markCardOverdue(mockClient, 10, 1);

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain("status = 'overdue'");
    });

    it('should throw BadRequestException for green → overdue', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'green' })],
      });

      await expect(service.markCardOverdue(mockClient, 10, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for yellow → overdue', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'yellow' })],
      });

      await expect(service.markCardOverdue(mockClient, 10, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =============================================================
  // approveCard (yellow → green)
  // =============================================================

  describe('approveCard()', () => {
    it('should transition yellow → green with last_completed_by and clear due date', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'yellow' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.approveCard(mockClient, 10, 1, 7);

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain("status = 'green'");
      expect(updateSql).toContain('last_completed_by');
      expect(updateSql).toContain('current_due_date = NULL');

      const updateParams = mockClient.query.mock.calls[1]?.[1] as unknown[];
      expect(updateParams?.[0]).toBe(7);
    });

    it('should throw BadRequestException for green → green (self-transition invalid)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'green' })],
      });

      await expect(service.approveCard(mockClient, 10, 1, 7)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when card not found during approve', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.approveCard(mockClient, 10, 999, 7)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // rejectCard (yellow → red)
  // =============================================================

  describe('rejectCard()', () => {
    it('should transition yellow → red', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'yellow' })],
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.rejectCard(mockClient, 10, 1);

      const updateSql = mockClient.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain("status = 'red'");
    });

    it('should throw BadRequestException for overdue → red via reject', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [createCardRow({ status: 'overdue' })],
      });

      await expect(service.rejectCard(mockClient, 10, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when card not found during reject', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.rejectCard(mockClient, 10, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
