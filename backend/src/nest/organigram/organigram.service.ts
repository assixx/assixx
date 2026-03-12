import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { OrganigramLayoutService } from './organigram-layout.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import type {
  OrgChartNode,
  OrgChartPosition,
  OrgChartTree,
  OrgEntityType,
  OrgTreeHall,
} from './organigram.types.js';

interface TenantInfoRow {
  company_name: string;
  address: string | null;
}

interface AreaRow {
  uuid: string;
  name: string;
  lead_name: string | null;
}

interface DepartmentRow {
  uuid: string;
  name: string;
  lead_name: string | null;
  area_uuid: string | null;
}

interface TeamRow {
  uuid: string;
  name: string;
  lead_name: string | null;
  member_count: number;
  department_uuid: string | null;
}

interface AssetRow {
  uuid: string;
  name: string;
  area_uuid: string | null;
  department_uuid: string | null;
}

interface HallRow {
  name: string;
  hall_uuid: string;
  area_uuid: string | null;
}

@Injectable()
export class OrganigramService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: OrganigramSettingsService,
    private readonly layout: OrganigramLayoutService,
  ) {}

  async getOrgChartTree(tenantId: number): Promise<OrgChartTree> {
    const [
      tenant,
      labels,
      viewport,
      hallOverrides,
      areas,
      departments,
      teams,
      assets,
      halls,
      positions,
    ] = await Promise.all([
      this.fetchTenantInfo(tenantId),
      this.settings.getHierarchyLabels(tenantId),
      this.settings.getViewport(tenantId),
      this.settings.getHallOverrides(tenantId),
      this.fetchAreas(tenantId),
      this.fetchDepartments(tenantId),
      this.fetchTeams(tenantId),
      this.fetchAssets(tenantId),
      this.fetchHalls(tenantId),
      this.layout.getPositions(tenantId),
    ]);

    const orgHalls: OrgTreeHall[] = halls.map((h: HallRow) => ({
      uuid: h.hall_uuid.trim(),
      name: h.name,
      areaUuid: h.area_uuid?.trim() ?? null,
    }));

    const nodes = this.buildTree(areas, departments, teams, assets, positions);

    return {
      companyName: tenant.company_name,
      address: tenant.address,
      hierarchyLabels: labels,
      viewport,
      hallOverrides,
      nodes,
      halls: orgHalls,
    };
  }

  private async fetchTenantInfo(tenantId: number): Promise<TenantInfoRow> {
    const rows = await this.db.query<TenantInfoRow>(
      `SELECT company_name,
              NULLIF(TRIM(CONCAT_WS(' ', street, house_number, postal_code, city)), '') AS address
       FROM tenants WHERE id = $1`,
      [tenantId],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException(`Tenant ${String(tenantId)} nicht gefunden`);
    }

    return rows[0];
  }

  private async fetchAreas(tenantId: number): Promise<AreaRow[]> {
    return await this.db.query<AreaRow>(
      `SELECT a.uuid, a.name,
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS lead_name
       FROM areas a
       LEFT JOIN users u ON a.area_lead_id = u.id
       WHERE a.tenant_id = $1 AND a.is_active = 1
       ORDER BY a.name`,
      [tenantId],
    );
  }

  private async fetchDepartments(tenantId: number): Promise<DepartmentRow[]> {
    return await this.db.query<DepartmentRow>(
      `SELECT d.uuid, d.name,
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS lead_name,
              pa.uuid AS area_uuid
       FROM departments d
       LEFT JOIN users u ON d.department_lead_id = u.id
       LEFT JOIN areas pa ON d.area_id = pa.id
       WHERE d.tenant_id = $1 AND d.is_active = 1
       ORDER BY d.name`,
      [tenantId],
    );
  }

  private async fetchTeams(tenantId: number): Promise<TeamRow[]> {
    return await this.db.query<TeamRow>(
      `SELECT t.uuid, t.name,
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS lead_name,
              pd.uuid AS department_uuid,
              COALESCE(mc.member_count, 0)::int AS member_count
       FROM teams t
       LEFT JOIN users u ON t.team_lead_id = u.id
       LEFT JOIN departments pd ON t.department_id = pd.id
       LEFT JOIN (
         SELECT team_id, COUNT(*)::int AS member_count
         FROM user_teams
         GROUP BY team_id
       ) mc ON mc.team_id = t.id
       WHERE t.tenant_id = $1 AND t.is_active = 1
       ORDER BY t.name`,
      [tenantId],
    );
  }

  private async fetchAssets(tenantId: number): Promise<AssetRow[]> {
    return await this.db.query<AssetRow>(
      `SELECT ast.uuid, ast.name,
              pa.uuid AS area_uuid,
              pd.uuid AS department_uuid
       FROM assets ast
       LEFT JOIN areas pa ON ast.area_id = pa.id
       LEFT JOIN departments pd ON ast.department_id = pd.id
       WHERE ast.tenant_id = $1 AND ast.is_active = 1
       ORDER BY ast.name`,
      [tenantId],
    );
  }

  private async fetchHalls(tenantId: number): Promise<HallRow[]> {
    return await this.db.query<HallRow>(
      `SELECT h.name, h.uuid AS hall_uuid, a.uuid AS area_uuid
       FROM halls h
       LEFT JOIN areas a ON h.area_id = a.id
       WHERE h.tenant_id = $1 AND h.is_active = 1
       ORDER BY h.name`,
      [tenantId],
    );
  }

  private buildTree(
    areas: AreaRow[],
    departments: DepartmentRow[],
    teams: TeamRow[],
    assets: AssetRow[],
    positions: OrgChartPosition[],
  ): OrgChartNode[] {
    const posMap = this.buildPositionMap(positions);
    const topLevel: OrgChartNode[] = [];

    const areaNodes = areas.map((a: AreaRow) =>
      this.toNode('area', a.uuid, a.name, posMap, a.lead_name),
    );
    const areaMap = new Map(
      areaNodes.map((n: OrgChartNode) => [n.entityUuid, n]),
    );
    topLevel.push(...areaNodes);

    const deptMap = this.attachDepartments(
      departments,
      areaMap,
      posMap,
      topLevel,
    );
    this.attachTeams(teams, deptMap, posMap, topLevel);
    this.attachAssets(assets, areaMap, deptMap, posMap, topLevel);

    return topLevel;
  }

  private attachDepartments(
    departments: DepartmentRow[],
    areaMap: Map<string, OrgChartNode>,
    posMap: Map<string, OrgChartPosition>,
    topLevel: OrgChartNode[],
  ): Map<string, OrgChartNode> {
    const deptMap = new Map<string, OrgChartNode>();

    for (const d of departments) {
      const node = this.toNode(
        'department',
        d.uuid,
        d.name,
        posMap,
        d.lead_name,
      );
      deptMap.set(node.entityUuid, node);

      if (d.area_uuid !== null) {
        const parent = areaMap.get(d.area_uuid.trim());
        if (parent !== undefined) {
          parent.children.push(node);
          continue;
        }
      }
      // Kein Parent → Top-Level (ohne Verbindungslinie)
      topLevel.push(node);
    }

    return deptMap;
  }

  private attachTeams(
    teams: TeamRow[],
    deptMap: Map<string, OrgChartNode>,
    posMap: Map<string, OrgChartPosition>,
    topLevel: OrgChartNode[],
  ): void {
    for (const t of teams) {
      const node = this.toNode(
        'team',
        t.uuid,
        t.name,
        posMap,
        t.lead_name,
        t.member_count,
      );

      if (t.department_uuid !== null) {
        const parent = deptMap.get(t.department_uuid.trim());
        if (parent !== undefined) {
          parent.children.push(node);
          continue;
        }
      }
      topLevel.push(node);
    }
  }

  private attachAssets(
    assets: AssetRow[],
    areaMap: Map<string, OrgChartNode>,
    deptMap: Map<string, OrgChartNode>,
    posMap: Map<string, OrgChartPosition>,
    topLevel: OrgChartNode[],
  ): void {
    for (const a of assets) {
      const node = this.toNode('asset', a.uuid, a.name, posMap);
      const parent = this.findAssetParent(a, deptMap, areaMap);

      if (parent !== undefined) {
        parent.assets.push(node);
      } else {
        topLevel.push(node);
      }
    }
  }

  private findAssetParent(
    asset: AssetRow,
    deptMap: Map<string, OrgChartNode>,
    areaMap: Map<string, OrgChartNode>,
  ): OrgChartNode | undefined {
    if (asset.department_uuid !== null) {
      const parent = deptMap.get(asset.department_uuid.trim());
      if (parent !== undefined) return parent;
    }
    if (asset.area_uuid !== null) {
      return areaMap.get(asset.area_uuid.trim());
    }
    return undefined;
  }

  private toNode(
    entityType: OrgEntityType,
    uuid: string,
    name: string,
    posMap: Map<string, OrgChartPosition>,
    leadName?: string | null,
    memberCount?: number,
  ): OrgChartNode {
    const trimmedUuid = uuid.trim();
    const node: OrgChartNode = {
      entityType,
      entityUuid: trimmedUuid,
      name,
      position: posMap.get(`${entityType}:${trimmedUuid}`) ?? null,
      children: [],
      assets: [],
    };

    const trimmedLead = leadName?.trim();
    if (trimmedLead !== undefined && trimmedLead !== '') {
      node.leadName = trimmedLead;
    }
    if (memberCount !== undefined) {
      node.memberCount = memberCount;
    }

    return node;
  }

  private buildPositionMap(
    positions: OrgChartPosition[],
  ): Map<string, OrgChartPosition> {
    return new Map(
      positions.map((p: OrgChartPosition) => [
        `${p.entityType}:${p.entityUuid}`,
        p,
      ]),
    );
  }
}
