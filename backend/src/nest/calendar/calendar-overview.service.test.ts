/**
 * Unit tests for CalendarOverviewService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Dashboard events, recently added events, upcoming count
 *        with permission branching (full access vs permission-based).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddonVisitsService } from '../addon-visits/addon-visits.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { CalendarOverviewService } from './calendar-overview.service.js';
import type { CalendarPermissionService } from './calendar-permission.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./calendar.helpers.js', () => ({
  PERMISSION_BASED_COUNT_QUERY: 'SELECT COUNT(DISTINCT e.id) as count FROM ...',
  buildVisibilityClause: vi.fn().mockReturnValue('(e.user_id = $4)'),
  dbToApiEvent: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    title: row['title'],
    startDate: row['start_date'],
  })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockAddonVisits() {
  return { getLastVisited: vi.fn() };
}

function createMockPermissionService() {
  return {
    getUserRole: vi.fn().mockResolvedValue({
      role: 'employee',
      has_full_access: false,
    }),
  };
}

// =============================================================
// CalendarOverviewService
// =============================================================

describe('CalendarOverviewService', () => {
  let service: CalendarOverviewService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAddonVisits: ReturnType<typeof createMockAddonVisits>;
  let mockPermission: ReturnType<typeof createMockPermissionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockAddonVisits = createMockAddonVisits();
    mockPermission = createMockPermissionService();
    service = new CalendarOverviewService(
      mockDb as unknown as DatabaseService,
      mockAddonVisits as unknown as AddonVisitsService,
      mockPermission as unknown as CalendarPermissionService,
    );
  });

  // =============================================================
  // getDashboardEvents
  // =============================================================

  describe('getDashboardEvents', () => {
    it('should return mapped events for employee', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, title: 'Meeting', start_date: '2025-06-15' },
      ]);

      const result = await service.getDashboardEvents(10, 5);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should use admin path for root user', async () => {
      mockPermission.getUserRole.mockResolvedValueOnce({
        role: 'root',
        has_full_access: false,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEvents(10, 1);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('org_level');
    });

    it('should use admin path for full-access user', async () => {
      mockPermission.getUserRole.mockResolvedValueOnce({
        role: 'admin',
        has_full_access: true,
      });
      mockDb.query.mockResolvedValueOnce([]);

      await service.getDashboardEvents(10, 1);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('org_level');
    });
  });

  // =============================================================
  // getRecentlyAddedEvents
  // =============================================================

  describe('getRecentlyAddedEvents', () => {
    it('should return recently added events with limit', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 2, title: 'Workshop', start_date: '2025-07-01' },
        { id: 3, title: 'Standup', start_date: '2025-07-02' },
      ]);

      const result = await service.getRecentlyAddedEvents(10, 5, 3);

      expect(result).toHaveLength(2);
    });
  });

  // =============================================================
  // getUpcomingCount
  // =============================================================

  describe('getUpcomingCount', () => {
    it('should use full-access path for root', async () => {
      mockPermission.getUserRole.mockResolvedValueOnce({
        role: 'root',
        has_full_access: false,
      });
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);

      const result = await service.getUpcomingCount(10, 1, null, null);

      expect(result.count).toBe(5);
    });

    it('should use permission-based path for employee', async () => {
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(
        new Date('2025-06-01'),
      );
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.getUpcomingCount(10, 5, 3, 7);

      expect(result.count).toBe(2);
    });

    it('should default to epoch when no last visit', async () => {
      mockAddonVisits.getLastVisited.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.getUpcomingCount(10, 5, null, null);

      expect(result.count).toBe(0);
    });
  });
});
