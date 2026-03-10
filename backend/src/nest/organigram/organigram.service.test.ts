import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { OrganigramLayoutService } from './organigram-layout.service.js';
import type { OrganigramSettingsService } from './organigram-settings.service.js';
import { OrganigramService } from './organigram.service.js';
import {
  DEFAULT_HIERARCHY_LABELS,
  type OrgChartPosition,
} from './organigram.types.js';

// =============================================================
// Mocks
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockSettings() {
  return { getHierarchyLabels: vi.fn() };
}

function createMockLayout() {
  return { getPositions: vi.fn() };
}

type MockDb = ReturnType<typeof createMockDb>;
type MockSettings = ReturnType<typeof createMockSettings>;
type MockLayout = ReturnType<typeof createMockLayout>;

// UUIDs are exactly 36 chars (CHAR(36) may pad with spaces)
const AREA_1 = 'a0000000-0000-0000-0000-000000000001';
const AREA_2 = 'a0000000-0000-0000-0000-000000000002';
const DEPT_1 = 'd0000000-0000-0000-0000-000000000001';
const DEPT_2 = 'd0000000-0000-0000-0000-000000000002';
const TEAM_1 = 't0000000-0000-0000-0000-000000000001';
const ASSET_1 = 's0000000-0000-0000-0000-000000000001';
const ASSET_2 = 's0000000-0000-0000-0000-000000000002';

// =============================================================
// Helpers
// =============================================================

/** Set up mockDb.query for a standard tree test (5 sequential calls). */
function setupTreeQueries(
  mockDb: MockDb,
  data: {
    tenant?: { company_name: string; address: string | null };
    areas?: Record<string, unknown>[];
    departments?: Record<string, unknown>[];
    teams?: Record<string, unknown>[];
    assets?: Record<string, unknown>[];
  },
): void {
  mockDb.query.mockResolvedValueOnce(
    data.tenant ?
      [data.tenant]
    : [{ company_name: 'Test GmbH', address: null }],
  );
  mockDb.query.mockResolvedValueOnce(data.areas ?? []);
  mockDb.query.mockResolvedValueOnce(data.departments ?? []);
  mockDb.query.mockResolvedValueOnce(data.teams ?? []);
  mockDb.query.mockResolvedValueOnce(data.assets ?? []);
}

// =============================================================
// Tests
// =============================================================

describe('OrganigramService', () => {
  let service: OrganigramService;
  let mockDb: MockDb;
  let mockSettings: MockSettings;
  let mockLayout: MockLayout;

  beforeEach(() => {
    mockDb = createMockDb();
    mockSettings = createMockSettings();
    mockLayout = createMockLayout();

    service = new OrganigramService(
      mockDb as unknown as DatabaseService,
      mockSettings as unknown as OrganigramSettingsService,
      mockLayout as unknown as OrganigramLayoutService,
    );

    // Defaults for settings + layout
    mockSettings.getHierarchyLabels.mockResolvedValue({
      ...DEFAULT_HIERARCHY_LABELS,
    });
    mockLayout.getPositions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================
  // getOrgChartTree
  // =============================================================

  describe('getOrgChartTree', () => {
    it('should throw NotFoundException when tenant not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // tenant → empty
      mockDb.query.mockResolvedValueOnce([]); // areas
      mockDb.query.mockResolvedValueOnce([]); // departments
      mockDb.query.mockResolvedValueOnce([]); // teams
      mockDb.query.mockResolvedValueOnce([]); // assets

      await expect(service.getOrgChartTree(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return tree with correct company info', async () => {
      setupTreeQueries(mockDb, {
        tenant: { company_name: 'Industrie AG', address: 'Hauptstr. 5' },
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.companyName).toBe('Industrie AG');
      expect(tree.address).toBe('Hauptstr. 5');
      expect(tree.hierarchyLabels).toEqual(DEFAULT_HIERARCHY_LABELS);
    });

    it('should return empty nodes for tenant with no entities', async () => {
      setupTreeQueries(mockDb, {});

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes).toEqual([]);
    });

    it('should build area nodes at top level', async () => {
      setupTreeQueries(mockDb, {
        areas: [
          { uuid: AREA_1, name: 'Produktion', lead_name: 'Max Müller' },
          { uuid: AREA_2, name: 'Verwaltung', lead_name: null },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes).toHaveLength(2);
      expect(tree.nodes[0]?.entityType).toBe('area');
      expect(tree.nodes[0]?.name).toBe('Produktion');
      expect(tree.nodes[0]?.leadName).toBe('Max Müller');
      expect(tree.nodes[1]?.name).toBe('Verwaltung');
    });

    it('should attach departments as children of areas', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
        departments: [
          {
            uuid: DEPT_1,
            name: 'Abteilung X',
            lead_name: 'Anna Schmidt',
            area_uuid: AREA_1,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes[0]?.children).toHaveLength(1);
      expect(tree.nodes[0]?.children[0]?.entityType).toBe('department');
      expect(tree.nodes[0]?.children[0]?.name).toBe('Abteilung X');
      expect(tree.nodes[0]?.children[0]?.leadName).toBe('Anna Schmidt');
    });

    it('should attach teams as children of departments', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
        departments: [
          {
            uuid: DEPT_1,
            name: 'Abteilung X',
            lead_name: null,
            area_uuid: AREA_1,
          },
        ],
        teams: [
          {
            uuid: TEAM_1,
            name: 'Team Alpha',
            lead_name: 'Franz',
            department_uuid: DEPT_1,
            member_count: 12,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      const dept = tree.nodes[0]?.children[0];
      expect(dept?.children).toHaveLength(1);
      expect(dept?.children[0]?.entityType).toBe('team');
      expect(dept?.children[0]?.name).toBe('Team Alpha');
      expect(dept?.children[0]?.leadName).toBe('Franz');
      expect(dept?.children[0]?.memberCount).toBe(12);
    });

    it('should attach assets to departments when department_uuid is set', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
        departments: [
          {
            uuid: DEPT_1,
            name: 'Abteilung X',
            lead_name: null,
            area_uuid: AREA_1,
          },
        ],
        assets: [
          {
            uuid: ASSET_1,
            name: 'CNC Fräse',
            area_uuid: AREA_1,
            department_uuid: DEPT_1,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      const dept = tree.nodes[0]?.children[0];
      expect(dept?.assets).toHaveLength(1);
      expect(dept?.assets[0]?.entityType).toBe('asset');
      expect(dept?.assets[0]?.name).toBe('CNC Fräse');
    });

    it('should attach assets to areas when only area_uuid is set', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
        assets: [
          {
            uuid: ASSET_1,
            name: 'Gabelstapler',
            area_uuid: AREA_1,
            department_uuid: null,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes[0]?.assets).toHaveLength(1);
      expect(tree.nodes[0]?.assets[0]?.name).toBe('Gabelstapler');
    });

    it('should not set leadName when null', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes[0]).not.toHaveProperty('leadName');
    });

    it('should not set leadName when only whitespace', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: '   ' }],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes[0]).not.toHaveProperty('leadName');
    });

    it('should include memberCount = 0 for teams', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
        departments: [
          { uuid: DEPT_1, name: 'Abt.', lead_name: null, area_uuid: AREA_1 },
        ],
        teams: [
          {
            uuid: TEAM_1,
            name: 'Leeres Team',
            lead_name: null,
            department_uuid: DEPT_1,
            member_count: 0,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      const team = tree.nodes[0]?.children[0]?.children[0];
      expect(team?.memberCount).toBe(0);
    });

    it('should map positions to matching entities', async () => {
      const position: OrgChartPosition = {
        uuid: 'pos-uuid-0000-0000-0000-000000000001',
        entityType: 'area',
        entityUuid: AREA_1,
        positionX: 100,
        positionY: 200,
        width: 300,
        height: 150,
      };
      mockLayout.getPositions.mockResolvedValue([position]);

      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes[0]?.position).toEqual(position);
    });

    it('should set position to null when no matching position exists', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes[0]?.position).toBeNull();
    });

    it('should build full hierarchy tree correctly', async () => {
      setupTreeQueries(mockDb, {
        tenant: { company_name: 'Industrie AG', address: 'Hauptstr. 5' },
        areas: [
          { uuid: AREA_1, name: 'Produktion', lead_name: 'Hans' },
          { uuid: AREA_2, name: 'Verwaltung', lead_name: null },
        ],
        departments: [
          {
            uuid: DEPT_1,
            name: 'Fertigung',
            lead_name: 'Peter',
            area_uuid: AREA_1,
          },
          {
            uuid: DEPT_2,
            name: 'Buchhaltung',
            lead_name: null,
            area_uuid: AREA_2,
          },
        ],
        teams: [
          {
            uuid: TEAM_1,
            name: 'Schicht A',
            lead_name: 'Franz',
            department_uuid: DEPT_1,
            member_count: 12,
          },
        ],
        assets: [
          {
            uuid: ASSET_1,
            name: 'CNC Maschine',
            area_uuid: AREA_1,
            department_uuid: DEPT_1,
          },
          {
            uuid: ASSET_2,
            name: 'Drucker',
            area_uuid: AREA_2,
            department_uuid: null,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      // Top level: 2 areas
      expect(tree.nodes).toHaveLength(2);

      // Produktion → Fertigung → Schicht A
      const produktion = tree.nodes[0];
      expect(produktion?.children).toHaveLength(1);
      expect(produktion?.children[0]?.name).toBe('Fertigung');
      expect(produktion?.children[0]?.children).toHaveLength(1);
      expect(produktion?.children[0]?.children[0]?.name).toBe('Schicht A');
      expect(produktion?.children[0]?.children[0]?.memberCount).toBe(12);

      // CNC Maschine → attached to Fertigung (department), not Produktion (area)
      expect(produktion?.children[0]?.assets).toHaveLength(1);
      expect(produktion?.children[0]?.assets[0]?.name).toBe('CNC Maschine');
      expect(produktion?.assets).toHaveLength(0);

      // Verwaltung → Buchhaltung (no teams, no dept-level assets)
      const verwaltung = tree.nodes[1];
      expect(verwaltung?.children).toHaveLength(1);
      expect(verwaltung?.children[0]?.children).toHaveLength(0);

      // Drucker → attached to Verwaltung (area) since no department_uuid
      expect(verwaltung?.assets).toHaveLength(1);
      expect(verwaltung?.assets[0]?.name).toBe('Drucker');
    });

    it('should call all 7 data sources in parallel', async () => {
      setupTreeQueries(mockDb, {});

      await service.getOrgChartTree(1);

      // 5 DB queries + 1 settings + 1 layout = 7 parallel calls
      expect(mockDb.query).toHaveBeenCalledTimes(5);
      expect(mockSettings.getHierarchyLabels).toHaveBeenCalledOnce();
      expect(mockLayout.getPositions).toHaveBeenCalledOnce();
    });

    it('should show departments without area as top-level nodes', async () => {
      setupTreeQueries(mockDb, {
        departments: [
          {
            uuid: DEPT_1,
            name: 'Freie Abteilung',
            lead_name: 'Lisa',
            area_uuid: null,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes).toHaveLength(1);
      expect(tree.nodes[0]?.entityType).toBe('department');
      expect(tree.nodes[0]?.name).toBe('Freie Abteilung');
      expect(tree.nodes[0]?.leadName).toBe('Lisa');
    });

    it('should show teams without department as top-level nodes', async () => {
      setupTreeQueries(mockDb, {
        teams: [
          {
            uuid: TEAM_1,
            name: 'Freies Team',
            lead_name: null,
            department_uuid: null,
            member_count: 5,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes).toHaveLength(1);
      expect(tree.nodes[0]?.entityType).toBe('team');
      expect(tree.nodes[0]?.name).toBe('Freies Team');
      expect(tree.nodes[0]?.memberCount).toBe(5);
    });

    it('should show assets without any parent as top-level nodes', async () => {
      setupTreeQueries(mockDb, {
        assets: [
          {
            uuid: ASSET_1,
            name: 'Freie Anlage',
            area_uuid: null,
            department_uuid: null,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      expect(tree.nodes).toHaveLength(1);
      expect(tree.nodes[0]?.entityType).toBe('asset');
      expect(tree.nodes[0]?.name).toBe('Freie Anlage');
    });

    it('should mix areas and orphaned departments at top level', async () => {
      setupTreeQueries(mockDb, {
        areas: [{ uuid: AREA_1, name: 'Bereich A', lead_name: null }],
        departments: [
          {
            uuid: DEPT_1,
            name: 'Assigned',
            lead_name: null,
            area_uuid: AREA_1,
          },
          {
            uuid: DEPT_2,
            name: 'Orphaned',
            lead_name: null,
            area_uuid: null,
          },
        ],
      });

      const tree = await service.getOrgChartTree(1);

      // Top level: 1 area + 1 orphaned department
      expect(tree.nodes).toHaveLength(2);
      expect(tree.nodes[0]?.entityType).toBe('area');
      expect(tree.nodes[0]?.children).toHaveLength(1);
      expect(tree.nodes[1]?.entityType).toBe('department');
      expect(tree.nodes[1]?.name).toBe('Orphaned');
    });
  });
});
