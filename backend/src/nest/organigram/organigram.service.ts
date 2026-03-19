import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { OrganigramLayoutService } from './organigram-layout.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import type {
  OrgChartNode,
  OrgChartPosition,
  OrgChartTree,
  OrgEntityType,
  OrgNodeDetail,
  OrgNodeDetailEntry,
  OrgNodeDetailPerson,
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

interface DepartmentHallRow {
  department_uuid: string;
  hall_uuid: string;
}

interface TeamHallRow {
  team_uuid: string;
  hall_uuid: string;
}

// ---- Node Detail Row Types ----

interface AreaDetailRow {
  uuid: string;
  name: string;
  area_type: string;
  lead_uuid: string | null;
  lead_name: string | null;
}

interface DeptDetailRow {
  uuid: string;
  name: string;
  lead_uuid: string | null;
  lead_name: string | null;
  area_uuid: string | null;
  area_name: string | null;
}

interface TeamDetailRow {
  uuid: string;
  name: string;
  lead_uuid: string | null;
  lead_name: string | null;
  deputy_uuid: string | null;
  deputy_name: string | null;
  dept_uuid: string | null;
  dept_name: string | null;
  area_uuid: string | null;
  area_name: string | null;
}

interface AssetDetailRow {
  uuid: string;
  name: string;
  asset_status: string | null;
  asset_type: string | null;
  area_uuid: string | null;
  area_name: string | null;
  dept_uuid: string | null;
  dept_name: string | null;
}

interface DetailChildRow {
  uuid: string;
  name: string;
  extra: string | null;
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
      hallConnectionAnchors,
      canvasBg,
      areas,
      departments,
      teams,
      assets,
      halls,
      positions,
      deptHallRows,
      teamHallRows,
    ] = await Promise.all([
      this.fetchTenantInfo(tenantId),
      this.settings.getHierarchyLabels(tenantId),
      this.settings.getViewport(tenantId),
      this.settings.getHallOverrides(tenantId),
      this.settings.getHallConnectionAnchors(tenantId),
      this.settings.getCanvasBg(tenantId),
      this.fetchAreas(tenantId),
      this.fetchDepartments(tenantId),
      this.fetchTeams(tenantId),
      this.fetchAssets(tenantId),
      this.fetchHalls(tenantId),
      this.layout.getPositions(tenantId),
      this.fetchDepartmentHalls(tenantId),
      this.fetchTeamHalls(tenantId),
    ]);

    const orgHalls = this.mapHallRows(halls);
    const departmentHallMap = this.buildUuidHallMap(
      deptHallRows,
      'department_uuid',
    );
    const teamHallMap = this.buildUuidHallMap(teamHallRows, 'team_uuid');
    const nodes = this.buildTree(areas, departments, teams, assets, positions);

    return {
      companyName: tenant.company_name,
      address: tenant.address,
      hierarchyLabels: labels,
      viewport,
      hallOverrides,
      hallConnectionAnchors,
      canvasBg,
      nodes,
      halls: orgHalls,
      departmentHallMap,
      teamHallMap,
    };
  }

  private mapHallRows(halls: HallRow[]): OrgTreeHall[] {
    return halls.map((h: HallRow) => ({
      uuid: h.hall_uuid.trim(),
      name: h.name,
      areaUuid: h.area_uuid?.trim() ?? null,
    }));
  }

  private buildUuidHallMap<T extends { hall_uuid: string }>(
    rows: T[],
    uuidKey: keyof T,
  ): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      const entityUuid = String(row[uuidKey]).trim();
      const hallUuid = row.hall_uuid.trim();
      map[entityUuid] ??= [];
      map[entityUuid].push(hallUuid);
    }
    return map;
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

  private async fetchDepartmentHalls(
    tenantId: number,
  ): Promise<DepartmentHallRow[]> {
    return await this.db.query<DepartmentHallRow>(
      `SELECT d.uuid AS department_uuid, h.uuid AS hall_uuid
       FROM department_halls dh
       JOIN departments d ON dh.department_id = d.id
       JOIN halls h ON dh.hall_id = h.id
       WHERE dh.tenant_id = $1`,
      [tenantId],
    );
  }

  private async fetchTeamHalls(tenantId: number): Promise<TeamHallRow[]> {
    return await this.db.query<TeamHallRow>(
      `SELECT t.uuid AS team_uuid, h.uuid AS hall_uuid
       FROM team_halls th
       JOIN teams t ON th.team_id = t.id
       JOIN halls h ON th.hall_id = h.id
       WHERE th.tenant_id = $1`,
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

  // ---- Node Detail ----

  async getNodeDetails(
    tenantId: number,
    entityType: OrgEntityType,
    entityUuid: string,
  ): Promise<OrgNodeDetail> {
    switch (entityType) {
      case 'area':
        return await this.getAreaDetail(tenantId, entityUuid);
      case 'department':
        return await this.getDeptDetail(tenantId, entityUuid);
      case 'team':
        return await this.getTeamDetail(tenantId, entityUuid);
      case 'asset':
        return await this.getAssetDetail(tenantId, entityUuid);
    }
  }

  private async getAreaDetail(
    tenantId: number,
    uuid: string,
  ): Promise<OrgNodeDetail> {
    const [baseRows, deptRows, assetRows, hallRows] = await Promise.all([
      this.db.query<AreaDetailRow>(
        `SELECT a.uuid, a.name, a.type::text AS area_type,
                u.uuid AS lead_uuid,
                TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS lead_name
         FROM areas a
         LEFT JOIN users u ON a.area_lead_id = u.id
         WHERE a.tenant_id = $1 AND a.uuid = $2 AND a.is_active = 1`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT d.uuid, d.name,
                NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS extra
         FROM departments d
         LEFT JOIN users u ON d.department_lead_id = u.id
         WHERE d.area_id = (SELECT id FROM areas WHERE uuid = $2 AND tenant_id = $1)
           AND d.is_active = 1
         ORDER BY d.name`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT ast.uuid, ast.name, ast.status::text AS extra
         FROM assets ast
         WHERE ast.area_id = (SELECT id FROM areas WHERE uuid = $2 AND tenant_id = $1)
           AND ast.is_active = 1
         ORDER BY ast.name`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT h.uuid, h.name, NULL::text AS extra
         FROM halls h
         WHERE h.area_id = (SELECT id FROM areas WHERE uuid = $2 AND tenant_id = $1)
           AND h.is_active = 1
         ORDER BY h.name`,
        [tenantId, uuid],
      ),
    ]);

    const base = baseRows[0];
    if (base === undefined) throw new NotFoundException('Area nicht gefunden');

    const lead = this.toPerson(base.lead_uuid, base.lead_name);
    const departments = this.mapChildren(deptRows);
    const assets = this.mapChildren(assetRows);
    const halls = this.mapChildren(hallRows);

    return {
      entityType: 'area',
      entityUuid: base.uuid.trim(),
      name: base.name,
      areaType: base.area_type,
      ...(lead !== undefined && { lead }),
      ...(departments !== undefined && { departments }),
      ...(assets !== undefined && { assets }),
      ...(halls !== undefined && { halls }),
    };
  }

  private async getDeptDetail(
    tenantId: number,
    uuid: string,
  ): Promise<OrgNodeDetail> {
    const sub = `(SELECT id FROM departments WHERE uuid = $2 AND tenant_id = $1)`;
    const [baseRows, teamRows, empRows, assetRows] = await Promise.all([
      this.db.query<DeptDetailRow>(
        `SELECT d.uuid, d.name, u.uuid AS lead_uuid,
                TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS lead_name,
                pa.uuid AS area_uuid, pa.name AS area_name
         FROM departments d
         LEFT JOIN users u ON d.department_lead_id = u.id
         LEFT JOIN areas pa ON d.area_id = pa.id
         WHERE d.tenant_id = $1 AND d.uuid = $2 AND d.is_active = 1`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT t.uuid, t.name,
                CONCAT_WS(' · ', NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
                  COALESCE(mc.cnt, 0) || ' Mitgl.') AS extra
         FROM teams t
         LEFT JOIN users u ON t.team_lead_id = u.id
         LEFT JOIN (SELECT team_id, COUNT(*)::int AS cnt FROM user_teams GROUP BY team_id) mc ON mc.team_id = t.id
         WHERE t.department_id = ${sub} AND t.is_active = 1
         ORDER BY t.name`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT u.uuid, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name,
                CASE WHEN ud.is_primary THEN 'Primär' ELSE NULL END AS extra
         FROM user_departments ud JOIN users u ON ud.user_id = u.id
         WHERE ud.department_id = ${sub} ORDER BY u.last_name`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT ast.uuid, ast.name, ast.status::text AS extra FROM assets ast
         WHERE ast.department_id = ${sub} AND ast.is_active = 1 ORDER BY ast.name`,
        [tenantId, uuid],
      ),
    ]);

    const base = baseRows[0];
    if (base === undefined)
      throw new NotFoundException('Abteilung nicht gefunden');
    const lead = this.toPerson(base.lead_uuid, base.lead_name);
    const parentArea = this.toParent(base.area_uuid, base.area_name);
    const m = (rows: DetailChildRow[]): OrgNodeDetailEntry[] =>
      rows.map((r: DetailChildRow) => this.toDetailEntry(r));

    return {
      entityType: 'department',
      entityUuid: base.uuid.trim(),
      name: base.name,
      ...(lead !== undefined && { lead }),
      ...(parentArea !== undefined && { parentArea }),
      ...(teamRows.length > 0 && { teams: m(teamRows) }),
      ...(empRows.length > 0 && { employees: m(empRows) }),
      ...(assetRows.length > 0 && { assets: m(assetRows) }),
    };
  }

  private async getTeamDetail(
    tenantId: number,
    uuid: string,
  ): Promise<OrgNodeDetail> {
    const [baseRows, memberRows, assetRows] = await Promise.all([
      this.db.query<TeamDetailRow>(
        `SELECT t.uuid, t.name,
                lu.uuid AS lead_uuid,
                TRIM(CONCAT(lu.first_name, ' ', lu.last_name)) AS lead_name,
                du.uuid AS deputy_uuid,
                TRIM(CONCAT(du.first_name, ' ', du.last_name)) AS deputy_name,
                pd.uuid AS dept_uuid, pd.name AS dept_name,
                pa.uuid AS area_uuid, pa.name AS area_name
         FROM teams t
         LEFT JOIN users lu ON t.team_lead_id = lu.id
         LEFT JOIN users du ON t.deputy_lead_id = du.id
         LEFT JOIN departments pd ON t.department_id = pd.id
         LEFT JOIN areas pa ON pd.area_id = pa.id
         WHERE t.tenant_id = $1 AND t.uuid = $2 AND t.is_active = 1`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT u.uuid, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name,
                ut.role::text AS extra
         FROM user_teams ut
         JOIN users u ON ut.user_id = u.id
         WHERE ut.team_id = (SELECT id FROM teams WHERE uuid = $2 AND tenant_id = $1)
         ORDER BY u.last_name`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT ast.uuid, ast.name, ast.status::text AS extra
         FROM asset_teams at2
         JOIN assets ast ON at2.asset_id = ast.id
         WHERE at2.team_id = (SELECT id FROM teams WHERE uuid = $2 AND tenant_id = $1)
           AND ast.is_active = 1
         ORDER BY ast.name`,
        [tenantId, uuid],
      ),
    ]);

    const base = baseRows[0];
    if (base === undefined) throw new NotFoundException('Team nicht gefunden');

    const lead = this.toPerson(base.lead_uuid, base.lead_name);
    const deputyLead = this.toPerson(base.deputy_uuid, base.deputy_name);
    const parentDepartment = this.toParent(base.dept_uuid, base.dept_name);
    const parentArea = this.toParent(base.area_uuid, base.area_name);
    const members = this.mapChildren(memberRows);
    const assets = this.mapChildren(assetRows);

    return {
      entityType: 'team',
      entityUuid: base.uuid.trim(),
      name: base.name,
      ...(lead !== undefined && { lead }),
      ...(deputyLead !== undefined && { deputyLead }),
      ...(parentDepartment !== undefined && { parentDepartment }),
      ...(parentArea !== undefined && { parentArea }),
      ...(members !== undefined && { members }),
      ...(assets !== undefined && { assets }),
    };
  }

  private async getAssetDetail(
    tenantId: number,
    uuid: string,
  ): Promise<OrgNodeDetail> {
    const [baseRows, teamRows] = await Promise.all([
      this.db.query<AssetDetailRow>(
        `SELECT ast.uuid, ast.name, ast.status::text AS asset_status,
                ast.asset_type::text,
                pa.uuid AS area_uuid, pa.name AS area_name,
                pd.uuid AS dept_uuid, pd.name AS dept_name
         FROM assets ast
         LEFT JOIN areas pa ON ast.area_id = pa.id
         LEFT JOIN departments pd ON ast.department_id = pd.id
         WHERE ast.tenant_id = $1 AND ast.uuid = $2 AND ast.is_active = 1`,
        [tenantId, uuid],
      ),
      this.db.query<DetailChildRow>(
        `SELECT t.uuid, t.name, NULL::text AS extra
         FROM asset_teams at2
         JOIN teams t ON at2.team_id = t.id
         WHERE at2.asset_id = (SELECT id FROM assets WHERE uuid = $2 AND tenant_id = $1)
           AND t.is_active = 1
         ORDER BY t.name`,
        [tenantId, uuid],
      ),
    ]);

    const base = baseRows[0];
    if (base === undefined)
      throw new NotFoundException('Anlage nicht gefunden');

    const parentArea = this.toParent(base.area_uuid, base.area_name);
    const parentDepartment = this.toParent(base.dept_uuid, base.dept_name);
    const assignedTeams = this.mapChildren(teamRows);

    return {
      entityType: 'asset',
      entityUuid: base.uuid.trim(),
      name: base.name,
      ...(base.asset_status !== null && { assetStatus: base.asset_status }),
      ...(base.asset_type !== null && { assetType: base.asset_type }),
      ...(parentArea !== undefined && { parentArea }),
      ...(parentDepartment !== undefined && { parentDepartment }),
      ...(assignedTeams !== undefined && { assignedTeams }),
    };
  }

  // ---- Node Detail Helpers ----

  private toPerson(
    uuid: string | null,
    name: string | null,
  ): OrgNodeDetailPerson | undefined {
    if (uuid === null || name === null) return undefined;
    const trimmed = name.trim();
    if (trimmed === '') return undefined;
    return { uuid: uuid.trim(), name: trimmed };
  }

  private toParent(
    uuid: string | null | undefined,
    name: string | null | undefined,
  ): OrgNodeDetailEntry | undefined {
    if (uuid === null || uuid === undefined) return undefined;
    if (name === null || name === undefined) return undefined;
    return { uuid: uuid.trim(), name };
  }

  private toDetailEntry(row: DetailChildRow): OrgNodeDetailEntry {
    const entry: OrgNodeDetailEntry = { uuid: row.uuid.trim(), name: row.name };
    const extra = row.extra?.trim();
    if (extra !== undefined && extra !== '') entry.extra = extra;
    return entry;
  }

  private mapChildren(
    rows: DetailChildRow[],
  ): OrgNodeDetailEntry[] | undefined {
    if (rows.length === 0) return undefined;
    return rows.map((r: DetailChildRow) => this.toDetailEntry(r));
  }
}
