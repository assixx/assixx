/**
 * Vacation Approver Service – Unit Tests
 *
 * Approver determination: employee→lead, absent lead→deputy, IS lead→escalate,
 * admin→area_lead, root→auto, area-lead→auto, no team→BadRequest, no lead→BadRequest.
 *
 * Mocked dependencies: DatabaseService (tenantTransaction).
 * Pattern: tenantTransaction callback receives mockClient with query() mock.
 */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { VacationApproverService } from './vacation-approver.service.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Test Suite
// =============================================================

describe('VacationApproverService', () => {
  let service: VacationApproverService;
  let mockDb: MockDb;
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockClient = { query: vi.fn() };

    mockDb.tenantTransaction.mockImplementation(
      async (callback: (client: typeof mockClient) => Promise<unknown>) => {
        return await callback(mockClient);
      },
    );

    service = new VacationApproverService(mockDb as unknown as DatabaseService);
  });

  // -----------------------------------------------------------
  // getApprover — Approver determination
  // -----------------------------------------------------------

  describe('getApprover()', () => {
    it('should return team_lead for employee', async () => {
      // isUserAreaLead → false
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      // getUserRole → employee
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5, role: 'employee' }],
      });
      // getUserTeamInfo → team with lead
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            team_deputy_lead_id: 11,
            department_id: 1,
          },
        ],
      });
      // isUserAbsent(lead) → false
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });

      const result = await service.getApprover(1, 5);

      expect(result.approverId).toBe(10);
      expect(result.autoApproved).toBe(false);
    });

    it('should return deputy_lead when lead is absent', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5, role: 'employee' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            team_deputy_lead_id: 11,
            department_id: 1,
          },
        ],
      });
      // lead IS absent
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: true }] });
      // deputy is NOT absent
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });

      const result = await service.getApprover(1, 5);

      expect(result.approverId).toBe(11);
      expect(result.autoApproved).toBe(false);
    });

    it('should assign deputy when employee IS team_lead (self-approval prevention)', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 10, role: 'employee' }],
      });
      // getUserTeamInfo → requester IS the team_lead, deputy exists
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            team_deputy_lead_id: 11,
            department_id: 1,
          },
        ],
      });

      const result = await service.getApprover(1, 10);

      // Deputy approves (lead cannot self-approve)
      expect(result.approverId).toBe(11);
      expect(result.autoApproved).toBe(false);
    });

    it('should return area_lead for admin', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 20, role: 'admin' }],
      });
      // resolveAreaLeadOrAutoApprove → area lead exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ area_lead_id: 99 }],
      });

      const result = await service.getApprover(1, 20);

      expect(result.approverId).toBe(99);
      expect(result.autoApproved).toBe(false);
    });

    it('should auto-approve for root', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, role: 'root' }],
      });

      const result = await service.getApprover(1, 1);

      expect(result.approverId).toBeNull();
      expect(result.autoApproved).toBe(true);
    });

    it('should auto-approve for area_lead user', async () => {
      // isUserAreaLead → true
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: true }] });

      const result = await service.getApprover(1, 50);

      expect(result.approverId).toBeNull();
      expect(result.autoApproved).toBe(true);
    });

    it('should auto-approve admin when no area_lead found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 20, role: 'admin' }],
      });
      // resolveAreaLeadOrAutoApprove → no area lead
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getApprover(1, 20);

      expect(result.approverId).toBeNull();
      expect(result.autoApproved).toBe(true);
    });

    it('should throw BadRequestException when employee has no team', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5, role: 'employee' }],
      });
      // getUserTeamInfo → no team
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getApprover(1, 5)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when team has no lead', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5, role: 'employee' }],
      });
      // team with no lead
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: null,
            team_deputy_lead_id: null,
            department_id: 1,
          },
        ],
      });

      await expect(service.getApprover(1, 5)).rejects.toThrow(BadRequestException);
    });

    it('should escalate to area lead when lead absent and no deputy', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 5, role: 'employee' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            team_deputy_lead_id: null,
            department_id: 1,
          },
        ],
      });
      // lead absent
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: true }] });
      // resolveAreaLeadOrAutoApprove → area lead exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ area_lead_id: 99, area_deputy_lead_id: null }],
      });

      const result = await service.getApprover(1, 5);

      // Both absent, no deputy → escalate to area lead
      expect(result.approverId).toBe(99);
      expect(result.autoApproved).toBe(false);
    });

    it('should assign lead when deputy IS the requester (self-approval prevention)', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ found: false }] });
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 11, role: 'employee' }],
      });
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            team_id: 1,
            team_name: 'Team A',
            team_lead_id: 10,
            team_deputy_lead_id: 11, // requester IS the deputy
            department_id: 1,
          },
        ],
      });

      const result = await service.getApprover(1, 11);

      // Lead approves (deputy cannot self-approve)
      expect(result.approverId).toBe(10);
      expect(result.autoApproved).toBe(false);
    });
  });
});
